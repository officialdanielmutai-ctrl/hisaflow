import { PrismaService } from '../../../infrastructure/prisma.service';
import { RouterActionService } from './router-action.service';
import { BillingSuspendJob } from './billing-suspend.job';

function build(invoices: any[] = []) {
  const invoice: any = {
    findMany: jest.fn(async (): Promise<any[]> => invoices),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  };
  const db: any = { invoice };
  const routerActionService: any = {
    suspend: jest.fn(async () => ({ success: true, actionId: 'ra_1' })),
  };
  const service = new BillingSuspendJob(
    { db } as unknown as PrismaService,
    routerActionService as unknown as RouterActionService,
  );
  return { service, invoice, routerActionService };
}

describe('BillingSuspendJob', () => {
  it('does nothing when there are no overdue invoices', async () => {
    const { service, invoice, routerActionService } = build([]);

    await service.handleOverdueInvoices();

    expect(routerActionService.suspend).not.toHaveBeenCalled();
    expect(invoice.update).not.toHaveBeenCalled();
  });

  it('marks invoices processed when the subscriber has no router linked', async () => {
    const { service, invoice, routerActionService } = build([
      { id: 'inv_1', subscriber: { id: 'sub_1', organizationId: 'org_1', routerId: null } },
    ]);

    await service.handleOverdueInvoices();

    expect(routerActionService.suspend).not.toHaveBeenCalled();
    expect(invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv_1' },
      data: { suspendedForNonPayment: true },
    });
  });

  it('suspends the subscriber on the router and marks the invoice processed', async () => {
    const { service, invoice, routerActionService } = build([
      { id: 'inv_1', subscriber: { id: 'sub_1', organizationId: 'org_1', routerId: 'r1' } },
    ]);

    await service.handleOverdueInvoices();

    expect(routerActionService.suspend).toHaveBeenCalledWith('org_1', 'sub_1', 'billing');
    expect(invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv_1' },
      data: { suspendedForNonPayment: true },
    });
  });

  it('still marks the invoice processed when the router action fails', async () => {
    const { service, invoice, routerActionService } = build([
      { id: 'inv_1', subscriber: { id: 'sub_1', organizationId: 'org_1', routerId: 'r1' } },
    ]);
    routerActionService.suspend.mockResolvedValueOnce({ success: false, actionId: 'ra_1', error: 'timeout' });

    await service.handleOverdueInvoices();

    expect(invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv_1' },
      data: { suspendedForNonPayment: true },
    });
  });
});
