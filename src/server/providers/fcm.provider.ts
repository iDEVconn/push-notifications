import type { PushPayload, PushTarget, SendResult } from '../../index';

export interface FcmConfig {
  serviceAccount: object;
}

const DEAD_TOKEN_CODES = new Set(['messaging/registration-token-not-registered', 'InvalidRegistration']);

let cachedApp: unknown;

async function getMessaging(config: FcmConfig) {
  const admin = (await import('firebase-admin')).default;
  if (!cachedApp) {
    cachedApp = admin.apps.length
      ? admin.apps[0]
      : admin.initializeApp({ credential: admin.credential.cert(config.serviceAccount as never) });
  }
  return admin.messaging();
}

export async function sendFcm(
  target: PushTarget & { type: 'fcm' },
  payload: PushPayload,
  config: FcmConfig,
): Promise<SendResult> {
  try {
    const messaging = await getMessaging(config);
    await messaging.send({
      token: target.token,
      notification: { title: payload.title, body: payload.body },
      data: payload.data as Record<string, string> | undefined,
    });
    return { target, success: true };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'unknown';
    const message = (err as { message?: string }).message ?? 'FCM send failed';
    return {
      target,
      success: false,
      error: { code, message, isDeadToken: DEAD_TOKEN_CODES.has(code) },
    };
  }
}
