import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';

import { Reservation } from './entities/reservation.entity';
import { RedisReservationGate } from './redis-reservation-gate.service';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,

    private readonly redisReservationGate: RedisReservationGate,
  ) {}

  async create(ticketId: string, userId: string) {
    const reservationId = randomUUID();

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.redisReservationGate.reserve({
      ticketId,
      reservationId,
      userId,
      expiresAt,
    });

    const reservation = this.reservationRepository.create({
      id: reservationId,
      ticketId,
      userId,
      status: 'RESERVED',
      expiresAt,
      confirmedAt: null,
    });

    return this.reservationRepository.save(reservation);
  }
}
