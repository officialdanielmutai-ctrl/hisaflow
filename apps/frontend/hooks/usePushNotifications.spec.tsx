import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  membership: { organization: { id: 'org_1' } } as any,
  orgLoading: false,
  subscribeToPush: vi.fn(async () => ({})),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'tok' }),
}));

vi.mock('@/hooks/useMyOrganization', () => ({
  useMyOrganization: () => ({ membership: state.membership, loading: state.orgLoading }),
}));

vi.mock('@/services/notifications.service', () => ({
  subscribeToPushNotifications: state.subscribeToPush,
}));

import { usePushNotifications } from './usePushNotifications';

const VAPID = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

let registration: any;

function installGlobals() {
  registration = {
    pushManager: {
      getSubscription: vi.fn(async () => null),
      subscribe: vi.fn(async () => ({ endpoint: 'https://push/1' })),
    },
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      getRegistration: vi.fn(async () => registration),
      register: vi.fn(async () => registration),
      ready: Promise.resolve(registration),
    },
  });
  (window as any).PushManager = function PushManager() {};
  (globalThis as any).Notification = { requestPermission: vi.fn(async () => 'granted') };
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = VAPID;
}

async function renderSupported() {
  const view = renderHook(() => usePushNotifications());
  await waitFor(() => expect(view.result.current.isSupported).toBe(true));
  return view;
}

describe('usePushNotifications', () => {
  beforeEach(() => {
    state.membership = { organization: { id: 'org_1' } };
    state.orgLoading = false;
    state.subscribeToPush.mockReset();
    state.subscribeToPush.mockResolvedValue({});
    installGlobals();
  });

  it('reports unsupported when the browser has no service worker', async () => {
    delete (navigator as any).serviceWorker;
    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.subscribe();
    });

    expect(result.current.error).toMatch(/not supported/i);
    expect(state.subscribeToPush).not.toHaveBeenCalled();
  });

  it('blocks while the organisation is still loading', async () => {
    state.orgLoading = true;
    const { result } = await renderSupported();

    await act(async () => {
      await result.current.subscribe();
    });

    expect(result.current.error).toMatch(/still loading/i);
  });

  it('surfaces a denied notification permission', async () => {
    (globalThis as any).Notification = { requestPermission: vi.fn(async () => 'denied') };
    const { result } = await renderSupported();

    await act(async () => {
      await result.current.subscribe();
    });

    expect(result.current.error).toMatch(/denied/i);
    expect(state.subscribeToPush).not.toHaveBeenCalled();
  });

  it('requires the VAPID configuration', async () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const { result } = await renderSupported();

    await act(async () => {
      await result.current.subscribe();
    });

    expect(result.current.error).toMatch(/configuration is missing/i);
  });

  it('subscribes through the push manager and registers with the backend', async () => {
    const { result } = await renderSupported();

    await act(async () => {
      await result.current.subscribe();
    });

    expect(registration.pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true, applicationServerKey: expect.any(Uint8Array) }),
    );
    expect(state.subscribeToPush).toHaveBeenCalledWith(
      'tok',
      'org_1',
      expect.objectContaining({ endpoint: 'https://push/1' }),
    );
    expect(result.current.subscription).toMatchObject({ endpoint: 'https://push/1' });
    expect(result.current.error).toBeNull();
  });

  it('background-syncs an existing subscription once the org loads', async () => {
    registration.pushManager.getSubscription.mockResolvedValue({ endpoint: 'https://push/existing' });
    await renderSupported();

    await waitFor(() =>
      expect(state.subscribeToPush).toHaveBeenCalledWith(
        'tok',
        'org_1',
        expect.objectContaining({ endpoint: 'https://push/existing' }),
      ),
    );
  });
});
