import { BadRequestException, Injectable } from '@nestjs/common';
import {
  EtimsEnvironment,
  EtimsIntegrationType,
  EtimsRegistrationStatus,
  Prisma,
  TaxRegistration,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { SaveTaxRegistrationDto } from './dto/save-tax-registration.dto';
import { SubmitTaxRegistrationDto } from './dto/submit-tax-registration.dto';
import { RecordKraOutcomeDto } from './dto/record-kra-outcome.dto';

/** `NOT_REGISTERED` is the no-row state; the rest mirror the DB enum. */
export type TaxRegistrationStatus = EtimsRegistrationStatus | 'NOT_REGISTERED';

export interface TaxRegistrationView {
  registered: boolean;
  kraPin: string | null;
  integrationType: EtimsIntegrationType | null;
  status: TaxRegistrationStatus;
  environment: EtimsEnvironment | null;
  /**
   * True only once KRA has approved the *production* registration. Sandbox,
   * pending and no-registration states are all false — this is the single gate
   * Phase B/C must check before attempting any live filing.
   */
  canFileLive: boolean;
  commitmentFormAcknowledgedAt: Date | null;
  submittedAt: Date | null;
  kraApprovedAt: Date | null;
  productionSubmittedAt: Date | null;
  productionActivatedAt: Date | null;
  statusNote: string | null;
  statusUpdatedAt: Date | null;
}

/**
 * Outcomes the org owner may report after seeing them on the KRA portal.
 * `PIN_CAPTURED`/`PENDING_KRA_APPROVAL` are reached through their own
 * endpoints, so they are not accepted here.
 */
export const REPORTABLE_KRA_OUTCOMES: EtimsRegistrationStatus[] = [
  EtimsRegistrationStatus.SANDBOX_ACTIVE,
  EtimsRegistrationStatus.PENDING_PRODUCTION,
  EtimsRegistrationStatus.PRODUCTION_ACTIVE,
  EtimsRegistrationStatus.REJECTED,
  EtimsRegistrationStatus.SUSPENDED,
];

/** The one and only state that permits live eTIMS filing. */
export function isEtimsProductionActive(
  status: TaxRegistrationStatus | null | undefined,
): boolean {
  return status === EtimsRegistrationStatus.PRODUCTION_ACTIVE;
}

/**
 * Phase A — Organization Tax Registration.
 *
 * Verified against KRA's current eTIMS documentation (2026-09-30): onboarding
 * is a KRA-side process — sign up on the taxpayer sandbox, submit the Service
 * Request + Commitment Form, and wait for KRA approval before a device is
 * active; production is a further KRA registration/approval step. HisaFlow
 * therefore *tracks* status, it never fast-forwards it, and the UI must show
 * pending states honestly (tax-system doc Section 7 item 1).
 */
@Injectable()
export class TaxRegistrationService {
  constructor(private readonly prisma: PrismaService) {}

  async getView(organizationId: string): Promise<TaxRegistrationView> {
    return this.toView(await this.find(organizationId));
  }

  /** Capture or update the org's KRA PIN. Never advances past PIN_CAPTURED. */
  async save(
    organizationId: string,
    dto: SaveTaxRegistrationDto,
  ): Promise<TaxRegistrationView> {
    const existing = await this.find(organizationId);

    if (!existing) {
      const created = await this.prisma.db.taxRegistration.create({
        data: {
          organizationId,
          kraPin: dto.kraPin,
          integrationType:
            dto.integrationType ?? EtimsIntegrationType.VSCU,
          status: EtimsRegistrationStatus.PIN_CAPTURED,
          environment: EtimsEnvironment.SANDBOX,
        },
      });
      return this.toView(created);
    }

    // Editing a rejected registration puts it back to "captured", not active.
    const status =
      existing.status === EtimsRegistrationStatus.REJECTED
        ? EtimsRegistrationStatus.PIN_CAPTURED
        : existing.status;

    const updated = await this.prisma.db.taxRegistration.update({
      where: { organizationId },
      data: {
        kraPin: dto.kraPin,
        integrationType: dto.integrationType ?? existing.integrationType,
        status,
      },
    });
    return this.toView(updated);
  }

  /**
   * Org has submitted the KRA Service Request + Commitment Form. This is the
   * furthest the app itself will move status: pending KRA approval, never
   * "active".
   */
  async submit(
    organizationId: string,
    dto: SubmitTaxRegistrationDto,
  ): Promise<TaxRegistrationView> {
    const existing = await this.find(organizationId);
    if (!existing) {
      throw new BadRequestException(
        'Save your KRA PIN before submitting for eTIMS registration',
      );
    }
    if (!dto.commitmentFormAcknowledged) {
      throw new BadRequestException(
        'The eTIMS Commitment Form must be acknowledged before submitting',
      );
    }

    // Idempotent once already submitted (unless it was rejected and is being
    // retried).
    if (
      existing.submittedAt &&
      existing.status !== EtimsRegistrationStatus.REJECTED
    ) {
      return this.toView(existing);
    }

    const now = new Date();
    const updated = await this.prisma.db.taxRegistration.update({
      where: { organizationId },
      data: {
        status: EtimsRegistrationStatus.PENDING_KRA_APPROVAL,
        submittedAt: now,
        commitmentFormAcknowledgedAt: now,
        statusUpdatedAt: now,
        statusNote: 'Submitted to KRA — awaiting KRA approval.',
      },
    });
    return this.toView(updated);
  }

  /**
   * Record a KRA outcome the owner has observed. Requires a submission first,
   * an explicit note, and only accepts reportable outcomes. Production
   * activation is the only path that flips `canFileLive` — and it is always an
   * explicit, dated, noted event, never implicit.
   */
  async recordOutcome(
    organizationId: string,
    dto: RecordKraOutcomeDto,
  ): Promise<TaxRegistrationView> {
    const existing = await this.find(organizationId);
    if (!existing) {
      throw new BadRequestException(
        'No tax registration exists for this organization',
      );
    }
    if (!existing.submittedAt) {
      throw new BadRequestException(
        'Submit the registration to KRA before recording a KRA outcome',
      );
    }
    if (!REPORTABLE_KRA_OUTCOMES.includes(dto.status)) {
      throw new BadRequestException(
        `Status ${dto.status} cannot be recorded from the app`,
      );
    }

    const now = new Date();
    const data: Prisma.TaxRegistrationUpdateInput = {
      status: dto.status,
      statusNote: dto.note,
      statusUpdatedAt: now,
    };

    switch (dto.status) {
      case EtimsRegistrationStatus.SANDBOX_ACTIVE:
        data.environment = EtimsEnvironment.SANDBOX;
        data.kraApprovedAt = now;
        break;
      case EtimsRegistrationStatus.PENDING_PRODUCTION:
        data.environment = EtimsEnvironment.SANDBOX;
        data.productionSubmittedAt = now;
        break;
      case EtimsRegistrationStatus.PRODUCTION_ACTIVE:
        data.environment = EtimsEnvironment.PRODUCTION;
        data.kraApprovedAt = existing.kraApprovedAt ?? now;
        data.productionActivatedAt = now;
        break;
      case EtimsRegistrationStatus.REJECTED:
      case EtimsRegistrationStatus.SUSPENDED:
        break;
      default:
        break;
    }

    const updated = await this.prisma.db.taxRegistration.update({
      where: { organizationId },
      data,
    });
    return this.toView(updated);
  }

  /** Phase B/C gate: live filing is allowed only on production activation. */
  async canFileLive(organizationId: string): Promise<boolean> {
    const registration = await this.find(organizationId);
    return isEtimsProductionActive(registration?.status);
  }

  private find(organizationId: string): Promise<TaxRegistration | null> {
    return this.prisma.db.taxRegistration.findUnique({
      where: { organizationId },
    });
  }

  private toView(registration: TaxRegistration | null): TaxRegistrationView {
    if (!registration) {
      return {
        registered: false,
        kraPin: null,
        integrationType: null,
        status: 'NOT_REGISTERED',
        environment: null,
        canFileLive: false,
        commitmentFormAcknowledgedAt: null,
        submittedAt: null,
        kraApprovedAt: null,
        productionSubmittedAt: null,
        productionActivatedAt: null,
        statusNote: null,
        statusUpdatedAt: null,
      };
    }

    return {
      registered: true,
      kraPin: registration.kraPin,
      integrationType: registration.integrationType,
      status: registration.status,
      environment: registration.environment,
      canFileLive: isEtimsProductionActive(registration.status),
      commitmentFormAcknowledgedAt:
        registration.commitmentFormAcknowledgedAt,
      submittedAt: registration.submittedAt,
      kraApprovedAt: registration.kraApprovedAt,
      productionSubmittedAt: registration.productionSubmittedAt,
      productionActivatedAt: registration.productionActivatedAt,
      statusNote: registration.statusNote,
      statusUpdatedAt: registration.statusUpdatedAt,
    };
  }
}
