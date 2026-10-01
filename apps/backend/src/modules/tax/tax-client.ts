import { PrismaClient } from '@prisma/client';

/**
 * The slice of the Prisma client the tax services need. Both `PrismaClient` and
 * a `$transaction` client (`Prisma.TransactionClient`) satisfy it, so the
 * tax-aware invoice factory and the filing service can run inside a caller's
 * existing transaction without reaching for a global client.
 */
export type TaxDbClient = Pick<
  PrismaClient,
  | 'invoice'
  | 'invoiceLineItem'
  | 'taxRegistration'
  | 'taxInvoiceRecord'
  | 'taxSyncQueue'
>;
