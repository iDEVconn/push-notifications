import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendNotificationMock = vi.fn();
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: sendNotificationMock,
  },
}));

import { sendWebPush } from '../providers/webpush.provider';
import type { PushTarget } from '../../index';

const target: PushTarget = {
  type: 'webpush',
  userId: 'user-1',
  subscription: { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } },
};

const config = { vapidPublicKey: 'pub', vapidPrivateKey: 'priv', subject: 'mailto:a@b.com' };

beforeEach(() => sendNotificationMock.mockReset());

describe('sendWebPush', () => {
  it('returns success on 201/200 response', async () => {
    sendNotificationMock.mockResolvedValue({ statusCode: 201 });
    const result = await sendWebPush(target, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(true);
    expect(result.target).toBe(target);
  });

  it('flags dead token on 410 Gone', async () => {
    sendNotificationMock.mockRejectedValue({ statusCode: 410, body: 'gone' });
    const result = await sendWebPush(target, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(false);
    expect(result.error?.isDeadToken).toBe(true);
    expect(result.error?.code).toBe('410');
  });

  it('flags dead token on 404 Not Found', async () => {
    sendNotificationMock.mockRejectedValue({ statusCode: 404, body: 'not found' });
    const result = await sendWebPush(target, { title: 't', body: 'b' }, config);
    expect(result.error?.isDeadToken).toBe(true);
  });

  it('returns non-fatal error on other failures', async () => {
    sendNotificationMock.mockRejectedValue({ statusCode: 500, body: 'server error' });
    const result = await sendWebPush(target, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(false);
    expect(result.error?.isDeadToken).toBe(false);
    expect(result.error?.code).toBe('500');
  });
});
