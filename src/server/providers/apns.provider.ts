import type { PushPayload, PushTarget, SendResult } from '../../index';

export interface ApnsConfig {
  key: string;
  keyId: string;
  teamId: string;
  bundleId: string;
  production?: boolean;
}

const DEAD_TOKEN_REASONS = new Set(['BadDeviceToken', 'Unregistered']);

let cachedProvider: { send: (n: unknown, t: string) => Promise<{ failed: { response?: { reason?: string } }[] }> } | undefined;

async function getProvider(config: ApnsConfig) {
  const apn = (await import('@parse/node-apn')).default;
  if (!cachedProvider) {
    cachedProvider = new apn.Provider({
      token: { key: config.key, keyId: config.keyId, teamId: config.teamId },
      production: config.production ?? false,
    }) as never;
  }
  return { apn, provider: cachedProvider! };
}

export async function sendApns(
  target: PushTarget & { type: 'apns' },
  payload: PushPayload,
  config: ApnsConfig,
): Promise<SendResult> {
  try {
    const { apn, provider } = await getProvider(config);

    const notification = new apn.Notification();
    notification.alert = { title: payload.title, body: payload.body };
    notification.topic = config.bundleId;
    notification.payload = payload.data ?? {};

    const response = await provider.send(notification, target.token);
    const failure = response.failed[0];

    if (!failure) {
      return { target, success: true };
    }

    const reason = failure.response?.reason ?? 'Unknown';
    return {
      target,
      success: false,
      error: { code: reason, message: `APNs send failed: ${reason}`, isDeadToken: DEAD_TOKEN_REASONS.has(reason) },
    };
  } catch (err) {
    return {
      target,
      success: false,
      error: { code: 'apns-error', message: (err as Error).message ?? 'APNs send failed', isDeadToken: false },
    };
  }
}
