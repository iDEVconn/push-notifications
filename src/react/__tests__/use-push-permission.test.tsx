import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePushPermission } from '../use-push-permission';

beforeEach(() => {
  vi.stubGlobal('Notification', {
    permission: 'default',
    requestPermission: vi.fn().mockResolvedValue('granted'),
  });
});

describe('usePushPermission', () => {
  it('reads current Notification.permission', () => {
    const { result } = renderHook(() => usePushPermission());
    expect(result.current.permission).toBe('default');
  });

  it('request() calls Notification.requestPermission and updates state', async () => {
    const { result } = renderHook(() => usePushPermission());

    await act(async () => {
      await result.current.request();
    });

    expect(result.current.permission).toBe('granted');
  });

  it('reports unsupported when Notification is undefined', () => {
    vi.stubGlobal('Notification', undefined);
    const { result } = renderHook(() => usePushPermission());
    expect(result.current.permission).toBe('unsupported');
  });
});
