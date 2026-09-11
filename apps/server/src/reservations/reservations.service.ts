import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';

import { Reservation } from './entities/reservation.entity';
import { RedisReservationGate } from './redis-reservation-gate.service';

export type ReservationStrategy = 'DB_ONLY' | 'REDIS_GATE';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,

    private readonly redisReservationGate: RedisReservationGate,

    private readonly dataSource: DataSource,

    private readonly configService: ConfigService,
  ) {}

  private dbInventoryAttempts = 0;
  private gateAllowed = 0;
  private gateRejected = 0;

  private benchmarkStrategy?: ReservationStrategy;

  async create(ticketId: string, userId: string) {
    const reservationId = randomUUID();

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    if (this.strategy === 'REDIS_GATE') {
      try {
        await this.redisReservationGate.reserve({
          ticketId,
          reservationId,
          userId,
          expiresAt,
        });
        this.gateAllowed += 1;
      } catch (error) {
        if (error instanceof ConflictException) {
          this.gateRejected += 1;
        }
        throw error;
      }
    }

    return this.dataSource.transaction(async (manager) => {
      this.dbInventoryAttempts += 1;

      const [, affectedRows] = await manager.query(
        `
        UPDATE tickets
        SET remaining = remaining - 1
        WHERE id = $1
          AND remaining > 0
        RETURNING remaining
        `,
        [ticketId],
      );

      if (affectedRows === 0) {
        throw new ConflictException('Ticket sold out');
      }
      const reservationRepository = manager.getRepository(Reservation);

      const reservation = reservationRepository.create({
        id: reservationId,
        ticketId,
        userId,
        status: 'RESERVED',
        expiresAt,
        confirmedAt: null,
      });

      return reservationRepository.save(reservation);
    });
  }

  get strategy(): ReservationStrategy {
    return (
      this.benchmarkStrategy ??
      this.configService.get<ReservationStrategy>(
        'RESERVATION_STRATEGY',
        'REDIS_GATE',
      )
    );
  }

  configureBenchmark(strategy: ReservationStrategy) {
    this.benchmarkStrategy = strategy;

    this.dbInventoryAttempts = 0;
    this.gateAllowed = 0;
    this.gateRejected = 0;
  }

  async getMetrics(ticketId: string) {
    const [reservationCount, ticketRows] = await Promise.all([
      this.reservationRepository.count({ where: { ticketId } }),
      this.dataSource.query('SELECT remaining FROM tickets WHERE id = $1', [
        ticketId,
      ]),
    ]);

    return {
      strategy: this.strategy,
      dbInventoryAttempts: this.dbInventoryAttempts,
      gateAllowed: this.gateAllowed,
      gateRejected: this.gateRejected,
      reservationCount,
      remaining: ticketRows[0]?.remaining ?? null,
    };
  }
}
