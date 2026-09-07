import { Controller, ForbiddenException, Get, Inject, Param, Patch, Req } from '@nestjs/common';
import { NOTIFICATION_AUTHORIZER, NOTIFICATION_LOG_STORE } from '../index';
import type { NotificationAuthorizer, NotificationLogStore } from '../index';

/**
 * Not auto-registered by PushNotificationModule — add it to your own
 * module's `controllers` array to mount it, alongside a provider for
 * `NOTIFICATION_AUTHORIZER` (required — Nest fails to bootstrap without
 * one, by design, so this controller cannot be wired up unguarded).
 */
@Controller('notifications')
export class NotificationController {
  constructor(
    @Inject(NOTIFICATION_LOG_STORE) private readonly store: NotificationLogStore,
    @Inject(NOTIFICATION_AUTHORIZER) private readonly authorizer: NotificationAuthorizer,
  ) {}

  @Get(':userId')
  async getNotifications(@Param('userId') userId: string, @Req() request: unknown) {
    if (!(await this.authorizer.authorizeUserAccess(request, userId))) {
      throw new ForbiddenException();
    }
    return this.store.findUnreadByUserId(userId);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Req() request: unknown) {
    if (!(await this.authorizer.authorizeNotificationAccess(request, id))) {
      throw new ForbiddenException();
    }
    await this.store.markAsRead(id);
    return { success: true };
  }
}
