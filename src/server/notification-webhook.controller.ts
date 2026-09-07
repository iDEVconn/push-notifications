import { BadRequestException, Body, Controller, ForbiddenException, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import { NOTIFICATION_WEBHOOK_VERIFIER } from '../index';
import type { PushTarget, NotificationWebhookVerifier } from '../index';
import { PushService } from './push.service';

interface DeliveryReportBody {
  event: string;
  userId: string;
  target: PushTarget;
  status: 'ok' | 'failed';
}

/**
 * Opt-in: import and register this controller only if an aggregator
 * (OneSignal, Airship, etc.) is configured to POST here. The three
 * built-in providers (web-push/FCM/APNs) never call this endpoint —
 * they report failures synchronously in the send response instead.
 *
 * Requires a `NOTIFICATION_WEBHOOK_VERIFIER` provider (required — Nest
 * fails to bootstrap without one) to confirm the request actually came
 * from your aggregator before acting on it.
 */
@Controller('webhooks/notifications')
export class NotificationWebhookController {
  constructor(
    private readonly pushService: PushService,
    @Inject(NOTIFICATION_WEBHOOK_VERIFIER) private readonly verifier: NotificationWebhookVerifier,
  ) {}

  @Post('delivery-report')
  @HttpCode(HttpStatus.OK)
  async handleDeliveryReport(@Body() body: DeliveryReportBody, @Req() request: unknown) {
    if (!(await this.verifier.verify(request))) {
      throw new ForbiddenException();
    }
    if (body.status === 'failed') {
      if (!body.userId || !body.target?.type) {
        throw new BadRequestException('delivery-report: userId and target are required when status is failed');
      }
      await this.pushService.pruneTarget(body.userId, body.target);
    }
    return { received: true };
  }
}
