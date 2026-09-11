import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { Reservation } from './entities/reservation.entity';
import { RedisReservationGate } from './redis-reservation-gate.service';
import { ReservationsService } from './reservations.service';

interface ReservationHarness {
  service: ReservationsService;
  gate: { reserve: jest.Mock };
  transaction: jest.Mock;
  getState: () => { remaining: number; reservations: unknown[] };
}

async function createHarness(
  strategy: 'DB_ONLY' | 'REDIS_GATE',
  initialStock: number,
  gateReserve: jest.Mock,
): Promise<ReservationHarness> {
  let remaining = initialStock;
  const reservations: unknown[] = [];
  const transaction = jest.fn(async (callback) =>
    callback({
      query: jest.fn(async () => {
        if (remaining <= 0) {
          return [];
        }

        remaining -= 1;
        return [{ remaining }];
      }),
      getRepository: jest.fn(() => ({
        create: jest.fn((reservation) => reservation),
        save: jest.fn(async (reservation) => {
          reservations.push(reservation);
          return reservation;
        }),
      })),
    }),
  );

  const gate = { reserve: gateReserve };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ReservationsService,
      {
        provide: getRepositoryToken(Reservation),
        useValue: { count: jest.fn(async () => reservations.length) },
      },
      { provide: RedisReservationGate, useValue: gate },
      { provide: ConfigService, useValue: { get: () => strategy } },
      {
        provide: DataSource,
        useValue: {
          transaction,
          query: jest.fn(async () => [{ remaining }]),
        },
      },
    ],
  }).compile();

  return {
    service: module.get(ReservationsService),
    gate,
    transaction,
    getState: () => ({ remaining, reservations }),
  };
}

describe('ReservationsService', () => {
  it('creates a reservation when Redis and DB both have stock', async () => {
    const harness = await createHarness(
      'REDIS_GATE',
      1,
      jest.fn().mockResolvedValue(undefined),
    );

    await expect(harness.service.create('ticket-1', 'user-1')).resolves.toEqual(
      expect.objectContaining({ status: 'RESERVED' }),
    );

    expect(harness.getState()).toMatchObject({
      remaining: 0,
      reservations: [expect.objectContaining({ status: 'RESERVED' })],
    });
    await expect(harness.service.getMetrics('ticket-1')).resolves.toMatchObject(
      {
        dbInventoryAttempts: 1,
        gateAllowed: 1,
        gateRejected: 0,
      },
    );
  });

  it('rejects at Redis and does not enter the database transaction', async () => {
    const harness = await createHarness(
      'REDIS_GATE',
      1,
      jest.fn().mockRejectedValue(new ConflictException('Ticket sold out')),
    );

    await expect(harness.service.create('ticket-1', 'user-1')).rejects.toThrow(
      ConflictException,
    );

    expect(harness.transaction).not.toHaveBeenCalled();
    expect(harness.getState().reservations).toHaveLength(0);
    await expect(harness.service.getMetrics('ticket-1')).resolves.toMatchObject(
      {
        dbInventoryAttempts: 0,
        gateAllowed: 0,
        gateRejected: 1,
      },
    );
  });

  it('keeps the DB capacity invariant when Redis over-admits', async () => {
    const harness = await createHarness(
      'REDIS_GATE',
      1,
      jest.fn().mockResolvedValue(undefined),
    );

    const results = await Promise.allSettled([
      harness.service.create('ticket-1', 'user-1'),
      harness.service.create('ticket-1', 'user-2'),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(harness.getState()).toMatchObject({
      remaining: 0,
      reservations: [expect.anything()],
    });
    expect(harness.getState().reservations).toHaveLength(1);
  });

  it('creates exactly the available reservations under high concurrency', async () => {
    const harness = await createHarness(
      'REDIS_GATE',
      100,
      jest.fn().mockResolvedValue(undefined),
    );

    const results = await Promise.allSettled(
      Array.from({ length: 110 }, (_, index) =>
        harness.service.create('ticket-1', `user-${index}`),
      ),
    );

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(100);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(10);
    expect(harness.getState()).toMatchObject({ remaining: 0 });
    expect(harness.getState().reservations).toHaveLength(100);
  });

  it.each(['DB_ONLY', 'REDIS_GATE'] as const)(
    'keeps correctness consistent for %s',
    async (strategy) => {
      const gateReserve = jest.fn().mockImplementation(async () => {
        if (gateReserve.mock.calls.length > 100) {
          throw new ConflictException('Ticket sold out');
        }
      });
      const harness = await createHarness(strategy, 100, gateReserve);

      const results = await Promise.allSettled(
        Array.from({ length: 110 }, (_, index) =>
          harness.service.create('ticket-1', `user-${index}`),
        ),
      );

      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(100);
      expect(harness.getState().reservations).toHaveLength(100);
      expect(harness.getState().remaining).toBe(0);
      await expect(
        harness.service.getMetrics('ticket-1'),
      ).resolves.toMatchObject({
        dbInventoryAttempts: strategy === 'DB_ONLY' ? 110 : 100,
      });
      expect(harness.gate.reserve).toHaveBeenCalledTimes(
        strategy === 'REDIS_GATE' ? 110 : 0,
      );
    },
  );
});
