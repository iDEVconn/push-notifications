# @idevconn/push-notifications

## 0.2.0

### Minor Changes

- d2ef51d: Initial release: Web Push (VAPID), FCM, and APNs sending via a Nest 11 module (`PushNotificationModule`), an optional TypeORM storage adapter, opt-in `NotificationController`/`NotificationWebhookController` (each requiring a fail-closed consumer-provided authorization/verification dependency), and three React 19 hooks (`usePushPermission`, `usePushSubscription`, `usePushSubscriptionFcm`) for browser-side subscription management.
