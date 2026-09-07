import { describe, it, expect } from 'vitest';
import {
  SUBSCRIPTION_STORE,
  NOTIFICATION_LOG_STORE,
  NOTIFICATION_AUTHORIZER,
  NOTIFICATION_WEBHOOK_VERIFIER,
} from '../index';

const TOKENS = [SUBSCRIPTION_STORE, NOTIFICATION_LOG_STORE, NOTIFICATION_AUTHORIZER, NOTIFICATION_WEBHOOK_VERIFIER];

describe('DI tokens', () => {
  it('are unique symbols', () => {
    for (const token of TOKENS) {
      expect(typeof token).toBe('symbol');
    }
    expect(new Set(TOKENS).size).toBe(TOKENS.length);
  });
});
