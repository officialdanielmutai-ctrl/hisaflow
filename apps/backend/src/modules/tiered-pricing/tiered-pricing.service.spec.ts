import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreateTieredPriceRuleDto } from './dto/create-tiered-price-rule.dto';
import { TieredPricingService } from './tiered-pricing.service';
import { expectEveryCallScopedToOrg } from '../../test-utils/tenant-isolation';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';
const decimal = (value: number | string) => new Prisma.Decimal(value);

function rule(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'rule_1',
    organizationId: ORG,
    inventoryItemId: 'item_1',
    minQuantity: decimal(5),
    pricePerUnit: decimal('100.00'),
    label: 'Wholesale',
    ...overrides,
  };
}

function build(rules: any[] = [rule()]) {
  const findMany = jest.fn(async (args: any) => {
    const scoped = rules.filter(
      (r: any) => r.organizationId === args?.where?.organizationId,
    );
    const direction = args?.orderBy?.minQuantity;
    if (direction === 'desc') {
      scoped.sort((a: any, b: any) => b.minQuantity.toNumber() - a.minQuantity.toNumber());
    } else if (direction === 'asc') {
      scoped.sort((a: any, b: any) => a.minQuantity.toNumber() - b.minQuantity.toNumber());
    }
    return scoped;
  });
  const deleteMany = jest.fn(async () => ({ count: 0 }));
  const createMany = jest.fn(async ({ data }: any) => ({ count: data.length }));
  const findFirstOrThrow = jest.fn(async (args: any) => {
    const match = rules.find(
      (r: any) => r.id === args?.where?.id && r.organizationId === args?.where?.organizationId,
    );
    if (!match) throw new Error('not found');
    return match;
  });
  const del = jest.fn(async ({ where }: any) => ({ id: where.id }));

  const tx = {
    tieredPriceRule: { deleteMany, createMany, findMany },
  };
  const $transaction = jest.fn(async (cb: any) =>
    typeof cb === 'function' ? cb(tx) : Promise.all(cb),
  );

  const db: any = {
    tieredPriceRule: { findMany, deleteMany, createMany, findFirstOrThrow, delete: del },
    $transaction,
  };
  const service = new TieredPricingService({ db } as unknown as PrismaService);

  return { service, findMany, deleteMany, createMany, findFirstOrThrow, del, $transaction };
}

describe('TieredPricingService', () => {
  it('lists rules for the org and item in ascending min-quantity order', async () => {
    const { service, findMany } = build();

    await service.findByItem('item_1', ORG);

    expect(findMany).toHaveBeenCalledWith({
      where: { organizationId: ORG, inventoryItemId: 'item_1' },
      orderBy: { minQuantity: 'asc' },
    });
    expectEveryCallScopedToOrg(findMany, ORG);
  });

  it('does not leak another org\u2019s pricing rules', async () => {
    const foreign = rule({ id: 'rule_foreign', organizationId: OTHER_ORG });
    const { service } = build([rule(), foreign]);

    const rows = (await service.findByItem('item_1', ORG)) as Array<{ id: string }>;

    expect(rows.map((r) => r.id)).toEqual(['rule_1']);
  });

  it('replaces the rule set atomically inside a transaction', async () => {
    const { service, deleteMany, createMany, $transaction } = build();
    const rules: CreateTieredPriceRuleDto[] = [
      { inventoryItemId: 'item_1', minQuantity: 1, pricePerUnit: 120 },
      { inventoryItemId: 'item_1', minQuantity: 10, pricePerUnit: 95 },
    ];

    await service.upsertRules(ORG, 'item_1', rules);

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { organizationId: ORG, inventoryItemId: 'item_1' },
    });
    expect(createMany).toHaveBeenCalledTimes(1);
    const created = createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(created).toHaveLength(2);
    for (const row of created) expect(row.organizationId).toBe(ORG);
  });

  it('skips createMany when the replacement set is empty', async () => {
    const { service, createMany, deleteMany } = build();

    await service.upsertRules(ORG, 'item_1', []);

    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('resolves the highest qualifying tier price for a quantity', async () => {
    const { service } = build([
      rule({ id: 'r1', minQuantity: decimal(1), pricePerUnit: decimal('120') }),
      rule({ id: 'r2', minQuantity: decimal(5), pricePerUnit: decimal('100') }),
      rule({ id: 'r3', minQuantity: decimal(20), pricePerUnit: decimal('80') }),
    ]);

    const price = await service.resolvePrice(ORG, 'item_1', 10);

    expect(price?.toString()).toBe('100');
  });

  it('returns null when no tier qualifies', async () => {
    const { service } = build([
      rule({ id: 'r1', minQuantity: decimal(50), pricePerUnit: decimal('70') }),
    ]);

    await expect(service.resolvePrice(ORG, 'item_1', 10)).resolves.toBeNull();
  });

  it('deletes only after confirming the rule belongs to the org', async () => {
    const { service, findFirstOrThrow, del } = build();

    await service.deleteRule('rule_1', ORG);

    expect(findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'rule_1', organizationId: ORG },
    });
    expect(del).toHaveBeenCalledWith({ where: { id: 'rule_1' } });
  });

  it('refuses to delete another org\u2019s rule', async () => {
    const foreign = rule({ id: 'rule_foreign', organizationId: OTHER_ORG });
    const { service, del } = build([foreign]);

    await expect(service.deleteRule('rule_foreign', ORG)).rejects.toThrow('not found');
    expect(del).not.toHaveBeenCalled();
  });
});
