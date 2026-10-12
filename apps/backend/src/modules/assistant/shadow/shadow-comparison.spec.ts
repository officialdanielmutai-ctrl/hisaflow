import type { ParsedAction } from '../../ai-ingestion/ai-ingestion.service';
import {
  compareCalls,
  legacyActionToCall,
  legacyActionsToCalls,
  type MappedCall,
} from './shadow-comparison';

function action(
  partial: Partial<ParsedAction> & { type: ParsedAction['type'] },
): ParsedAction {
  return {
    itemId: null,
    itemName: 'Item',
    quantity: 1,
    confidence: 'HIGH',
    ...partial,
  };
}

describe('legacyActionToCall', () => {
  it('maps the DUKA action shapes to the matching tool', () => {
    expect(
      legacyActionToCall(action({ type: 'SALE', itemId: 'i1', quantity: 3 })),
    ).toEqual({ tool: 'record_sale', args: { itemId: 'i1', quantity: 3 } });
    expect(
      legacyActionToCall(action({ type: 'PURCHASE', itemId: 'i1', quantity: 5 })),
    ).toEqual({ tool: 'record_purchase', args: { itemId: 'i1', quantity: 5 } });
    expect(
      legacyActionToCall(
        action({
          type: 'WASTAGE',
          itemId: 'i1',
          quantity: 2,
          wastageReason: 'expired',
        }),
      ),
    ).toEqual({
      tool: 'record_wastage',
      args: { itemId: 'i1', quantity: 2, wastageReason: 'expired' },
    });
    expect(
      legacyActionToCall(action({ type: 'CREATE', itemName: 'Cooking Oil' })),
    ).toEqual({
      tool: 'create_inventory_item',
      args: { name: 'Cooking Oil', quantity: 1 },
    });
    expect(
      legacyActionToCall(action({ type: 'NOTE', title: 'Restock' })),
    ).toEqual({ tool: 'create_note', args: { title: 'Restock' } });
  });

  it('returns null for actions with no DUKA tool', () => {
    expect(legacyActionToCall(action({ type: 'BOOKING' }))).toBeNull();
    expect(legacyActionToCall(action({ type: 'GUEST' }))).toBeNull();
    expect(legacyActionToCall(action({ type: 'ROOM' }))).toBeNull();
  });
});

describe('compareCalls', () => {
  const legacy: MappedCall[] = [
    { tool: 'record_sale', args: { itemId: 'i1', quantity: 3 } },
    { tool: 'record_purchase', args: { itemId: 'i2', quantity: 5 } },
  ];

  it('scores identical calls 1.0 regardless of order', () => {
    const report = compareCalls(legacy, [
      { tool: 'record_purchase', args: { itemId: 'i2', quantity: 5 } },
      { tool: 'record_sale', args: { itemId: 'i1', quantity: 3 } },
    ]);
    expect(report.exact).toBe(2);
    expect(report.missing).toBe(0);
    expect(report.extra).toBe(0);
    expect(report.score).toBe(1);
  });

  it('counts same-tool different-args as partial', () => {
    const report = compareCalls(legacy, [
      { tool: 'record_sale', args: { itemId: 'i1', quantity: 4 } },
      { tool: 'record_purchase', args: { itemId: 'i2', quantity: 5 } },
    ]);
    expect(report.exact).toBe(1);
    expect(report.partial).toBe(1);
    expect(report.details[0]).toMatchObject({ reason: 'args-differ' });
    expect(report.score).toBe(0.5);
  });

  it('reports missing and extra calls', () => {
    const report = compareCalls(legacy, [
      { tool: 'record_sale', args: { itemId: 'i1', quantity: 3 } },
      { tool: 'create_note', args: { title: 'x' } },
    ]);
    expect(report.exact).toBe(1);
    expect(report.missing).toBe(1);
    expect(report.extra).toBe(1);
    expect(report.score).toBe(0.5);
  });

  it('treats an empty legacy list as a perfect score', () => {
    expect(compareCalls([], []).score).toBe(1);
  });
});

describe('legacyActionsToCalls', () => {
  it('drops unmapped actions', () => {
    const calls = legacyActionsToCalls([
      action({ type: 'SALE', itemId: 'i1' }),
      action({ type: 'BOOKING' }),
    ]);
    expect(calls).toEqual([{ tool: 'record_sale', args: { itemId: 'i1', quantity: 1 } }]);
  });
});
