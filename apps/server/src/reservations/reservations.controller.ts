import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { ReservationsService } from './reservations.service';

@Controller('tickets')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post(':ticketId/reservations')
  create(@Param('ticketId') ticketId: string, @Body('userId') userId: string) {
    return this.reservationsService.create(ticketId, userId);
  }

  @Get(':ticketId/reservations/metrics')
  metrics(@Param('ticketId') ticketId: string) {
    return this.reservationsService.getMetrics(ticketId);
  }

  @Post(':ticketId/reservations/benchmark/reset')
  resetBenchmark(
    @Body('strategy')
    strategy: 'DB_ONLY' | 'REDIS_GATE',
  ) {
    this.reservationsService.configureBenchmark(strategy);

    return {
      strategy,
      reset: true,
    };
  }
}
