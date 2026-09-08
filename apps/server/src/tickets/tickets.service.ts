import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Ticket } from './entities/ticket.entity';
import { Event } from '../events/entities/event.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,

    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
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
}
