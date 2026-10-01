/** Domain types for the VSCU signing/transmission boundary. */

export interface VscuLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  netAmount: number;
  taxAmount: number;
  taxRate: number;
}

export interface VscuSignInput {
  organizationId: string;
  invoiceId: string;
  invoiceNumber: string;
  /** The org's KRA PIN. */
  tin: string;
  branchId: string;
  saleDate: Date;
  currency: string;
  lineItems: VscuLineItem[];
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
}

export interface VscuTransmitInput extends VscuSignInput {
  receiptNumber: string;
  internalData: string;
  receiptSignature: string;
}

/**
 * The signature KRA's VSCU returns from `POST /trnsSales/saveSales`
 * (`TrnsSalesSaveRes.data`): receipt number, internal data and receipt
 * signature. These are issued locally, so they exist even while offline.
 */
export interface VscuSignature {
  receiptNumber: string;
  internalData: string;
  receiptSignature: string;
  totalReceipts?: string;
  publishedAt?: string;
  sdcId?: string;
  mrcNo?: string;
}

export interface VscuTransmissionResult {
  /** KRA-issued reference once the invoice is accepted. */
  kraInvoiceNumber: string;
}
