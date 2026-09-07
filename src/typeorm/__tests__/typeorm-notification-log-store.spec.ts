import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DataSource } from 'typeorm';
import { NotificationEntity } from '../notification.entity';
import { TypeOrmNotificationLogStore } from '../typeorm-notification-log-store';

let dataSource: DataSource;
let store: TypeOrmNotificationLogStore;

beforeEach(async () => {
  dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [NotificationEntity],
    synchronize: true,
  });
  await dataSource.initialize();
  store = new TypeOrmNotificationLogStore(dataSource.getRepository(NotificationEntity));
});

afterEach(async () => dataSource.destroy());

describe('TypeOrmNotificationLogStore', () => {
  it('saves a record and finds unread by userId', async () => {
    await store.save({ userId: 'user-1', title: 't', body: 'b' });
    const unread = await store.findUnreadByUserId('user-1');
    expect(unread).toHaveLength(1);
    expect(unread[0].isRead).toBe(false);
  });

  it('markAsRead excludes it from unread results', async () => {
    const record = await store.save({ userId: 'user-1', title: 't', body: 'b' });
    await store.markAsRead(record.id);
    expect(await store.findUnreadByUserId('user-1')).toEqual([]);
  });

  it('orders unread results newest first', async () => {
    await store.save({ userId: 'user-1', title: 'first', body: 'b' });
    await store.save({ userId: 'user-1', title: 'second', body: 'b' });
    const unread = await store.findUnreadByUserId('user-1');
    expect(unread[0].title).toBe('second');
  });
});
