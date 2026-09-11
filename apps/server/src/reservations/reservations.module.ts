import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Reservation } from './entities/reservation.entity';
import { RedisReservationGate } from './redis-reservation-gate.service';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { Ticket } from '../tickets/entities/ticket.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Reservation, Ticket])],
  controllers: [ReservationsController],
  providers: [ReservationsService, RedisReservationGate],
  exports: [ReservationsService],
})
export class ReservationsModule {}
