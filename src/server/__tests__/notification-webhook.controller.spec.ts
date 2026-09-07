import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { NotificationWebhookController } from '../notification-webhook.controller';
import { PushService } from '../push.service';
import type { NotificationWebhookVerifier } from '../../index';

function makeService() {
  return { pruneTarget: vi.fn() } as unknown as PushService;
}

function makeVerifier(allow = true): NotificationWebhookVerifier {
  return { verify: vi.fn().mockResolvedValue(allow) };
}

const request = { headers: {} };

describe('NotificationWebhookController', () => {
  it('acknowledges receipt for a well-formed, verified body', async () => {
    const service = makeService();
    const verifier = makeVerifier(true);
    const controller = new NotificationWebhookController(service, verifier);

    const result = await controller.handleDeliveryReport(
      {
        event: 'delivery.ok',
        userId: 'user-1',
        target: { type: 'fcm', userId: 'user-1', token: 'tok-1' },
        status: 'ok',
      },
      request,
    );

    expect(verifier.verify).toHaveBeenCalledWith(request);
    expect(result).toEqual({ received: true });
    expect(service.pruneTarget).not.toHaveBeenCalled();
  });

  it('prunes target when status is failed and verified', async () => {
    const service = makeService();
    const verifier = makeVerifier(true);
    const controller = new NotificationWebhookController(service, verifier);
    const target = { type: 'fcm' as const, userId: 'user-1', token: 'tok-1' };

    await controller.handleDeliveryReport(
      { event: 'delivery.failed', userId: 'user-1', target, status: 'failed' },
      request,
    );

    expect(service.pruneTarget).toHaveBeenCalledWith('user-1', target);
  });

  it('throws BadRequestException and never touches the service when a verified failed report is missing userId/target', async () => {
    const service = makeService();
    const verifier = makeVerifier(true);
    const controller = new NotificationWebhookController(service, verifier);

    await expect(
      controller.handleDeliveryReport(
        { event: 'delivery.failed', status: 'failed' } as never,
        request,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(service.pruneTarget).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException and never touches the service when verification fails', async () => {
    const service = makeService();
    const verifier = makeVerifier(false);
    const controller = new NotificationWebhookController(service, verifier);
    const target = { type: 'fcm' as const, userId: 'user-1', token: 'tok-1' };

    await expect(
      controller.handleDeliveryReport({ event: 'delivery.failed', userId: 'user-1', target, status: 'failed' }, request),
    ).rejects.toThrow(ForbiddenException);
    expect(service.pruneTarget).not.toHaveBeenCalled();
  });
});
