import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMyOrganization } from "./useMyOrganization";
import { subscribeToPushNotifications } from "@/services/notifications.service";

// Converts a VAPID base64url public key string into a Uint8Array
// required by pushManager.subscribe(). Many browsers reject raw strings.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  // If already registered, return the existing registration
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export function usePushNotifications() {
  const { getToken } = useAuth();
  const { membership, loading: orgLoading } = useMyOrganization();
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect support and load existing subscription on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setIsSupported(true);

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscription(sub))
      .catch(() => {});
  }, []);

  // When membership loads, background-sync any existing subscription
  useEffect(() => {
    if (orgLoading || !membership?.organization.id || !subscription) return;
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          await subscribeToPushNotifications(token, membership.organization.id, subscription);
        }
      } catch (e) {
        console.warn("[Push] Background sync failed:", e);
      }
    })();
  }, [membership, subscription, orgLoading, getToken]);

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError("Push notifications are not supported on this device or browser.");
      return;
    }
    if (orgLoading) {
      setError("Still loading your account — please try again in a moment.");
      return;
    }

    setIsSubscribing(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("You are not logged in.");
      if (!membership?.organization.id) throw new Error("No organisation found for your account.");

      // 1. Request OS-level notification permission
      const permission = await Notification.requestPermission();
      if (permission === "denied")
        throw new Error("Notification permission was denied. Please enable it in your browser or OS settings.");
      if (permission !== "granted")
        throw new Error("Notification permission was not granted.");

      // 2. Ensure SW is registered
      const reg = await registerServiceWorker();
      await navigator.serviceWorker.ready;

      // 3. Get VAPID key and convert to Uint8Array (required by browsers)
      const vapidKeyStr = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKeyStr) throw new Error("Push configuration is missing. Contact support.");
      const applicationServerKey = urlBase64ToUint8Array(vapidKeyStr);

      // 4. Subscribe via PushManager
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // 5. Register subscription with backend
      await subscribeToPushNotifications(token, membership.organization.id, sub);
      setSubscription(sub);
    } catch (err: any) {
      console.error("[Push] Subscribe error:", err);
      setError(err.message || "Failed to enable notifications. Please try again.");
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
