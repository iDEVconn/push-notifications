import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const getTokenMock = vi.fn();
const getMessagingMock = vi.fn(() => ({}));
const initializeAppMock = vi.fn(() => ({}));

vi.mock('firebase/app', () => ({ initializeApp: initializeAppMock }));
vi.mock('firebase/messaging', () => ({ getMessaging: getMessagingMock, getToken: getTokenMock }));

import { usePushSubscriptionFcm } from '../use-push-subscription-fcm';

describe('usePushSubscriptionFcm', () => {
  it('starts idle with no token', () => {
    const { result } = renderHook(() =>
      usePushSubscriptionFcm({ firebaseConfig: { projectId: 'p' }, vapidKey: 'vk' }),
    );
    expect(result.current.status).toBe('idle');
    expect(result.current.token).toBeNull();
  });

  it('subscribe() initializes firebase and stores the token', async () => {
    getTokenMock.mockReset();
    initializeAppMock.mockClear();
    getTokenMock.mockResolvedValue('fcm-token-abc');
    const { result } = renderHook(() =>
      usePushSubscriptionFcm({ firebaseConfig: { projectId: 'p' }, vapidKey: 'vk' }),
    );

    await act(async () => {
      await result.current.subscribe();
    });

    await waitFor(() => expect(result.current.status).toBe('subscribed'));
    expect(result.current.token).toBe('fcm-token-abc');
  });

  it('sets status to error when getToken throws', async () => {
    getTokenMock.mockReset();
    initializeAppMock.mockClear();
    getTokenMock.mockRejectedValue(new Error('permission denied'));
    const { result } = renderHook(() =>
      usePushSubscriptionFcm({ firebaseConfig: { projectId: 'p' }, vapidKey: 'vk' }),
    );

    await act(async () => {
      await result.current.subscribe();
    });

    expect(result.current.status).toBe('error');
  });

  it('subscribe() stays idle (no-op) when window is unavailable', async () => {
    getTokenMock.mockReset();
    initializeAppMock.mockClear();
    const originalWindow = global.window;
    const { result } = renderHook(() =>
      usePushSubscriptionFcm({ firebaseConfig: { projectId: 'p' }, vapidKey: 'vk' }),
    );

    // @ts-expect-error -- simulating an SSR environment for this one test
    delete global.window;

    await act(async () => {
      await result.current.subscribe();
    });

    expect(result.current.status).toBe('idle');
    expect(initializeAppMock).not.toHaveBeenCalled();

    global.window = originalWindow;
  });
});
