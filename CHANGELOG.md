# @idevconn/push-notifications

## 1.0.0

### Major Changes

- 7486ca6: BREAKING: renamed the storage abstraction away from "Subscription" (which collided with unrelated business-domain "Subscription" services in consuming apps) to "Target", matching the vocabulary already used everywhere else in this package (`PushTarget`, `PushService.send(target, ...)`).
  
  - `SubscriptionStore` → `PushTargetStore`
  - `SUBSCRIPTION_STORE` → `PUSH_TARGET_STORE`
  - `PushNotificationModuleConfig.subscriptionStore` → `pushTargetStore`
  - `PushSubscriptionEntity` → `PushTargetEntity` (from `./typeorm`)
  - `TypeOrmSubscriptionStore` → `TypeOrmPushTargetStore` (from `./typeorm`)
  
  `usePushSubscription` (the React hook) and `WebPushSubscriptionJSON` are unchanged — both mirror the browser's native Web Push API vocabulary (`PushSubscription`), not this package's storage abstraction, and don't collide with a backend "Subscription" service.
  
  Migration: rename `SubscriptionStore` implementations to implement `PushTargetStore` instead (same method signatures), update the DI token import, and rename the `subscriptionStore` config key to `pushTargetStore` in any `PushNotificationModule.forRoot`/`forRootAsync` call.

## 0.2.0

### Minor Changes

- d2ef51d: Initial release: Web Push (VAPID), FCM, and APNs sending via a Nest 11 module (`PushNotificationModule`), an optional TypeORM storage adapter, opt-in `NotificationController`/`NotificationWebhookController` (each requiring a fail-closed consumer-provided authorization/verification dependency), and three React 19 hooks (`usePushPermission`, `usePushSubscription`, `usePushSubscriptionFcm`) for browser-side subscription management.
