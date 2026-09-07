# @idevconn/push-notifications

Host-agnostic push notifications for Nest 11 + React 19: Web Push (VAPID),
FCM, and APNs sending, subscription management, and notification history.

## Install

```bash
npm install @idevconn/push-notifications
# plus whichever providers you use:
npm install web-push        # Web Push
npm install firebase-admin   # FCM
npm install @parse/node-apn  # APNs
npm install typeorm @nestjs/typeorm  # optional TypeORM storage adapter
npm install firebase         # FCM web token hook (client)
```

## Server (Nest 11)

```ts
import { PushNotificationModule } from '@idevconn/push-notifications/server';

@Module({
  imports: [
    PushNotificationModule.forRoot({
      webpush: { vapidPublicKey, vapidPrivateKey, subject: 'mailto:you@example.com' },
      fcm: { serviceAccount },
      apns: { key, keyId, teamId, bundleId },
      subscriptionStore: myStore, // implements SubscriptionStore
    }),
  ],
})
export class AppModule {}
```

## React 19

```ts
import { usePushPermission, usePushSubscription } from '@idevconn/push-notifications/react';
```

## TypeORM adapter

```ts
import { PushSubscriptionEntity, TypeOrmSubscriptionStore } from '@idevconn/push-notifications/typeorm';
```

## Custom storage (Supabase, MongoDB, raw Postgres/MySQL, etc.)

The TypeORM adapter above is just one pre-built option. `SubscriptionStore` and
`NotificationLogStore` are plain interfaces — this package has no opinion on
your database. Implement the four methods against whatever client you
already use and pass it as `subscriptionStore`/`notificationLogStore`.

```ts
interface SubscriptionStore {
  save(userId: string, target: PushTarget): Promise<void>;
  findByUserId(userId: string): Promise<PushTarget[]>;
  delete(userId: string, target: PushTarget): Promise<void>;
  findAll(): Promise<PushTarget[]>;
}
```

**Supabase** (table `push_subscriptions(user_id text, target jsonb)`):

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SubscriptionStore, PushTarget } from '@idevconn/push-notifications';

export class SupabaseSubscriptionStore implements SubscriptionStore {
  constructor(private readonly supabase: SupabaseClient) {}

  async save(userId: string, target: PushTarget): Promise<void> {
    await this.supabase.from('push_subscriptions').insert({ user_id: userId, target });
  }

  async findByUserId(userId: string): Promise<PushTarget[]> {
    const { data } = await this.supabase.from('push_subscriptions').select('target').eq('user_id', userId);
    return (data ?? []).map((row) => row.target as PushTarget);
  }

  async delete(userId: string, target: PushTarget): Promise<void> {
    await this.supabase.from('push_subscriptions').delete().eq('user_id', userId).contains('target', target);
  }

  async findAll(): Promise<PushTarget[]> {
    const { data } = await this.supabase.from('push_subscriptions').select('target');
    return (data ?? []).map((row) => row.target as PushTarget);
  }
}

// PushNotificationModule.forRoot({ ..., subscriptionStore: new SupabaseSubscriptionStore(supabase) })
```

**MongoDB** (collection `pushSubscriptions` with `{ userId, target }` documents):

```ts
import type { Collection } from 'mongodb';
import type { SubscriptionStore, PushTarget } from '@idevconn/push-notifications';

export class MongoSubscriptionStore implements SubscriptionStore {
  constructor(private readonly collection: Collection<{ userId: string; target: PushTarget }>) {}

  async save(userId: string, target: PushTarget): Promise<void> {
    await this.collection.insertOne({ userId, target });
  }

  async findByUserId(userId: string): Promise<PushTarget[]> {
    const docs = await this.collection.find({ userId }).toArray();
    return docs.map((doc) => doc.target);
  }

  async delete(userId: string, target: PushTarget): Promise<void> {
    await this.collection.deleteOne({ userId, target });
  }

  async findAll(): Promise<PushTarget[]> {
    const docs = await this.collection.find({}).toArray();
    return docs.map((doc) => doc.target);
  }
}
```

**Raw Postgres/MySQL** (`pg`/`mysql2`, table with a `target` JSON column): same
four methods — `save` is an `INSERT`, `findByUserId` a `SELECT ... WHERE user_id = ?`,
`delete` a `DELETE ... WHERE user_id = ? AND target = ?` (compare on the JSON
column or an extracted token/endpoint column), `findAll` a plain `SELECT`.
`NotificationLogStore` follows the identical pattern for whichever store you
pick — implement `save`/`findUnreadByUserId`/`markAsRead` the same way.

See `docs/superpowers/specs/2026-09-07-push-notification-design.md` for full design rationale.
