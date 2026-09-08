import { Body, Controller, Param, Post } from '@nestjs/common';

import { OrdersService } from './orders.service';
import { PurchaseTicketDto } from './dto/purchase-ticket.dto';

@Controller('tickets')
export class PurchasesController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post(':ticketId/purchase')
  purchase(
    @Param('ticketId') ticketId: string,
    @Body() dto: PurchaseTicketDto,
  ) {
    return this.ordersService.purchase(ticketId, dto.userId);
  }
}
