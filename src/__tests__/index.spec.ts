import { describe, it, expect } from 'vitest';
import { SUBSCRIPTION_STORE, NOTIFICATION_LOG_STORE } from '../index';

describe('DI tokens', () => {
  it('are unique symbols', () => {
    expect(typeof SUBSCRIPTION_STORE).toBe('symbol');
    expect(typeof NOTIFICATION_LOG_STORE).toBe('symbol');
    expect(SUBSCRIPTION_STORE).not.toBe(NOTIFICATION_LOG_STORE);
  });
});
