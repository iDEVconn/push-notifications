export const SUBSCRIPTION_STORE = Symbol('SUBSCRIPTION_STORE');
export const NOTIFICATION_LOG_STORE = Symbol('NOTIFICATION_LOG_STORE');
export const NOTIFICATION_AUTHORIZER = Symbol('NOTIFICATION_AUTHORIZER');
export const NOTIFICATION_WEBHOOK_VERIFIER = Symbol('NOTIFICATION_WEBHOOK_VERIFIER');

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, unknown>;
}

export interface WebPushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export type PushTarget =
  | { type: 'webpush'; userId: string; subscription: WebPushSubscriptionJSON }
  | { type: 'fcm'; userId: string; token: string }
  | { type: 'apns'; userId: string; token: string };

export interface SendError {
  code: string;
  message: string;
  isDeadToken: boolean;
}

export interface SendResult {
  target: PushTarget;
  success: boolean;
  error?: SendError;
}

export interface SubscriptionStore {
  save(userId: string, target: PushTarget): Promise<void>;
  findByUserId(userId: string): Promise<PushTarget[]>;
  delete(userId: string, target: PushTarget): Promise<void>;
  findAll(): Promise<PushTarget[]>;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
}

export interface NotificationLogStore {
  save(record: { userId: string; title: string; body: string }): Promise<NotificationRecord>;
  findUnreadByUserId(userId: string): Promise<NotificationRecord[]>;
  markAsRead(id: string): Promise<void>;
}

/**
 * Authorizes access to notification data. `request` is the raw HTTP
 * request object (typed `unknown` to stay HTTP-adapter-agnostic — cast it
 * to your framework's request type, e.g. Express's `Request`, to read
 * whatever identity your auth middleware attached). This package has no
 * opinion on auth strategy; providing a `NOTIFICATION_AUTHORIZER` is
 * required to use `NotificationController` — there is no default
 * implementation, so a consumer cannot wire the controller without
 * deciding how access is checked.
 */
export interface NotificationAuthorizer {
  authorizeUserAccess(request: unknown, userId: string): boolean | Promise<boolean>;
  authorizeNotificationAccess(request: unknown, notificationId: string): boolean | Promise<boolean>;
}

/**
 * Verifies an inbound delivery-report webhook actually came from the
 * configured aggregator (OneSignal, Airship, etc.) — e.g. checking an
 * HMAC signature header against a shared secret. `request` is typed
 * `unknown` for the same host-agnostic reason as `NotificationAuthorizer`.
 * Required to use `NotificationWebhookController` — without it, anyone
 * who can reach the endpoint could fabricate a "failed" delivery report
 * and prune an arbitrary user's push subscription.
 */
export interface NotificationWebhookVerifier {
  verify(request: unknown): boolean | Promise<boolean>;
}
