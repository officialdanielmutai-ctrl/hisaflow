import { aggregateByLocation, TaxLocationRecord } from './tax-aggregation';

describe('aggregateByLocation (Phase F)', () => {
  it('rolls locations up into a grand total automatically', () => {
    const records: TaxLocationRecord[] = [
      { location: 'Tower A', status: 'SYNCED', netAmount: 1000, taxAmount: 160, grossAmount: 1160 },
      { location: 'Tower B', status: 'SYNCED', netAmount: 2000, taxAmount: 320, grossAmount: 2320 },
      { location: 'Main location', status: 'PENDING', netAmount: 500, taxAmount: 80, grossAmount: 580 },
    ];

    const { locations, totals } = aggregateByLocation(records);

    // Sorted by gross, highest first.
    expect(locations.map((location) => location.location)).toEqual([
      'Tower B',
      'Tower A',
      'Main location',
    ]);
    expect(totals.invoiceCount).toBe(3);
    expect(totals.filed).toBe(2);
    expect(totals.pending).toBe(1);
    expect(totals.taxableAmount).toBe(3000);
    expect(totals.taxAmount).toBe(480);
    expect(totals.grossAmount).toBe(3480);
    expect(totals.pendingTaxAmount).toBe(80);
  });

  it('handles an org with a single location', () => {
    const { locations, totals } = aggregateByLocation([
      { location: 'Main location', status: 'SYNCED', netAmount: 1000, taxAmount: 160, grossAmount: 1160 },
    ]);

    expect(locations).toHaveLength(1);
    expect(totals.taxAmount).toBe(160);
  });

  it('returns zeroed totals for an empty period', () => {
    const { locations, totals } = aggregateByLocation([]);

    expect(locations).toEqual([]);
    expect(totals.location).toBe('All locations');
    expect(totals.taxAmount).toBe(0);
    expect(totals.invoiceCount).toBe(0);
  });

  it('counts failed filings per location', () => {
    const { locations } = aggregateByLocation([
      { location: 'Tower A', status: 'FAILED', netAmount: 0, taxAmount: 160, grossAmount: 1160 },
    ]);

    expect(locations[0].failed).toBe(1);
    expect(locations[0].filed).toBe(0);
  });
});
