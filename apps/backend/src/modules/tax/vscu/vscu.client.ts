import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VscuApiError, VscuConnectionError } from './vscu.errors';
import {
  VscuSignature,
  VscuSignInput,
  VscuTransmissionResult,
  VscuTransmitInput,
} from './vscu.types';

/**
 * VSCU signing/transmission boundary (tax-system doc Section 2, Phase C).
 *
 * Verified against KRA's current *VSCU Specification Document v2.0*:
 *  - VSCU is a JAR deployed on the taxpayer's local server ("a bridge system
 *    between KRA eTIMS systems and private TIS/ERP").
 *  - `POST /trnsSales/saveSales` returns the local signature: `rcptNo`
 *    (receipt number), `intrlData` (internal data), `rcptSign` (receipt
 *    signature).
 *  - It keeps issuing receipt signatures for up to 24 hours without internet,
 *    which is why signing is treated as offline-capable.
 *
 * `sign()` talks to the local VSCU bridge (reachable offline). `transmit()`
 * confirms delivery to KRA. The exact live KRA request/auth contract still
 * needs verification with real credentials — tracked as open finding F-21 —
 * but the failure classification below (no response vs error response) is what
 * Phase C's queue logic depends on and is fully tested.
 */
@Injectable()
export class VscuClient {
  private readonly logger = new Logger(VscuClient.name);

  constructor(private readonly config: ConfigService) {}

  private get vscuBaseUrl(): string {
    return trimSlash(
      this.config.get<string>('etims.vscuBaseUrl') || 'http://localhost:8088',
    );
  }

  private get apiBaseUrl(): string {
    return trimSlash(
      this.config.get<string>('etims.apiBaseUrl') ||
        'https://etims-api.kra.go.ke',
    );
  }

  private get apiKey(): string {
    return this.config.get<string>('etims.apiKey') || '';
  }

  private get timeoutMs(): number {
    return this.config.get<number>('etims.requestTimeoutMs') ?? 10_000;
  }

  /** Sign locally through the VSCU bridge. Works while offline. */
  async sign(input: VscuSignInput): Promise<VscuSignature> {
    const data = await this.post(
      `${this.vscuBaseUrl}/trnsSales/saveSales`,
      this.toSalesPayload(input),
      false,
    );
    return {
      receiptNumber: asText(data.rcptNo),
      internalData: asText(data.intrlData),
      receiptSignature: asText(data.rcptSign),
      totalReceipts: optionalText(data.totRcptNo),
      publishedAt: optionalText(data.VSCURcptPbctDate),
      sdcId: optionalText(data.sdcId),
      mrcNo: optionalText(data.mrcNo),
    };
  }

  /**
   * Confirm/push the signed invoice to KRA. A thrown `VscuConnectionError`
   * means no response at all (device offline); a `VscuApiError` means KRA
   * answered with an error (backoff + alert).
   */
  async transmit(input: VscuTransmitInput): Promise<VscuTransmissionResult> {
    const data = await this.post(
      `${this.apiBaseUrl}/trnsSales/saveSales`,
      {
        ...this.toSalesPayload(input),
        rcptNo: input.receiptNumber,
        intrlData: input.internalData,
        rcptSign: input.receiptSignature,
      },
      true,
    );
    return {
      kraInvoiceNumber: optionalText(data.rcptNo) ?? input.receiptNumber,
    };
  }

  private toSalesPayload(input: VscuSignInput): Record<string, unknown> {
    return {
      tin: input.tin,
      bhfId: input.branchId,
      invcNo: input.invoiceNumber,
      orgInvcNo: input.invoiceNumber,
      currency: input.currency,
      salesDt: formatDate(input.saleDate),
      cfmDt: formatDateTime(input.saleDate),
      totItemCnt: input.lineItems.length,
      taxblAmtA: input.netAmount,
      taxAmtA: input.taxAmount,
      taxRtA: input.lineItems[0]?.taxRate ?? 0,
      itemList: input.lineItems.map((item, index) => ({
        itemSeq: index + 1,
        itemNm: item.description,
        qty: item.quantity,
        prc: item.unitPrice,
        splyAmt: item.netAmount,
        taxblAmt: item.netAmount,
        taxAmt: item.taxAmount,
        taxTyCd: item.taxRate > 0 ? 'B' : 'A',
        totAmt: round2(item.unitPrice * item.quantity),
      })),
    };
  }

  private async post(
    url: string,
    body: Record<string, unknown>,
    authenticated: boolean,
  ): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authenticated && this.apiKey
            ? { Authorization: `Bearer ${this.apiKey}` }
            : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      // No response at all — device offline / bridge unreachable.
      throw new VscuConnectionError(
        err instanceof Error ? err.message : 'eTIMS request failed',
      );
    }

    const text = await response.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      throw new VscuApiError(
        `eTIMS returned a non-JSON response (${response.status})`,
        String(response.status),
      );
    }

    if (!response.ok) {
      throw new VscuApiError(
        asText(parsed.resultMsg) || `eTIMS HTTP ${response.status}`,
        String(response.status),
      );
    }

    const resultCd = optionalText(parsed.resultCd);
    if (resultCd && resultCd !== '000') {
      throw new VscuApiError(
        asText(parsed.resultMsg) || `eTIMS rejected the invoice (${resultCd})`,
        resultCd,
      );
    }

    this.logger.log(`eTIMS call ok: ${url}`);
    return parsed.data && typeof parsed.data === 'object'
      ? (parsed.data as Record<string, unknown>)
      : {};
  }
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function asText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function optionalText(value: unknown): string | undefined {
  const text = asText(value);
  return text.length > 0 ? text : undefined;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function formatDateTime(date: Date): string {
  return `${formatDate(date)}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
