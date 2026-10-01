import { ConfigService } from '@nestjs/config';
import { VscuClient } from './vscu.client';
import { VscuApiError, VscuConnectionError } from './vscu.errors';
import { VscuSignInput } from './vscu.types';

const config = {
  get: (key: string) =>
    ({
      'etims.vscuBaseUrl': 'http://localhost:8088',
      'etims.apiBaseUrl': 'https://api.kra.go.ke',
      'etims.requestTimeoutMs': 1000,
      'etims.apiKey': 'test-key',
      'etims.branchId': '00',
    })[key],
} as unknown as ConfigService;

const signInput: VscuSignInput = {
  organizationId: 'org_1',
  invoiceId: 'inv_1',
  invoiceNumber: 'INV-1',
  tin: 'P051234567X',
  branchId: '00',
  saleDate: new Date('2026-09-30T10:00:00.000Z'),
  currency: 'KES',
  lineItems: [
    {
      description: 'Item',
      quantity: 1,
      unitPrice: 1160,
      netAmount: 1000,
      taxAmount: 160,
      taxRate: 0.16,
    },
  ],
  netAmount: 1000,
  taxAmount: 160,
  grossAmount: 1160,
};

const transmitInput = {
  ...signInput,
  receiptNumber: '55',
  internalData: 'INT',
  receiptSignature: 'SIG',
};

describe('VscuClient (Phase C)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  function mockFetch(
    impl: (url: string, init?: RequestInit) => Promise<Partial<Response>>,
  ): jest.Mock {
    const fn = jest.fn(impl);
    global.fetch = fn as unknown as typeof fetch;
    return fn;
  }

  it('signs through the local VSCU bridge and parses the signature', async () => {
    const fetchMock = mockFetch(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          resultCd: '000',
          resultMsg: 'ok',
          data: { rcptNo: 27, intrlData: 'INT', rcptSign: 'SIG' },
        }),
    }));

    const signature = await new VscuClient(config).sign(signInput);

    expect(signature.receiptNumber).toBe('27');
    expect(signature.internalData).toBe('INT');
    expect(signature.receiptSignature).toBe('SIG');
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      'localhost:8088/trnsSales/saveSales',
    );
  });

  it('classifies no response at all as offline (VscuConnectionError)', async () => {
    mockFetch(async () => {
      throw new Error('fetch failed');
    });

    await expect(
      new VscuClient(config).transmit(transmitInput),
    ).rejects.toBeInstanceOf(VscuConnectionError);
  });

  it('classifies an HTTP error response as VscuApiError', async () => {
    mockFetch(async () => ({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ resultMsg: 'server error' }),
    }));

    await expect(
      new VscuClient(config).transmit(transmitInput),
    ).rejects.toBeInstanceOf(VscuApiError);
  });

  it('classifies a non-000 KRA result code as VscuApiError', async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ resultCd: '101', resultMsg: 'rejected' }),
    }));

    await expect(new VscuClient(config).sign(signInput)).rejects.toBeInstanceOf(
      VscuApiError,
    );
  });

  it('transmits to the KRA API and returns the accepted reference', async () => {
    const fetchMock = mockFetch(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ resultCd: '000', data: { rcptNo: 'KRA-55' } }),
    }));

    const result = await new VscuClient(config).transmit(transmitInput);

    expect(result.kraInvoiceNumber).toBe('KRA-55');
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.kra.go.ke');
  });
});
