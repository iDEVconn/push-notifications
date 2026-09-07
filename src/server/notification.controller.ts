import { Controller, Get, Param, Patch, Inject } from '@nestjs/common';
import { NOTIFICATION_LOG_STORE, NotificationLogStore } from '../index';

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
