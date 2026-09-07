import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DataSource } from 'typeorm';
import { PushSubscriptionEntity } from '../push-subscription.entity';
import { TypeOrmSubscriptionStore } from '../typeorm-subscription-store';
import type { PushTarget } from '../../index';

let dataSource: DataSource;
let store: TypeOrmSubscriptionStore;

beforeEach(async () => {
  dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [PushSubscriptionEntity],
    synchronize: true,
  });
  await dataSource.initialize();
  store = new TypeOrmSubscriptionStore(dataSource.getRepository(PushSubscriptionEntity));
});

afterEach(async () => dataSource.destroy());

const target: PushTarget = { type: 'fcm', userId: 'user-1', token: 'tok-1' };

describe('TypeOrmSubscriptionStore', () => {
  it('saves and finds by userId', async () => {
    await store.save('user-1', target);
    const found = await store.findByUserId('user-1');
    expect(found).toEqual([target]);
  });

  it('deletes a target', async () => {
    await store.save('user-1', target);
    await store.delete('user-1', target);
    expect(await store.findByUserId('user-1')).toEqual([]);
  });

  it('findAll returns targets across users', async () => {
    await store.save('user-1', target);
    await store.save('user-2', { type: 'fcm', userId: 'user-2', token: 'tok-2' });
    expect(await store.findAll()).toHaveLength(2);
  });
});
