import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Ticket } from './entities/ticket.entity';
import { Event } from '../events/entities/event.entity';
import { Order } from '../orders/entities/order.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,

    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,

    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async create(eventId: string, dto: CreateTicketDto) {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const ticket = this.ticketRepository.create({
      eventId,
      total: dto.total,
      remaining: dto.total,
    });

    return this.ticketRepository.save(ticket);
  }

  async getStats(ticketId: string) {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const orderCount = await this.orderRepository.count({
      where: {
        ticketId,
      },
    });

    return {
      initialStock: ticket.total,
      remainingStock: ticket.remaining,
      orderCount,
      oversold: Math.max(0, orderCount - ticket.total),
      isOversold: orderCount > ticket.total,
    };
  }
}
