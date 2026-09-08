import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    name: 'starts_at',
    type: 'timestamptz',
  })
  startsAt: Date;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;
}
