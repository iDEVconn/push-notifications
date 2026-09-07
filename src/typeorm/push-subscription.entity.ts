import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import type { PushTarget } from '../index';

@Entity()
export class PushSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column({ type: 'simple-json' })
  target!: PushTarget;

  @CreateDateColumn()
  createdAt!: Date;
}
