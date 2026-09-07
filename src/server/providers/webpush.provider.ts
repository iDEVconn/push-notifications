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
  // IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1, normalized by the WHATWG URL
  // parser to ::ffff:7f00:1) tunnel an arbitrary IPv4 target through an IPv6 literal.
  // Block the whole ::ffff:/96 range rather than trying to enumerate the private ranges
  // in their hex-encoded form — this guard's job is to be restrictive, not permissive.
  /^::ffff:/i,
];

function isDisallowedEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return true;
  }
  if (url.protocol !== 'https:') return true;
  // Strip a trailing root "." (e.g. "localhost.") — DNS resolves it identically to the
  // name without the dot, so it must not bypass the pattern checks below.
  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
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

  try {
    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails(config.subject, config.vapidPublicKey, config.vapidPrivateKey);

    await webpush.sendNotification(target.subscription, JSON.stringify(payload));
    return { target, success: true };
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode ?? 0;
    return {
      target,
      success: false,
      error: {
        // A missing/zero statusCode means this never reached the push service —
        // it's an SDK-load or init failure (bad import, malformed VAPID config), not a send failure.
        code: statusCode ? String(statusCode) : 'init-error',
        // Don't propagate the raw upstream response body — it may echo back
        // content from a host we didn't intend to contact.
        message: 'Web Push send failed',
        isDeadToken: DEAD_TOKEN_STATUS_CODES.has(statusCode),
      },
    };
  }
}
