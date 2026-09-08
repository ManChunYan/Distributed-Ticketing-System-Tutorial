import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Ticket } from '../../tickets/entities/ticket.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'user_id',
    type: 'uuid',
  })
  userId: string;

  @Column({
    name: 'ticket_id',
    type: 'uuid',
  })
  ticketId: string;

  @ManyToOne(() => Ticket)
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @Column()
  status: string;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;
}
