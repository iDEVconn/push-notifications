import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PushService, PushServiceConfig } from './push.service';
import { SUBSCRIPTION_STORE, SubscriptionStore } from '../index';

export interface PushNotificationModuleConfig extends PushServiceConfig {
  subscriptionStore: SubscriptionStore;
}

const CONFIG_TOKEN = Symbol('PUSH_NOTIFICATION_MODULE_CONFIG');

function validateConfig(config: PushNotificationModuleConfig): void {
  if (config.webpush) {
    const { vapidPublicKey, vapidPrivateKey, subject } = config.webpush;
    if (!vapidPublicKey || !vapidPrivateKey || !subject) {
      throw new Error('PushNotificationModule: webpush config requires vapidPublicKey, vapidPrivateKey, and subject');
    }
  }
  if (config.fcm && !config.fcm.serviceAccount) {
    throw new Error('PushNotificationModule: fcm config requires serviceAccount');
  }
  if (config.apns) {
    const { key, keyId, teamId, bundleId } = config.apns;
    if (!key || !keyId || !teamId || !bundleId) {
      throw new Error('PushNotificationModule: apns config requires key, keyId, teamId, and bundleId');
    }
  }
}

const pushServiceProvider: Provider = {
  provide: PushService,
  useFactory: (config: PushNotificationModuleConfig) => {
    validateConfig(config);
    return new PushService(config, config.subscriptionStore);
  },
  inject: [CONFIG_TOKEN],
};

const subscriptionStoreProvider: Provider = {
  provide: SUBSCRIPTION_STORE,
  useFactory: (config: PushNotificationModuleConfig) => config.subscriptionStore,
  inject: [CONFIG_TOKEN],
};

@Module({})
export class PushNotificationModule {
  static forRoot(config: PushNotificationModuleConfig): DynamicModule {
    return {
      module: PushNotificationModule,
      providers: [{ provide: CONFIG_TOKEN, useValue: config }, pushServiceProvider, subscriptionStoreProvider],
      exports: [PushService, SUBSCRIPTION_STORE],
    };
  }

  static forRootAsync(options: {
    useFactory: (...args: never[]) => PushNotificationModuleConfig | Promise<PushNotificationModuleConfig>;
    inject?: never[];
  }): DynamicModule {
    return {
      module: PushNotificationModule,
      providers: [
        { provide: CONFIG_TOKEN, useFactory: options.useFactory, inject: options.inject ?? [] },
        pushServiceProvider,
        subscriptionStoreProvider,
      ],
      exports: [PushService, SUBSCRIPTION_STORE],
    };
  }
}
