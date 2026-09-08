import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Event } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
  ) {}

  async create(dto: CreateEventDto) {
    const event = this.eventRepository.create({
      name: dto.name,
      startsAt: new Date(dto.startsAt),
    });

    return this.eventRepository.save(event);
  }
}
