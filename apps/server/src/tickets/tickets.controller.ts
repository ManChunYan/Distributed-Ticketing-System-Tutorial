import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Controller('events')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post(':eventId/tickets')
  create(@Param('eventId') eventId: string, @Body() dto: CreateTicketDto) {
    return this.ticketsService.create(eventId, dto);
  }

  @Get('tickets/:ticketId/stats')
  getStats(@Param('ticketId') ticketId: string) {
    return this.ticketsService.getStats(ticketId);
  }
}
