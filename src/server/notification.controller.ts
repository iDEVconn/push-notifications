import { Controller, Get, Param, Patch, Inject } from '@nestjs/common';
import { NOTIFICATION_LOG_STORE } from '../index';
import type { NotificationLogStore } from '../index';

/**
 * Not auto-registered by PushNotificationModule — add it to your own
 * module's `controllers` array to mount it.
 *
 * Performs NO authorization: `userId`/`id` come straight from the URL with
 * no ownership check against the caller. This package has no opinion on
 * auth (no auth dependency anywhere in it), so guarding this controller is
 * the consumer's responsibility — put an AuthGuard in front of it and
 * verify the resolved identity matches `:userId` (and that the record
 * behind `:id` belongs to the caller) before this ships to production.
 */
@Controller('notifications')
export class NotificationController {
  constructor(@Inject(NOTIFICATION_LOG_STORE) private readonly store: NotificationLogStore) {}

  @Get(':userId')
  async getNotifications(@Param('userId') userId: string) {
    return this.store.findUnreadByUserId(userId);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    await this.store.markAsRead(id);
    return { success: true };
  }
}
