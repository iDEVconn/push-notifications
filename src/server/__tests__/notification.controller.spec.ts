import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { NotificationController } from '../notification.controller';
import type { NotificationAuthorizer, NotificationLogStore, NotificationRecord } from '../../index';

function makeStore(): NotificationLogStore {
  return { save: vi.fn(), findUnreadByUserId: vi.fn(), markAsRead: vi.fn() };
}

function makeAuthorizer(allow = true): NotificationAuthorizer {
  return {
    authorizeUserAccess: vi.fn().mockResolvedValue(allow),
    authorizeNotificationAccess: vi.fn().mockResolvedValue(allow),
  };
}

const record: NotificationRecord = {
  id: 'n-1',
  userId: 'user-1',
  title: 't',
  body: 'b',
  isRead: false,
  createdAt: new Date(),
};

const request = { headers: {} };

describe('NotificationController', () => {
  it('getNotifications returns unread list from store when authorized', async () => {
    const store = makeStore();
    (store.findUnreadByUserId as ReturnType<typeof vi.fn>).mockResolvedValue([record]);
    const authorizer = makeAuthorizer(true);
    const controller = new NotificationController(store, authorizer);

    const result = await controller.getNotifications('user-1', request);

    expect(authorizer.authorizeUserAccess).toHaveBeenCalledWith(request, 'user-1');
    expect(store.findUnreadByUserId).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([record]);
  });

  it('getNotifications throws ForbiddenException when not authorized', async () => {
    const store = makeStore();
    const authorizer = makeAuthorizer(false);
    const controller = new NotificationController(store, authorizer);

    await expect(controller.getNotifications('user-1', request)).rejects.toThrow(ForbiddenException);
    expect(store.findUnreadByUserId).not.toHaveBeenCalled();
  });

  it('markAsRead delegates to store and returns success when authorized', async () => {
    const store = makeStore();
    const authorizer = makeAuthorizer(true);
    const controller = new NotificationController(store, authorizer);

    const result = await controller.markAsRead('n-1', request);

    expect(authorizer.authorizeNotificationAccess).toHaveBeenCalledWith(request, 'n-1');
    expect(store.markAsRead).toHaveBeenCalledWith('n-1');
    expect(result).toEqual({ success: true });
  });

  it('markAsRead throws ForbiddenException when not authorized', async () => {
    const store = makeStore();
    const authorizer = makeAuthorizer(false);
    const controller = new NotificationController(store, authorizer);

    await expect(controller.markAsRead('n-1', request)).rejects.toThrow(ForbiddenException);
    expect(store.markAsRead).not.toHaveBeenCalled();
  });
});
