import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

import { RedisService } from '../redis/redis.service';

@Controller('events')
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly redisService: RedisService,
  ) {}

  @Post(':eventId/tickets')
  create(@Param('eventId') eventId: string, @Body() dto: CreateTicketDto) {
    return this.ticketsService.create(eventId, dto);
  }

  @Get('tickets/:ticketId/stats')
  getStats(@Param('ticketId') ticketId: string) {
    return this.ticketsService.getStats(ticketId);
  }

  @Get('redis/ping')
  pingRedis() {
    return this.redisService.ping();
  }

  @Get('redis/stock/:ticketId')
  getRedisStock(@Param('ticketId') ticketId: string) {
    return this.redisService.get(`ticket:${ticketId}:stock`);
  }
}
