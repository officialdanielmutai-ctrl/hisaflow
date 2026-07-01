import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from './useMyOrganization';
import { subscribeToPushNotifications } from '@/services/notifications.service';

export function usePushNotifications() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      // Check existing subscription
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then(async (sub) => {
          setSubscription(sub);
          // If we have a subscription, make sure the backend knows about it
          if (sub) {
            try {
              const token = await getToken();
              if (token && membership?.organization.id) {
                await subscribeToPushNotifications(token, membership.organization.id, sub);
              }
            } catch (e) {
              console.error('Failed to background sync subscription', e);
            }
          }
        });
      });
    }
  }, [getToken, membership]);

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError('Push notifications are not supported on this device/browser.');
      return;
    }
    
    setIsSubscribing(true);
    setError(null);
    
    try {
      const token = await getToken();
      if (!token || !membership?.organization.id) {
        throw new Error('Authentication required');
      }

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Permission denied for notifications');
      }

      // Subscribe to PushManager
      const reg = await navigator.serviceWorker.ready;
      
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      // Send to backend
      await subscribeToPushNotifications(token, membership.organization.id, sub);
      setSubscription(sub);
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to subscribe to push notifications');
    } finally {
      setIsSubscribing(false);
    }
  }, [isSupported, getToken, membership]);

  return {
    isSupported,
    subscription,
    isSubscribing,
    subscribe,
    error,
  };
}
