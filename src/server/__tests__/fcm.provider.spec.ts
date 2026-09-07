import { describe, it, expect, vi } from 'vitest';

const sendMock = vi.fn();
const getMessagingMock = vi.fn(() => ({ send: sendMock }));
const initializeAppMock = vi.fn(() => ({}));
const credentialCertMock = vi.fn();

vi.mock('firebase-admin', () => ({
  default: {
    apps: [],
    initializeApp: initializeAppMock,
    credential: { cert: credentialCertMock },
    messaging: getMessagingMock,
  },
}));

import { sendFcm } from '../providers/fcm.provider';
import type { PushTarget } from '../../index';

const target: PushTarget = { type: 'fcm', userId: 'user-1', token: 'device-token-abc' };
const config = { serviceAccount: { projectId: 'p' } };

describe('sendFcm', () => {
  it('returns success when send resolves', async () => {
    sendMock.mockReset();
    initializeAppMock.mockClear();
    sendMock.mockResolvedValue('message-id-123');
    const result = await sendFcm(target, { title: 't', body: 'b' }, config);
    expect(result.success).toBe(true);
  });

  it('flags dead token on registration-token-not-registered', async () => {
    sendMock.mockReset();
    initializeAppMock.mockClear();
    sendMock.mockRejectedValue(
      Object.assign(new Error('not registered'), { code: 'messaging/registration-token-not-registered' }),
    );
    const result = await sendFcm(target, { title: 't', body: 'b' }, config);
    expect(result.error?.isDeadToken).toBe(true);
    expect(result.error?.code).toBe('messaging/registration-token-not-registered');
  });

  it('flags dead token on InvalidRegistration', async () => {
    sendMock.mockReset();
    initializeAppMock.mockClear();
    sendMock.mockRejectedValue(Object.assign(new Error('invalid'), { code: 'InvalidRegistration' }));
    const result = await sendFcm(target, { title: 't', body: 'b' }, config);
    expect(result.error?.isDeadToken).toBe(true);
  });

  it('returns non-fatal error for other codes', async () => {
    sendMock.mockReset();
    initializeAppMock.mockClear();
    sendMock.mockRejectedValue(Object.assign(new Error('boom'), { code: 'messaging/internal-error', message: 'boom' }));
    const result = await sendFcm(target, { title: 't', body: 'b' }, config);
    expect(result.error?.isDeadToken).toBe(false);
  });
});
