import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from './useMyOrganization';
import { subscribeToPushNotifications } from '@/services/notifications.service';

export function usePushNotifications() {
  const { getToken } = useAuth();
  const { membership, loading: orgLoading } = useMyOrganization();
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check support and existing subscription on mount
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setSubscription(sub);
        });
      });
    }
  }, []);

  // Once membership loads, background-sync any existing subscription with the backend
  useEffect(() => {
    if (orgLoading || !membership?.organization.id || !subscription) return;
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          await subscribeToPushNotifications(token, membership.organization.id, subscription);
        }
      } catch (e) {
        console.error('Background push sync failed:', e);
      }
    })();
  }, [membership, subscription, orgLoading, getToken]);

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError('Push notifications are not supported on this device/browser.');
      return;
    }

    if (orgLoading) {
      setError('Still loading your account — please try again in a moment.');
      return;
    }

    setIsSubscribing(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('You are not logged in.');
      if (!membership?.organization.id) throw new Error('No organization found for your account.');

      // Request OS-level permission
      const permission = await Notification.requestPermission();
      if (permission === 'denied') throw new Error('Notification permission was denied. Please enable it in your browser settings.');
      if (permission !== 'granted') throw new Error('Notification permission was not granted.');

      // Subscribe via PushManager using the VAPID public key
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error('Push configuration is missing. Contact support.');

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });

      // Save subscription to backend
      await subscribeToPushNotifications(token, membership.organization.id, sub);
      setSubscription(sub);

    } catch (err: any) {
      console.error('Push subscribe error:', err);
      setError(err.message || 'Failed to enable notifications. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  }, [isSupported, orgLoading, getToken, membership]);

  return {
    isSupported,
    subscription,
    isSubscribing,
    orgLoading,
    subscribe,
    error,
  };
}
