import type { Repository } from 'typeorm';
import type { PushTarget, SubscriptionStore } from '../index';
import { PushSubscriptionEntity } from './push-subscription.entity';

export class TypeOrmSubscriptionStore implements SubscriptionStore {
  constructor(private readonly repo: Repository<PushSubscriptionEntity>) {}

  async save(userId: string, target: PushTarget): Promise<void> {
    await this.repo.save(this.repo.create({ userId, target }));
  }

  async findByUserId(userId: string): Promise<PushTarget[]> {
    const rows = await this.repo.find({ where: { userId } });
    return rows.map((row) => row.target);
  }

  async delete(userId: string, target: PushTarget): Promise<void> {
    const rows = await this.repo.find({ where: { userId } });
    const match = rows.find((row) => JSON.stringify(row.target) === JSON.stringify(target));
    if (match) await this.repo.delete(match.id);
  }

  async findAll(): Promise<PushTarget[]> {
    const rows = await this.repo.find();
    return rows.map((row) => row.target);
  }
}
