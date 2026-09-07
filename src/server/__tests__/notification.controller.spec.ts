import { describe, it, expect, vi } from 'vitest';
import { NotificationController } from '../notification.controller';
import type { NotificationLogStore, NotificationRecord } from '../../index';

function makeStore(): NotificationLogStore {
  return { save: vi.fn(), findUnreadByUserId: vi.fn(), markAsRead: vi.fn() };
}

const record: NotificationRecord = {
  id: 'n-1',
  userId: 'user-1',
  title: 't',
  body: 'b',
  isRead: false,
  createdAt: new Date(),
};

describe('NotificationController', () => {
  it('getNotifications returns unread list from store', async () => {
    const store = makeStore();
    (store.findUnreadByUserId as ReturnType<typeof vi.fn>).mockResolvedValue([record]);
    const controller = new NotificationController(store);

    const result = await controller.getNotifications('user-1');

    expect(store.findUnreadByUserId).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([record]);
  });

  it('markAsRead delegates to store and returns success', async () => {
    const store = makeStore();
    const controller = new NotificationController(store);

    const result = await controller.markAsRead('n-1');

    expect(store.markAsRead).toHaveBeenCalledWith('n-1');
    expect(result).toEqual({ success: true });
  });
});
