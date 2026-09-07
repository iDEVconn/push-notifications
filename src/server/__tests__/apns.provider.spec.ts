import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMock = vi.fn();

class MockProvider {
  send = sendMock;
}
class MockNotification {
  alert = '';
  topic = '';
  payload: Record<string, unknown> = {};
}

vi.mock('@parse/node-apn', () => ({
  default: { Provider: MockProvider, Notification: MockNotification },
}));

import { sendApns } from '../providers/apns.provider';
import type { PushTarget } from '../../index';

const target: PushTarget = { type: 'apns', userId: 'user-1', token: 'device-token-abc' };
const config = { key: 'key-contents', keyId: 'KEYID', teamId: 'TEAMID', bundleId: 'com.example.app' };

beforeEach(() => sendMock.mockReset());

describe('sendApns', () => {
  it('returns success when no failures reported', async () => {
    sendMock.mockResolvedValue({ sent: [{ device: target.token }], failed: [] });
    const result = await sendApns(target, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(true);
  });

  it('flags dead token on BadDeviceToken', async () => {
    sendMock.mockResolvedValue({
      sent: [],
      failed: [{ device: target.token, response: { reason: 'BadDeviceToken' } }],
    });
    const result = await sendApns(target, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(false);
    expect(result.error?.isDeadToken).toBe(true);
    expect(result.error?.code).toBe('BadDeviceToken');
  });

  it('flags dead token on Unregistered', async () => {
    sendMock.mockResolvedValue({
      sent: [],
      failed: [{ device: target.token, response: { reason: 'Unregistered' } }],
    });
    const result = await sendApns(target, { title: 't', body: 'b' }, config);
    expect(result.error?.isDeadToken).toBe(true);
  });

  it('returns non-fatal error for other reasons', async () => {
    sendMock.mockResolvedValue({
      sent: [],
      failed: [{ device: target.token, response: { reason: 'PayloadTooLarge' } }],
    });
    const result = await sendApns(target, { title: 't', body: 'b' }, config);
    expect(result.error?.isDeadToken).toBe(false);
  });

  it('returns a failure result rather than throwing when Provider construction fails', async () => {
    // cachedProvider is module-scoped in apns.provider.ts and already populated by the earlier
    // tests in this file, so simply making MockProvider throw wouldn't exercise the construction
    // path again. Reset the module registry and swap in a constructor that throws so a fresh
    // module instance actually calls `new apn.Provider(...)` and hits the failure.
    class ThrowingProvider {
      constructor() {
        throw new Error('bad token/key');
      }
      send = sendMock;
    }
    vi.resetModules();
    vi.doMock('@parse/node-apn', () => ({
      default: { Provider: ThrowingProvider, Notification: MockNotification },
    }));

    const { sendApns: sendApnsFresh } = await import('../providers/apns.provider');
    const result = await sendApnsFresh(target, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(false);
    expect(result.error?.isDeadToken).toBe(false);
    // Proves the throwing constructor was actually reached (not just a mock-swap
    // no-op falling through to the reset sendMock, which would also report failure
    // but with a different message).
    expect(result.error?.code).toBe('apns-error');
    expect(result.error?.message).toBe('bad token/key');

    // Restore the original mock so the module registry is clean for any other test files/runs.
    vi.resetModules();
    vi.doMock('@parse/node-apn', () => ({
      default: { Provider: MockProvider, Notification: MockNotification },
    }));
  });
});
