import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePushSubscription } from '../use-push-subscription';

const mockSubscription = { endpoint: 'https://push.example/1' };
const subscribeMock = vi.fn().mockResolvedValue(mockSubscription);
const unsubscribeMock = vi.fn().mockResolvedValue(undefined);
const getSubscriptionMock = vi.fn().mockResolvedValue(null);

beforeEach(() => {
  subscribeMock.mockClear();
  unsubscribeMock.mockClear();

  vi.stubGlobal('navigator', {
    serviceWorker: {
      register: vi.fn().mockResolvedValue({
        pushManager: { subscribe: subscribeMock, getSubscription: getSubscriptionMock },
      }),
    },
  });
});

describe('usePushSubscription', () => {
  it('starts idle with no subscription', () => {
    const { result } = renderHook(() => usePushSubscription({ vapidPublicKey: 'pub', swPath: '/sw.js' }));
    expect(result.current.status).toBe('idle');
    expect(result.current.subscription).toBeNull();
  });

  it('subscribe() registers service worker and subscribes to push', async () => {
    const { result } = renderHook(() => usePushSubscription({ vapidPublicKey: 'pub', swPath: '/sw.js' }));

    await act(async () => {
      await result.current.subscribe();
    });

    await waitFor(() => expect(result.current.status).toBe('subscribed'));
    expect(subscribeMock).toHaveBeenCalledOnce();
    expect(result.current.subscription).toEqual(mockSubscription);
  });

  it('unsubscribe() clears subscription state', async () => {
    const { result } = renderHook(() => usePushSubscription({ vapidPublicKey: 'pub', swPath: '/sw.js' }));
    await act(async () => {
      await result.current.subscribe();
    });

    await act(async () => {
      await result.current.unsubscribe();
    });

    expect(result.current.subscription).toBeNull();
    expect(result.current.status).toBe('idle');
  });

  it('sets status to error when subscribe throws', async () => {
    subscribeMock.mockRejectedValueOnce(new Error('denied'));
    const { result } = renderHook(() => usePushSubscription({ vapidPublicKey: 'pub', swPath: '/sw.js' }));

    await act(async () => {
      await result.current.subscribe();
    });

    expect(result.current.status).toBe('error');
  });
});
