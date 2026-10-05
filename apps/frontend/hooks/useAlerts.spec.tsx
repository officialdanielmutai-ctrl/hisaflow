import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const orgState = vi.hoisted(() => ({ membership: { organization: { id: 'org_1' } } as any }));
const swrState = vi.hoisted(() => ({
  data: [] as any[],
  error: null as any,
  isLoading: false,
  mutate: vi.fn(),
  fetcher: undefined as any,
}));
const alertsService = vi.hoisted(() => ({
  getActiveAlerts: vi.fn(async () => [{ id: 'a1' }]),
  resolveAlert: vi.fn(async () => ({})),
  resolveAllAlerts: vi.fn(async () => ({})),
  triggerAlertCheck: vi.fn(async () => ({})),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'tok', isLoaded: true }),
}));

vi.mock('@/hooks/useMyOrganization', () => ({
  useMyOrganization: () => ({ membership: orgState.membership }),
}));

vi.mock('swr', () => ({
  default: (_key: any, fetcher: any) => {
    swrState.fetcher = fetcher;
    return { data: swrState.data, error: swrState.error, isLoading: swrState.isLoading, mutate: swrState.mutate };
  },
}));

vi.mock('@/services/alerts.service', () => alertsService);

import { useAlerts } from './useAlerts';

describe('useAlerts', () => {
  beforeEach(() => {
    orgState.membership = { organization: { id: 'org_1' } };
    swrState.data = [{ id: 'a1' }, { id: 'a2' }];
    swrState.error = null;
    swrState.mutate.mockReset();
    alertsService.getActiveAlerts.mockClear();
    alertsService.resolveAlert.mockClear();
    alertsService.resolveAllAlerts.mockClear();
    alertsService.triggerAlertCheck.mockClear();
  });

  it('dismiss removes the alert optimistically then resolves it', async () => {
    const { result } = renderHook(() => useAlerts());

    await act(async () => {
      await result.current.dismiss('a1');
    });

    // Optimistic cache update: first mutate call is (updater, false).
    const updater = swrState.mutate.mock.calls[0][0];
    expect(updater([{ id: 'a1' }, { id: 'a2' }])).toEqual([{ id: 'a2' }]);
    expect(swrState.mutate.mock.calls[0][1]).toBe(false);

    expect(alertsService.resolveAlert).toHaveBeenCalledWith('a1', 'tok', 'org_1');
    expect(swrState.mutate).toHaveBeenCalledTimes(2); // optimistic + revalidate
  });

  it('dismissAll clears the cache optimistically then resolves all', async () => {
    const { result } = renderHook(() => useAlerts());

    await act(async () => {
      await result.current.dismissAll();
    });

    expect(swrState.mutate).toHaveBeenCalledWith([], false);
    expect(alertsService.resolveAllAlerts).toHaveBeenCalledWith('tok', 'org_1');
  });

  it('revalidates (reverts) when dismissal fails', async () => {
    alertsService.resolveAlert.mockRejectedValueOnce(new Error('network'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useAlerts());

    await act(async () => {
      await result.current.dismiss('a1');
    });

    expect(swrState.mutate).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });

  it('no-ops when there is no organisation', async () => {
    orgState.membership = null;
    const { result } = renderHook(() => useAlerts());

    await act(async () => {
      await result.current.dismiss('a1');
    });

    expect(alertsService.resolveAlert).not.toHaveBeenCalled();
    expect(swrState.mutate).not.toHaveBeenCalled();
  });

  it('fetcher triggers the anomaly check when requested', async () => {
    renderHook(() => useAlerts({ triggerCheck: true }));

    await act(async () => {
      await swrState.fetcher(['active-alerts', 'org_1']);
    });

    expect(alertsService.triggerAlertCheck).toHaveBeenCalledWith('tok', 'org_1');
    expect(alertsService.getActiveAlerts).toHaveBeenCalledWith('tok', 'org_1');
  });
});
