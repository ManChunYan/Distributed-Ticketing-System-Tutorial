import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'RESERVED',
  })
  status!: string;

  @Column({
    name: 'expires_at',
    type: 'timestamptz',
  })
  expiresAt!: Date;

  @Column({
    name: 'confirmed_at',
    type: 'timestamptz',
    nullable: true,
  })
  confirmedAt!: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updatedAt!: Date;
}
