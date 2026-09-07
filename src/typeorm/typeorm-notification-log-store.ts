import type { Repository } from 'typeorm';
import type { NotificationLogStore, NotificationRecord } from '../index';
import { NotificationEntity } from './notification.entity';

export class TypeOrmNotificationLogStore implements NotificationLogStore {
  // Tracks the last createdAt (ms since epoch) issued by this store instance,
  // so back-to-back saves always get a strictly increasing timestamp.
  private lastTimestampMs = 0;

  constructor(private readonly repo: Repository<NotificationEntity>) {}

  async save(record: { userId: string; title: string; body: string }): Promise<NotificationRecord> {
    // Explicitly stamp createdAt in JS rather than relying on @CreateDateColumn's
    // DB-side default. On SQLite, TypeORM inlines the column default
    // (`datetime('now')`) literally into the INSERT statement (SQLite has no
    // DEFAULT-expression support in INSERT), and SQLite's datetime('now') only
    // has whole-second resolution. Two saves within the same second/millisecond
    // then get identical createdAt values, making `ORDER BY createdAt DESC`
    // unable to distinguish them (ties resolve to insertion order, not
    // reverse-insertion order). Monotonically bumping the timestamp here
    // guarantees strictly increasing createdAt values for saves issued by this
    // store instance, regardless of clock/DB resolution.
    const now = Date.now();
    this.lastTimestampMs = now > this.lastTimestampMs ? now : this.lastTimestampMs + 1;
    const saved = await this.repo.save(
      this.repo.create({ ...record, createdAt: new Date(this.lastTimestampMs) }),
    );
    return saved;
  }

  async findUnreadByUserId(userId: string): Promise<NotificationRecord[]> {
    return this.repo.find({ where: { userId, isRead: false }, order: { createdAt: 'DESC' } });
  }

  async markAsRead(id: string): Promise<void> {
    await this.repo.update(id, { isRead: true });
  }
}
