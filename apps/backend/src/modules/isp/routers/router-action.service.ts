import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { RoutersService } from './routers.service';
import {
  SubscriberStatus,
  RouterActionType,
  RouterActionStatus,
  ConnectionType,
} from '@prisma/client';

type TriggerSource = 'manual' | 'billing' | 'reconciliation';

export interface ActionResult {
  success: boolean;
  actionId: string;
  error?: string;
}

const RETRY_DELAYS_MS = [2_000, 8_000, 30_000]; // exponential backoff

@Injectable()
export class RouterActionService {
  private readonly logger = new Logger(RouterActionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly routersService: RoutersService,
  ) {}

  async suspend(organizationId: string, subscriberId: string, triggeredBy: TriggerSource): Promise<ActionResult> {
    return this.executeAction(organizationId, subscriberId, RouterActionType.SUSPEND, triggeredBy);
  }

  async reconnect(organizationId: string, subscriberId: string, triggeredBy: TriggerSource): Promise<ActionResult> {
    return this.executeAction(organizationId, subscriberId, RouterActionType.RECONNECT, triggeredBy);
  }

  // ── Core execution with retry ──────────────────────────────────────────────

  private async executeAction(
    organizationId: string,
    subscriberId: string,
    type: RouterActionType,
    triggeredBy: TriggerSource,
  ): Promise<ActionResult> {
    const subscriber = await this.prisma.db.subscriber.findFirst({
      where: { id: subscriberId, organizationId },
    });

    if (!subscriber) {
      this.logger.warn(`RouterAction: subscriber ${subscriberId} not found`);
      return { success: false, actionId: '', error: 'Subscriber not found' };
    }

    if (!subscriber.routerId || !subscriber.routerAccountRef) {
      this.logger.warn(`RouterAction: subscriber ${subscriberId} has no router linked — skipping`);
      return { success: false, actionId: '', error: 'No router linked to this subscriber' };
    }

    // Create the RouterAction audit record
    const action = await this.prisma.db.routerAction.create({
      data: {
        organizationId,
        subscriberId,
        routerId: subscriber.routerId,
        type,
        triggeredBy,
        status: RouterActionStatus.PENDING,
        attempts: 0,
      },
    });

    // Load router + decrypted credentials
    const router = await this.routersService.findWithCredentials(organizationId, subscriber.routerId);

    let lastError = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await this.delay(RETRY_DELAYS_MS[attempt - 1]);
      }

      try {
        await this.prisma.db.routerAction.update({
          where: { id: action.id },
          data: { attempts: attempt + 1 },
        });

        await this.applyOnRouter(
          router.host,
          router.port,
          router.apiUsername,
          router.apiPassword,
          subscriber.connectionType,
          subscriber.routerAccountRef!,
          type,
        );

        // Success — update action + subscriber status
        const newSubscriberStatus =
          type === RouterActionType.SUSPEND ? SubscriberStatus.SUSPENDED : SubscriberStatus.ACTIVE;

        await this.prisma.db.$transaction([
          this.prisma.db.routerAction.update({
            where: { id: action.id },
            data: { status: RouterActionStatus.SUCCESS, resolvedAt: new Date(), lastError: null },
          }),
          this.prisma.db.subscriber.update({
            where: { id: subscriberId },
            data: { status: newSubscriberStatus },
          }),
        ]);

        this.logger.log(`RouterAction ${type} SUCCESS — subscriber ${subscriberId}`);
        return { success: true, actionId: action.id };
      } catch (err: any) {
        lastError = err?.message ?? 'Unknown error';
        this.logger.warn(`RouterAction ${type} attempt ${attempt + 1} FAILED — ${lastError}`);
      }
    }

    // All retries exhausted
    await this.prisma.db.routerAction.update({
      where: { id: action.id },
      data: { status: RouterActionStatus.FAILED, lastError },
    });

    this.logger.error(`RouterAction ${type} FAILED after 3 attempts — subscriber ${subscriberId}: ${lastError}`);
    return { success: false, actionId: action.id, error: lastError };
  }

  // ── RouterOS API call ──────────────────────────────────────────────────────

  private async applyOnRouter(
    host: string,
    port: number,
    username: string,
    password: string,
    connectionType: ConnectionType,
    accountRef: string,
    action: RouterActionType,
  ): Promise<void> {
    const disabled = action === RouterActionType.SUSPEND ? 'true' : 'false';

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Router API call timed out after 5 seconds'));
      }, 5000);

      const RouterOSClient = require('routeros-client').RouterOSClient;
      const client = new RouterOSClient({
        host,
        port,
        user: username,
        password,
        tls: { rejectUnauthorized: false },
      });

      client.connect()
        .then(async (conn: any) => {
          try {
            if (connectionType === ConnectionType.HOTSPOT) {
              // /ip/hotspot/user — find by name, set disabled
              const users = await conn.menu('/ip/hotspot/user').where({ name: accountRef }).get();
              if (!users.length) throw new Error(`Hotspot user "${accountRef}" not found on router`);
              await conn.menu('/ip/hotspot/user').id(users[0]['.id']).set({ disabled });
            } else {
              // PPPoE (PPPOE) and STATIC_IP — use PPP secrets
              const secrets = await conn.menu('/ppp/secret').where({ name: accountRef }).get();
              if (!secrets.length) throw new Error(`PPP secret "${accountRef}" not found on router`);
              await conn.menu('/ppp/secret').id(secrets[0]['.id']).set({ disabled });
            }

            clearTimeout(timeout);
            client.disconnect();
            resolve();
          } catch (e) {
            clearTimeout(timeout);
            client.disconnect();
            reject(e);
          }
        })
        .catch((e: any) => {
          clearTimeout(timeout);
          reject(e);
        });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
