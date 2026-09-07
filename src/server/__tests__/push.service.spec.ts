import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sendWebPushMock, sendFcmMock, sendApnsMock } = vi.hoisted(() => ({
  sendWebPushMock: vi.fn(),
  sendFcmMock: vi.fn(),
  sendApnsMock: vi.fn(),
}));

vi.mock('../providers/webpush.provider', () => ({ sendWebPush: sendWebPushMock }));
vi.mock('../providers/fcm.provider', () => ({ sendFcm: sendFcmMock }));
vi.mock('../providers/apns.provider', () => ({ sendApns: sendApnsMock }));

import { PushService, ProviderNotConfiguredError } from '../push.service';
import type { PushTarget, SubscriptionStore } from '../../index';

const webpushTarget: PushTarget = {
  type: 'webpush',
  userId: 'user-1',
  subscription: { endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } },
};
const fcmTarget: PushTarget = { type: 'fcm', userId: 'user-1', token: 'tok-1' };

function makeStore(): SubscriptionStore {
  return {
    save: vi.fn(),
    findByUserId: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
  };
}

beforeEach(() => {
  sendWebPushMock.mockReset();
  sendFcmMock.mockReset();
  sendApnsMock.mockReset();
});

describe('PushService', () => {
  it('dispatches webpush target to sendWebPush', async () => {
    sendWebPushMock.mockResolvedValue({ target: webpushTarget, success: true });
    const store = makeStore();
    const service = new PushService({ webpush: { vapidPublicKey: 'a', vapidPrivateKey: 'b', subject: 'c' } }, store);

    const result = await service.send(webpushTarget, { title: 't', body: 'b' });

    expect(sendWebPushMock).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });

  it('throws ProviderNotConfiguredError when provider config missing', async () => {
    const store = makeStore();
    const service = new PushService({}, store);

    await expect(service.send(fcmTarget, { title: 't', body: 'b' })).rejects.toThrow(ProviderNotConfiguredError);
  });

  it('auto-prunes dead tokens when autoPruneOnFailure is true (default)', async () => {
    sendFcmMock.mockResolvedValue({
      target: fcmTarget,
      success: false,
      error: { code: 'InvalidRegistration', message: 'dead', isDeadToken: true },
    });
    const store = makeStore();
    const service = new PushService({ fcm: { serviceAccount: {} } }, store);

    await service.send(fcmTarget, { title: 't', body: 'b' });

    expect(store.delete).toHaveBeenCalledWith('user-1', fcmTarget);
  });

  it('does not prune when autoPruneOnFailure is false', async () => {
    sendFcmMock.mockResolvedValue({
      target: fcmTarget,
      success: false,
      error: { code: 'InvalidRegistration', message: 'dead', isDeadToken: true },
    });
    const store = makeStore();
    const service = new PushService({ fcm: { serviceAccount: {} }, autoPruneOnFailure: false }, store);

    await service.send(fcmTarget, { title: 't', body: 'b' });

    expect(store.delete).not.toHaveBeenCalled();
  });

  it('sendBulk isolates per-target failures', async () => {
    sendFcmMock
      .mockResolvedValueOnce({ target: fcmTarget, success: true })
      .mockRejectedValueOnce(new Error('network down'));
    const secondTarget: PushTarget = { type: 'fcm', userId: 'user-2', token: 'tok-2' };
    const store = makeStore();
    const service = new PushService({ fcm: { serviceAccount: {} } }, store);

    const results = await service.sendBulk([fcmTarget, secondTarget], { title: 't', body: 'b' });

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
  });
});
