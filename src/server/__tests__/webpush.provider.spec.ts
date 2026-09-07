import { describe, it, expect, vi } from 'vitest';

const sendNotificationMock = vi.fn();
const setVapidDetailsMock = vi.fn();
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: setVapidDetailsMock,
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

describe('sendWebPush', () => {
  it('returns success on 201/200 response', async () => {
    sendNotificationMock.mockReset();
    sendNotificationMock.mockResolvedValue({ statusCode: 201 });
    const result = await sendWebPush(target, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(true);
    expect(result.target).toBe(target);
  });

  it('flags dead token on 410 Gone', async () => {
    sendNotificationMock.mockReset();
    sendNotificationMock.mockRejectedValue(Object.assign(new Error('Gone'), { statusCode: 410, body: 'gone' }));
    const result = await sendWebPush(target, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(false);
    expect(result.error?.isDeadToken).toBe(true);
    expect(result.error?.code).toBe('410');
  });

  it('flags dead token on 404 Not Found', async () => {
    sendNotificationMock.mockReset();
    sendNotificationMock.mockRejectedValue(Object.assign(new Error('Not Found'), { statusCode: 404, body: 'not found' }));
    const result = await sendWebPush(target, { title: 't', body: 'b' }, config);
    expect(result.error?.isDeadToken).toBe(true);
  });

  it('returns non-fatal error on other failures', async () => {
    sendNotificationMock.mockReset();
    sendNotificationMock.mockRejectedValue(Object.assign(new Error('Server Error'), { statusCode: 500, body: 'server error' }));
    const result = await sendWebPush(target, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(false);
    expect(result.error?.isDeadToken).toBe(false);
    expect(result.error?.code).toBe('500');
  });

  it('rejects non-https endpoints without attempting to send', async () => {
    sendNotificationMock.mockReset();
    const httpTarget: PushTarget = {
      type: 'webpush',
      userId: 'user-1',
      subscription: { endpoint: 'http://push.example/abc', keys: { p256dh: 'p', auth: 'a' } },
    };
    const result = await sendWebPush(httpTarget, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('invalid-endpoint');
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('rejects endpoints pointing at private or loopback hosts', async () => {
    sendNotificationMock.mockReset();
    const privateTarget: PushTarget = {
      type: 'webpush',
      userId: 'user-1',
      subscription: { endpoint: 'https://127.0.0.1/abc', keys: { p256dh: 'p', auth: 'a' } },
    };
    const result = await sendWebPush(privateTarget, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('invalid-endpoint');
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('rejects IPv4-mapped IPv6 loopback endpoints', async () => {
    sendNotificationMock.mockReset();
    const mappedTarget: PushTarget = {
      type: 'webpush',
      userId: 'user-1',
      subscription: { endpoint: 'https://[::ffff:127.0.0.1]/abc', keys: { p256dh: 'p', auth: 'a' } },
    };
    const result = await sendWebPush(mappedTarget, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('invalid-endpoint');
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('rejects localhost with a trailing root dot', async () => {
    sendNotificationMock.mockReset();
    const trailingDotTarget: PushTarget = {
      type: 'webpush',
      userId: 'user-1',
      subscription: { endpoint: 'https://localhost./abc', keys: { p256dh: 'p', auth: 'a' } },
    };
    const result = await sendWebPush(trailingDotTarget, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('invalid-endpoint');
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('returns init-error and does not throw when setVapidDetails fails', async () => {
    sendNotificationMock.mockReset();
    setVapidDetailsMock.mockReset();
    setVapidDetailsMock.mockImplementation(() => {
      throw new Error('invalid subject');
    });
    const result = await sendWebPush(target, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('init-error');
    expect(result.error?.isDeadToken).toBe(false);
    expect(sendNotificationMock).not.toHaveBeenCalled();
    setVapidDetailsMock.mockReset(); // restore no-op default for subsequent tests
  });
});
