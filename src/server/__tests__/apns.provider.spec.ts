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
});
