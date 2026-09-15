import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { RoutersService } from './routers.service';
import { AlertType, AlertSeverity, AlertStatus, SubscriberStatus } from '@prisma/client';

@Injectable()
export class ReconciliationJob {
  private readonly logger = new Logger(ReconciliationJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly routersService: RoutersService,
  ) {}

  /**
   * Runs every 15 minutes.
   * For each router: fetches the live PPP secrets / hotspot users from RouterOS
   * and compares against HisaFlow's belief about each subscriber's status.
   * Mismatches are flagged as ROUTER_DRIFT alerts — never auto-corrected (per plan Q3).
   */
  @Cron('*/15 * * * *')
  async handleReconciliation() {
    this.logger.log('ReconciliationJob: starting reconciliation sweep...');

    // Process all routers that have linked subscribers
    const routers = await this.prisma.db.router.findMany({
      include: {
        subscribers: {
          where: {
            routerAccountRef: { not: null },
            status: { in: [SubscriberStatus.ACTIVE, SubscriberStatus.SUSPENDED] },
          },
        },
      },
    });

    for (const router of routers) {
      if (!router.subscribers.length) continue;

      let liveAccounts: Map<string, boolean>;
      try {
        liveAccounts = await this.fetchLiveAccounts(router);
      } catch (err: any) {
        this.logger.warn(
          `ReconciliationJob: could not connect to router ${router.label} (${router.host}) — ${err?.message}`,
        );
        continue;
      }

      for (const subscriber of router.subscribers) {
        const accountRef = subscriber.routerAccountRef!;
        const liveDisabled = liveAccounts.get(accountRef);

        if (liveDisabled === undefined) {
          // Account doesn't exist on the router at all — flag it
          await this.upsertDriftAlert(
            router.organizationId,
            subscriber.id,
            `Account "${accountRef}" for subscriber "${subscriber.name}" not found on router "${router.label}". Expected: ${subscriber.status}.`,
          );
          continue;
        }

        const hisaflowSaysSuspended = subscriber.status === SubscriberStatus.SUSPENDED;
        const routerSaysSuspended = liveDisabled === true;

        if (hisaflowSaysSuspended !== routerSaysSuspended) {
          const hisaState = hisaflowSaysSuspended ? 'SUSPENDED' : 'ACTIVE';
          const routerState = routerSaysSuspended ? 'SUSPENDED' : 'ACTIVE';
          await this.upsertDriftAlert(
            router.organizationId,
            subscriber.id,
            `Router state mismatch for "${subscriber.name}" on "${router.label}": HisaFlow says ${hisaState}, router shows ${routerState}. Resolve manually in Winbox or via the subscriber page.`,
          );
          this.logger.warn(
            `ReconciliationJob: DRIFT detected — subscriber ${subscriber.id} (${subscriber.name}): HisaFlow=${hisaState}, Router=${routerState}`,
          );
        }
      }
    }

    this.logger.log('ReconciliationJob: done');
  }

  /**
   * Fetches all PPP secrets + hotspot users from the router and returns a Map of
   * accountRef → disabled (true = suspended, false = active).
   */
  private async fetchLiveAccounts(router: {
    host: string;
    port: number;
    apiUsername: string;
    apiPasswordEnc: string;
    organizationId: string;
    id: string;
    label: string;
  }): Promise<Map<string, boolean>> {
    const { decryptPassword } = await import('./routers.service');
    const password = decryptPassword(router.apiPasswordEnc);

    return new Promise<Map<string, boolean>>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 8000);

      const RouterOSClient = require('routeros-client').RouterOSClient;
      const client = new RouterOSClient({
        host: router.host,
        port: router.port,
        user: router.apiUsername,
        password,
        tls: { rejectUnauthorized: false },
      });

      client.connect()
        .then(async (conn: any) => {
          try {
            const accountMap = new Map<string, boolean>();

            // PPP secrets
            const secrets = await conn.menu('/ppp/secret').get();
            for (const s of secrets) {
              accountMap.set(s.name, s.disabled === 'true');
            }

            // Hotspot users
            const hotspotUsers = await conn.menu('/ip/hotspot/user').get();
            for (const u of hotspotUsers) {
              accountMap.set(u.name, u.disabled === 'true');
            }

            clearTimeout(timeout);
            client.disconnect();
            resolve(accountMap);
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

  /**
   * Creates or updates a ROUTER_DRIFT alert for the subscriber.
   * Uses the subscriber-level unique constraint workaround — we use title as a stable key.
   */
  private async upsertDriftAlert(
    organizationId: string,
    subscriberId: string,
    description: string,
  ) {
    // Try to find existing unresolved ROUTER_DRIFT alert for this subscriber
    const existing = await this.prisma.db.alert.findFirst({
      where: {
        organizationId,
        type: AlertType.ROUTER_DRIFT,
        status: AlertStatus.UNRESOLVED,
        // itemId is for inventory — for router drift we store subscriberId in description
        // so we use title matching to avoid duplicates
        title: { contains: subscriberId },
      },
    });

    if (existing) {
      // Update the description with the latest finding
      await this.prisma.db.alert.update({
        where: { id: existing.id },
        data: { description, updatedAt: new Date() },
      });
    } else {
      await this.prisma.db.alert.create({
        data: {
          organizationId,
          type: AlertType.ROUTER_DRIFT,
          severity: AlertSeverity.WARNING,
          status: AlertStatus.UNRESOLVED,
          title: `Router drift — subscriber ${subscriberId}`,
          description,
        },
      });
    }
  }
}
