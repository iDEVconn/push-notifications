import type { PushPayload, PushTarget, SendResult } from '../../index';

export interface WebPushConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  subject: string;
}

const DEAD_TOKEN_STATUS_CODES = new Set([404, 410]);

const PRIVATE_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
  /^f[cd][0-9a-f]{2}:/i,
  /^fe80:/i,
];

function isDisallowedEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return true;
  }
  if (url.protocol !== 'https:') return true;
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  return PRIVATE_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname));
}

export async function sendWebPush(
  target: PushTarget & { type: 'webpush' },
  payload: PushPayload,
  config: WebPushConfig,
): Promise<SendResult> {
  // target.subscription.endpoint is client-submitted and stored by the consumer app —
  // reject anything that isn't an https push-service URL before handing it to web-push,
  // so this provider can't be used as an SSRF proxy against internal/loopback hosts.
  if (isDisallowedEndpoint(target.subscription.endpoint)) {
    return {
      target,
      success: false,
      error: { code: 'invalid-endpoint', message: 'Web Push endpoint is not an allowed https destination', isDeadToken: false },
    };
  }

  const webpush = (await import('web-push')).default;
  webpush.setVapidDetails(config.subject, config.vapidPublicKey, config.vapidPrivateKey);

  try {
    await webpush.sendNotification(target.subscription, JSON.stringify(payload));
    return { target, success: true };
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode ?? 0;
    return {
      target,
      success: false,
      error: {
        code: String(statusCode),
        // Don't propagate the raw upstream response body — it may echo back
        // content from a host we didn't intend to contact.
        message: 'Web Push send failed',
        isDeadToken: DEAD_TOKEN_STATUS_CODES.has(statusCode),
      },
    };
  }
}
