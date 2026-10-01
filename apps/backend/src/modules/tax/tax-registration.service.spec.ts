import { BadRequestException } from '@nestjs/common';
import {
  EtimsEnvironment,
  EtimsIntegrationType,
  EtimsRegistrationStatus,
  TaxRegistration,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import {
  TaxRegistrationService,
  TaxRegistrationStatus,
  isEtimsProductionActive,
} from './tax-registration.service';

function makeRegistration(
  overrides: Record<string, unknown> = {},
): TaxRegistration {
  return {
    id: 'tr_1',
    organizationId: 'org_1',
    kraPin: 'P051234567X',
    integrationType: EtimsIntegrationType.VSCU,
    status: EtimsRegistrationStatus.PIN_CAPTURED,
    environment: EtimsEnvironment.SANDBOX,
    commitmentFormAcknowledgedAt: null,
    submittedAt: null,
    kraApprovedAt: null,
    productionSubmittedAt: null,
    productionActivatedAt: null,
    statusNote: null,
    statusUpdatedAt: new Date('2026-09-01T00:00:00.000Z'),
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    ...overrides,
  } as unknown as TaxRegistration;
}

function build(seed: TaxRegistration | null) {
  let row = seed;
  const findUnique = jest.fn(async () => row);
  const create = jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
    row = {
      id: 'tr_new',
      statusUpdatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    } as unknown as TaxRegistration;
    return row;
  });
  const update = jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
    row = { ...(row ?? {}), ...data } as unknown as TaxRegistration;
    return row;
  });

  const prisma = {
    db: { taxRegistration: { findUnique, create, update } },
  };

  const service = new TaxRegistrationService(prisma as unknown as PrismaService);
  return { service, prisma, findUnique, create, update, getRow: () => row };
}

describe('TaxRegistrationService (Phase A)', () => {
  it('reports NOT_REGISTERED and no live filing when no row exists', async () => {
    const { service } = build(null);
    const view = await service.getView('org_1');

    expect(view.registered).toBe(false);
    expect(view.status).toBe('NOT_REGISTERED');
    expect(view.canFileLive).toBe(false);
    expect(view.kraPin).toBeNull();
  });

  it('captures a KRA PIN as PIN_CAPTURED — never as active', async () => {
    const { service, create } = build(null);
    const view = await service.save('org_1', { kraPin: 'P051234567X' });

    expect(create).toHaveBeenCalledTimes(1);
    expect(view.status).toBe(EtimsRegistrationStatus.PIN_CAPTURED);
    expect(view.environment).toBe(EtimsEnvironment.SANDBOX);
    expect(view.integrationType).toBe(EtimsIntegrationType.VSCU);
    expect(view.canFileLive).toBe(false);
  });

  it('resets a rejected registration to PIN_CAPTURED when the PIN is edited', async () => {
    const rejected = makeRegistration({
      status: EtimsRegistrationStatus.REJECTED,
      submittedAt: new Date(),
    });
    const { service } = build(rejected);
    const view = await service.save('org_1', { kraPin: 'P059999999Y' });

    expect(view.status).toBe(EtimsRegistrationStatus.PIN_CAPTURED);
    expect(view.canFileLive).toBe(false);
  });

  it('refuses to submit before a PIN is captured', async () => {
    const { service } = build(null);
    await expect(
      service.submit('org_1', { commitmentFormAcknowledged: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to submit without the Commitment Form acknowledged', async () => {
    const { service } = build(makeRegistration());
    await expect(
      service.submit('org_1', { commitmentFormAcknowledged: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('moves to PENDING_KRA_APPROVAL on submission — still not live', async () => {
    const { service, getRow } = build(makeRegistration());
    const before = new Date();
    const view = await service.submit('org_1', {
      commitmentFormAcknowledged: true,
    });

    expect(view.status).toBe(EtimsRegistrationStatus.PENDING_KRA_APPROVAL);
    expect(view.submittedAt).toBeInstanceOf(Date);
    expect(view.submittedAt!.getTime()).toBeGreaterThanOrEqual(
      before.getTime(),
    );
    expect(view.commitmentFormAcknowledgedAt).toBeInstanceOf(Date);
    expect(view.canFileLive).toBe(false);
    // Nothing is stored as an approved/active state.
    expect(getRow()?.kraApprovedAt).toBeNull();
  });

  it('refuses to record a KRA outcome before submission', async () => {
    const { service } = build(makeRegistration());
    await expect(
      service.recordOutcome('org_1', {
        status: EtimsRegistrationStatus.SANDBOX_ACTIVE,
        note: 'KRA SMS received',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses statuses that are not legitimately reportable here', async () => {
    const { service } = build(
      makeRegistration({
        status: EtimsRegistrationStatus.PENDING_KRA_APPROVAL,
        submittedAt: new Date(),
      }),
    );
    await expect(
      service.recordOutcome('org_1', {
        status: EtimsRegistrationStatus.PIN_CAPTURED,
        note: 'trying to reset via outcome endpoint',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records sandbox approval without enabling live filing', async () => {
    const { service } = build(
      makeRegistration({
        status: EtimsRegistrationStatus.PENDING_KRA_APPROVAL,
        submittedAt: new Date(),
      }),
    );
    const view = await service.recordOutcome('org_1', {
      status: EtimsRegistrationStatus.SANDBOX_ACTIVE,
      note: 'KRA SMS: sandbox approved',
    });

    expect(view.status).toBe(EtimsRegistrationStatus.SANDBOX_ACTIVE);
    expect(view.environment).toBe(EtimsEnvironment.SANDBOX);
    expect(view.kraApprovedAt).toBeInstanceOf(Date);
    expect(view.canFileLive).toBe(false);
  });

  it('enables live filing only on recorded production activation', async () => {
    const { service } = build(
      makeRegistration({
        status: EtimsRegistrationStatus.PENDING_PRODUCTION,
        submittedAt: new Date(),
        kraApprovedAt: new Date(),
      }),
    );
    const view = await service.recordOutcome('org_1', {
      status: EtimsRegistrationStatus.PRODUCTION_ACTIVE,
      note: 'KRA production approval ref 12345',
    });

    expect(view.status).toBe(EtimsRegistrationStatus.PRODUCTION_ACTIVE);
    expect(view.environment).toBe(EtimsEnvironment.PRODUCTION);
    expect(view.productionActivatedAt).toBeInstanceOf(Date);
    expect(view.canFileLive).toBe(true);
  });

  it('canFileLive is true only for PRODUCTION_ACTIVE', async () => {
    expect(
      isEtimsProductionActive(EtimsRegistrationStatus.PRODUCTION_ACTIVE),
    ).toBe(true);
    for (const status of [
      EtimsRegistrationStatus.PIN_CAPTURED,
      EtimsRegistrationStatus.PENDING_KRA_APPROVAL,
      EtimsRegistrationStatus.SANDBOX_ACTIVE,
      EtimsRegistrationStatus.PENDING_PRODUCTION,
      EtimsRegistrationStatus.REJECTED,
      EtimsRegistrationStatus.SUSPENDED,
      'NOT_REGISTERED',
      null,
    ] as (TaxRegistrationStatus | null)[]) {
      expect(isEtimsProductionActive(status)).toBe(false);
    }
  });
});
