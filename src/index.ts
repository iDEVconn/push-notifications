export const SUBSCRIPTION_STORE = Symbol('SUBSCRIPTION_STORE');
export const NOTIFICATION_LOG_STORE = Symbol('NOTIFICATION_LOG_STORE');

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
