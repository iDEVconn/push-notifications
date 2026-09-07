import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { PushService, PushServiceConfig } from './push.service';
import { PUSH_TARGET_STORE, PushTargetStore } from '../index';

export interface PushNotificationModuleConfig extends PushServiceConfig {
  pushTargetStore: PushTargetStore;
}

const CONFIG_TOKEN = Symbol('PUSH_NOTIFICATION_MODULE_CONFIG');

function validateConfig(config: PushNotificationModuleConfig): void {
  if (!config.pushTargetStore) {
    throw new Error('PushNotificationModule: pushTargetStore is required');
  }
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
    return new PushService(config, config.pushTargetStore);
  },
  inject: [CONFIG_TOKEN],
};

const pushTargetStoreProvider: Provider = {
  provide: PUSH_TARGET_STORE,
  useFactory: (config: PushNotificationModuleConfig) => config.pushTargetStore,
  inject: [CONFIG_TOKEN],
};

@Module({})
export class PushNotificationModule {
  static forRoot(config: PushNotificationModuleConfig): DynamicModule {
    return {
      module: PushNotificationModule,
      providers: [{ provide: CONFIG_TOKEN, useValue: config }, pushServiceProvider, pushTargetStoreProvider],
      exports: [PushService, PUSH_TARGET_STORE],
    };
  }

  static forRootAsync(options: {
    // `any[]` matches Nest's own FactoryProvider.useFactory type — the args' real
    // types depend entirely on what the consumer's own `inject` tokens resolve to
    // (e.g. `ConfigService`), which this generic wrapper has no way to know ahead
    // of time. `unknown[]` would reject exactly that usage under strict function
    // parameter checking, so this isn't a lazy escape hatch.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (...args: any[]) => PushNotificationModuleConfig | Promise<PushNotificationModuleConfig>;
    inject?: (InjectionToken | OptionalFactoryDependency)[];
  }): DynamicModule {
    return {
      module: PushNotificationModule,
      providers: [
        { provide: CONFIG_TOKEN, useFactory: options.useFactory, inject: options.inject ?? [] },
        pushServiceProvider,
        pushTargetStoreProvider,
      ],
      exports: [PushService, PUSH_TARGET_STORE],
    };
  }
}
