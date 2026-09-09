import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Order } from './entities/order.entity';
import { Ticket } from '../tickets/entities/ticket.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,

    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,

    private readonly dataSource: DataSource,
  ) {}

  async purchase(ticketId: string, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      // 1. Atomic decrement
      const result = await manager.query(
        `
      UPDATE tickets
      SET remaining = remaining - 1
      WHERE id = $1
        AND remaining > 0
      RETURNING remaining
      `,
        [ticketId],
      );

      const affectedRows = result[1];

      if (affectedRows === 0) {
        throw new ConflictException('Ticket sold out');
      }

      const orderRepository = manager.getRepository(Order);

      const order = orderRepository.create({
        ticketId,
        userId,
        status: 'CONFIRMED',
      });

      return orderRepository.save(order);
    });
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
