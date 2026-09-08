import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Order } from './entities/order.entity';
import { Ticket } from '../tickets/entities/ticket.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,

    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
  ) {}

  async purchase(ticketId: string, userId: string) {
    // 1. READ
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // 2. CHECK
    if (ticket.remaining <= 0) {
      throw new ConflictException('Ticket sold out');
    }

    // 3. MODIFY
    ticket.remaining -= 1;

    // 4. WRITE
    await this.ticketRepository.save(ticket);

    // 5. CREATE ORDER
    const order = this.orderRepository.create({
      ticketId,
      userId,
      status: 'CONFIRMED',
    });

    return this.orderRepository.save(order);
  }

  async findOne(id: string) {
    const order = await this.orderRepository.findOne({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }
}
