# @idevconn/push-notification — Design Spec

Date: 2026-09-07
Status: Approved

## Purpose

Host-agnostic push notification package: a NestJS 11 server module for sending
push (Web Push/VAPID, FCM, APNs) and tracking notification history, plus React
19 hooks for browser-side permission/subscription management. Mirrors the
dual-export pattern of `@idevconn/ai-usage` (`.`, `./server`, `./react`).

## Scope

- **In scope**: sending push via Web Push (VAPID), FCM, APNs; subscription
  management (interface + optional TypeORM adapter); notification history
  (list unread, mark-as-read); stale-token auto-pruning; optional webhook
  controller for aggregator-style delivery reports (OneSignal etc., not
  called by the three built-in providers).
- **Out of scope**: React Native / native mobile SDKs (APNs/FCM token
  collection on native apps is the consuming app's job — this package only
  sends to tokens it's given); UI components beyond headless hooks; any
  specific DB by default.

## Package layout

```
src/
  index.ts        shared types + interfaces (exported as ".")
  server/         Nest 11 module (exported as "./server")
    push-notification.module.ts
    push.service.ts
    notification.controller.ts
    notification-webhook.controller.ts
    interfaces/
      subscription-store.interface.ts
      notification-log-store.interface.ts
    providers/
      webpush.provider.ts
      fcm.provider.ts
      apns.provider.ts
    __tests__/
  react/          React 19 hooks (exported as "./react")
    use-push-permission.ts
    use-push-subscription.ts
    use-push-subscription-fcm.ts
    __tests__/
  typeorm/        optional TypeORM adapter (exported as "./typeorm")
    push-subscription.entity.ts
    notification.entity.ts
    typeorm-subscription-store.ts
    typeorm-notification-log-store.ts
    __tests__/
```

Build via tsup, same exports-map pattern as ai-usage (import/require +
types, per sub-path). `type: module`, dual ESM/CJS output.

## Server (`./server`)

### Module

`PushNotificationModule.forRoot(config)` / `.forRootAsync(configFactory)`.

```ts
interface PushNotificationConfig {
  webpush?: { vapidPublicKey: string; vapidPrivateKey: string; subject: string };
  fcm?: { serviceAccount: object };
  apns?: { key: string; keyId: string; teamId: string; bundleId: string; production?: boolean };
  autoPruneOnFailure?: boolean; // default true
}
```

Only providers with config present are initialized; calling `send` with a
target type whose provider isn't configured throws at call time
(`ProviderNotConfiguredError`), config validation errors throw at module
init (fail fast, not swallowed).

### PushService

```ts
type PushTarget =
  | { type: 'webpush'; subscription: WebPushSubscriptionJSON; userId: string }
  | { type: 'fcm'; token: string; userId: string }
  | { type: 'apns'; token: string; userId: string };

interface SendResult {
  target: PushTarget;
  success: boolean;
  error?: { code: string; message: string; isDeadToken: boolean };
}

class PushService {
  send(target: PushTarget, payload: PushPayload): Promise<SendResult>;
  sendBulk(targets: PushTarget[], payload: PushPayload): Promise<SendResult[]>;
}
```

Dead-token detection per provider, mapped to `isDeadToken: true`:
- Web Push: HTTP 410 (Gone) / 404 from push service
- FCM: `messaging/registration-token-not-registered`, `InvalidRegistration`
- APNs: `BadDeviceToken`, `Unregistered`

When `isDeadToken` and `autoPruneOnFailure` (default true), `PushService`
calls `SubscriptionStore.delete` internally after the send — no separate
cleanup job needed for the three built-in providers.

Provider SDKs (`web-push`, `firebase-admin`, `@parse/node-apn`) are optional
peer deps, lazy-`require`d inside each provider file so installing the
package doesn't force all three.

### Storage interfaces

```ts
interface SubscriptionStore {
  save(userId: string, target: PushTarget): Promise<void>;
  findByUserId(userId: string): Promise<PushTarget[]>;
  delete(userId: string, target: PushTarget): Promise<void>;
  findAll(): Promise<PushTarget[]>;
}

interface NotificationLogStore {
  save(record: { userId: string; title: string; body: string }): Promise<NotificationRecord>;
  findUnreadByUserId(userId: string): Promise<NotificationRecord[]>;
  markAsRead(id: string): Promise<void>;
}
```

Injected via tokens `SUBSCRIPTION_STORE` / `NOTIFICATION_LOG_STORE`. Consumer
provides an implementation bound to their own DB. No default in-memory
implementation shipped (forces explicit wiring, avoids silent data loss in
prod if someone forgets to configure real storage).

### NotificationController

```
GET   /notifications/:userId    -> unread list, newest first
PATCH /notifications/:id/read   -> mark as read
```

Built against `NotificationLogStore` only — works with any adapter
(TypeORM or custom). Registered by the module; consumer can disable by not
importing the controller (module exposes it as a separate importable piece,
not force-mounted).

### NotificationWebhookController (opt-in)

```
POST /webhooks/notifications/delivery-report
```

For aggregator services (OneSignal, Airship, etc.) that push async delivery
status. **Not wired by the three built-in providers** — web-push/FCM/APNs
report failures synchronously in the send response, not via webhook. This
controller is exported separately and only mounted if the consumer imports
it explicitly; doc comment on the class states plainly it has no effect
unless an aggregator is configured to call it.

### TypeORM adapter (`./typeorm`)

`PushSubscriptionEntity`, `NotificationEntity` (mirrors the Google-suggested
shape: `id`, `userId`, `title`, `body`, `isRead`, `createdAt`) +
`TypeOrmSubscriptionStore`, `TypeOrmNotificationLogStore` implementing the
two interfaces above via `@InjectRepository`. Peer deps `typeorm`,
`@nestjs/typeorm` optional. Consumer registers entities in their
`TypeOrmModule.forFeature([...])` and provides the store classes under the
`SUBSCRIPTION_STORE`/`NOTIFICATION_LOG_STORE` tokens.

## React 19 (`./react`, web only)

```ts
usePushPermission(): { permission: NotificationPermission; request(): Promise<NotificationPermission> }

usePushSubscription(opts: { vapidPublicKey: string; swPath: string }): {
  subscription: PushSubscription | null;
  status: 'idle' | 'subscribing' | 'subscribed' | 'error';
  subscribe(): Promise<void>;
  unsubscribe(): Promise<void>;
}

usePushSubscriptionFcm(opts: { firebaseConfig: object; vapidKey: string }): {
  token: string | null;
  status: 'idle' | 'subscribing' | 'subscribed' | 'error';
  subscribe(): Promise<void>;
}
```

SSR-safe: all hooks no-op (return idle state) when `window`/`Notification`
undefined. `firebase` (client SDK) optional peer dep, dynamically imported.

No APNs hook — no web surface for it; native app collects that token itself
and posts it to the consumer's backend, which stores it via
`SubscriptionStore` and sends via `PushService` with `type: 'apns'`.

## Error handling

- Per-target send failures never throw — captured in `SendResult.error`,
  `sendBulk` always resolves with one result per target.
- Config/init errors throw synchronously at module bootstrap — fail fast on
  misconfiguration rather than failing silently on first send.
- Webhook controller returns `{ received: true }` on any parseable body;
  malformed body → 400, never crashes the process.

## Testing

vitest, mirroring ai-usage's `__tests__` per-directory layout.
- `PushService`: mock `web-push`/`firebase-admin`/`node-apn`, assert
  dead-token codes trigger `SubscriptionStore.delete` when
  `autoPruneOnFailure` true, assert `sendBulk` isolates per-target failures.
- `NotificationController`/`NotificationWebhookController`: Nest testing
  module with mock stores.
- TypeORM adapter: in-memory sqlite via TypeORM testing pattern.
- React hooks: jsdom + mocked `Notification`, `navigator.serviceWorker`,
  `PushManager`, and mocked `firebase/messaging` for the FCM hook.

## Open items for implementation plan

None — scope, interfaces, and provider behavior are fully specified above.
