import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { PushNotificationModule, PushNotificationModuleConfig } from '../push-notification.module';
import { PushService } from '../push.service';
import { SUBSCRIPTION_STORE } from '../../index';

const dummyStore = { save: async () => {}, findByUserId: async () => [], delete: async () => {}, findAll: async () => [] };

describe('PushNotificationModule', () => {
  it('forRoot registers PushService with given config', async () => {
    const config: PushNotificationModuleConfig = {
      webpush: { vapidPublicKey: 'a', vapidPrivateKey: 'b', subject: 'c' },
      subscriptionStore: dummyStore,
    };
    const moduleRef = await Test.createTestingModule({
      imports: [PushNotificationModule.forRoot(config)],
    }).compile();

    expect(moduleRef.get(PushService)).toBeInstanceOf(PushService);
    expect(moduleRef.get(SUBSCRIPTION_STORE)).toBe(dummyStore);
  });

  it('forRootAsync resolves config via factory', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PushNotificationModule.forRootAsync({
          useFactory: () => ({ fcm: { serviceAccount: {} }, subscriptionStore: dummyStore }),
        }),
      ],
    }).compile();

    expect(moduleRef.get(PushService)).toBeInstanceOf(PushService);
  });

  it('throws at bootstrap when webpush config is missing required fields', async () => {
    const badConfig = { webpush: { vapidPublicKey: 'a' } as never, subscriptionStore: dummyStore };
    await expect(
      Test.createTestingModule({ imports: [PushNotificationModule.forRoot(badConfig)] }).compile(),
    ).rejects.toThrow(/webpush/i);
  });
});
