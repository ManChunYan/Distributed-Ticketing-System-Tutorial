import { Body, Controller, Param, Post } from '@nestjs/common';

import { ReservationsService } from './reservations.service';

@Controller('tickets')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post(':ticketId/reservations')
  create(@Param('ticketId') ticketId: string, @Body('userId') userId: string) {
    return this.reservationsService.create(ticketId, userId);
  }
}
