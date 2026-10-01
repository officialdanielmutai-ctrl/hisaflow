import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Phase B enforcement: creating an `Invoice` / `InvoiceLineItem` is only legal
 * through `InvoiceTaxService`, which calculates tax automatically. If a raw
 * `invoice.create` / `invoiceLineItem.create` reappears anywhere else, this
 * test fails — that is the "architecturally impossible to skip tax" guarantee,
 * checked on every test run rather than left to code review.
 */

const RAW_CREATE = new RegExp(
  [
    '\\.invoice\\.create\\(',
    '\\.invoice\\.createMany\\(',
    '\\.invoiceLineItem\\.create\\(',
    '\\.invoiceLineItem\\.createMany\\(',
  ].join('|'),
);

const ALLOWED_FILE = 'invoice-tax.service.ts';

function listTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      listTsFiles(full, acc);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

describe('invoice creation is centralised (Phase B)', () => {
  it('has no raw invoice or line-item creation outside InvoiceTaxService', () => {
    const srcDir = join(__dirname, '..', '..');

    const offenders = listTsFiles(srcDir).filter((file) => {
      if (file.endsWith(ALLOWED_FILE)) return false;
      return RAW_CREATE.test(readFileSync(file, 'utf8'));
    });

    expect(offenders).toEqual([]);
  });
});
