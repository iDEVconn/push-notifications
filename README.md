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

See `docs/superpowers/specs/2026-09-07-push-notification-design.md` for full design rationale.
