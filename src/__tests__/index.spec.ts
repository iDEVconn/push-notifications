import { describe, it, expect } from 'vitest';
import { SUBSCRIPTION_STORE, NOTIFICATION_LOG_STORE, NOTIFICATION_AUTHORIZER } from '../index';

describe('DI tokens', () => {
  it('are unique symbols', () => {
    expect(typeof SUBSCRIPTION_STORE).toBe('symbol');
    expect(typeof NOTIFICATION_LOG_STORE).toBe('symbol');
    expect(typeof NOTIFICATION_AUTHORIZER).toBe('symbol');
    expect(SUBSCRIPTION_STORE).not.toBe(NOTIFICATION_LOG_STORE);
    expect(SUBSCRIPTION_STORE).not.toBe(NOTIFICATION_AUTHORIZER);
    expect(NOTIFICATION_LOG_STORE).not.toBe(NOTIFICATION_AUTHORIZER);
  });
});
