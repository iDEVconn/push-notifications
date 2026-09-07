---
"@idevconn/push-notifications": major
---

BREAKING: renamed the storage abstraction away from "Subscription" (which collided with unrelated business-domain "Subscription" services in consuming apps) to "Target", matching the vocabulary already used everywhere else in this package (`PushTarget`, `PushService.send(target, ...)`).

- `SubscriptionStore` → `PushTargetStore`
- `SUBSCRIPTION_STORE` → `PUSH_TARGET_STORE`
- `PushNotificationModuleConfig.subscriptionStore` → `pushTargetStore`
- `PushSubscriptionEntity` → `PushTargetEntity` (from `./typeorm`)
- `TypeOrmSubscriptionStore` → `TypeOrmPushTargetStore` (from `./typeorm`)

`usePushSubscription` (the React hook) and `WebPushSubscriptionJSON` are unchanged — both mirror the browser's native Web Push API vocabulary (`PushSubscription`), not this package's storage abstraction, and don't collide with a backend "Subscription" service.

Migration: rename `SubscriptionStore` implementations to implement `PushTargetStore` instead (same method signatures), update the DI token import, and rename the `subscriptionStore` config key to `pushTargetStore` in any `PushNotificationModule.forRoot`/`forRootAsync` call.
