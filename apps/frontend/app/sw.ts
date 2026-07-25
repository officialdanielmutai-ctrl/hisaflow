/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

// ── Push Notification Handler ──────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || "HisaFlow Alert";
    const options: any = {
      body: data.body || "You have a new alert.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      vibrate: [200, 100, 200],
      tag: "hisaflow-alert",   // replaces previous notification instead of stacking
      renotify: true,
      requireInteraction: false,
      data: { url: data.url || "/alerts" },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (error) {
    console.error("[SW] Error handling push event:", error);
  }
});

// ── Notification Click Handler ─────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/alerts";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if already open
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            return;
          }
        }
        // Otherwise open a new tab
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

serwist.addEventListeners();
