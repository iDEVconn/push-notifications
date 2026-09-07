import type { PushPayload, PushTarget, SendResult, PushTargetStore } from '../index';
import { sendWebPush, type WebPushConfig } from './providers/webpush.provider';
import { sendFcm, type FcmConfig } from './providers/fcm.provider';
import { sendApns, type ApnsConfig } from './providers/apns.provider';

export interface PushServiceConfig {
  webpush?: WebPushConfig;
  fcm?: FcmConfig;
  apns?: ApnsConfig;
  autoPruneOnFailure?: boolean;
}

export class ProviderNotConfiguredError extends Error {
  constructor(type: string) {
    super(`Push provider "${type}" is not configured`);
  }
}

export class PushService {
  constructor(
    private readonly config: PushServiceConfig,
    private readonly store: PushTargetStore,
  ) {}

  async send(target: PushTarget, payload: PushPayload): Promise<SendResult> {
    const result = await this.dispatch(target, payload);

    if (!result.success && result.error?.isDeadToken && (this.config.autoPruneOnFailure ?? true)) {
      try {
        await this.store.delete(target.userId, target);
      } catch {
        // Best-effort cleanup — a failed prune must not turn a captured SendResult into a thrown exception.
      }
    }

    return result;
  }

  async sendBulk(targets: PushTarget[], payload: PushPayload): Promise<SendResult[]> {
    return Promise.all(
      targets.map(async (target) => {
        try {
          return await this.send(target, payload);
        } catch (err) {
          return {
            target,
            success: false,
            error: { code: 'send-error', message: (err as Error).message, isDeadToken: false },
          };
        }
      }),
    );
  }

  async pruneTarget(userId: string, target: PushTarget): Promise<void> {
    await this.store.delete(userId, target);
  }

  private dispatch(target: PushTarget, payload: PushPayload): Promise<SendResult> {
    switch (target.type) {
      case 'webpush':
        if (!this.config.webpush) throw new ProviderNotConfiguredError('webpush');
        return sendWebPush(target, payload, this.config.webpush);
      case 'fcm':
        if (!this.config.fcm) throw new ProviderNotConfiguredError('fcm');
        return sendFcm(target, payload, this.config.fcm);
      case 'apns':
        if (!this.config.apns) throw new ProviderNotConfiguredError('apns');
        return sendApns(target, payload, this.config.apns);
    }
  }
}
