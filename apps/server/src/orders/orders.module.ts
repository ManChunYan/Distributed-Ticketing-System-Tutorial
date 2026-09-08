import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { PurchasesController } from './purchases.controller';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
import { Ticket } from '../tickets/entities/ticket.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Ticket])],
  controllers: [OrdersController, PurchasesController],
  providers: [OrdersService],
})
export class OrdersModule {}
