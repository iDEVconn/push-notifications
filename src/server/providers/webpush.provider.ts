import type { PushPayload, PushTarget, SendResult } from '../../index';

export interface WebPushConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  subject: string;
}

const DEAD_TOKEN_STATUS_CODES = new Set([404, 410]);

export async function sendWebPush(
  target: PushTarget & { type: 'webpush' },
  payload: PushPayload,
  config: WebPushConfig,
): Promise<SendResult> {
  const webpush = (await import('web-push')).default;
  webpush.setVapidDetails(config.subject, config.vapidPublicKey, config.vapidPrivateKey);

  try {
    await webpush.sendNotification(target.subscription, JSON.stringify(payload));
    return { target, success: true };
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode ?? 0;
    const message = (err as { body?: string }).body ?? 'Web Push send failed';
    return {
      target,
      success: false,
      error: {
        code: String(statusCode),
        message,
        isDeadToken: DEAD_TOKEN_STATUS_CODES.has(statusCode),
      },
    };
  }
}
