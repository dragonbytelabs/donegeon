/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";

declare let self: ServiceWorkerGlobalScope;

// Precache built assets (VitePWA injects __WB_MANIFEST)
precacheAndRoute(self.__WB_MANIFEST);

// Example: cache navigation shells (optional)
registerRoute(
  ({ request }) => request.mode === "navigate",
  new NetworkFirst({ cacheName: "pages" })
);

// Example: API reads (you’ll evolve this into outbox later)
registerRoute(
  ({ url, request }) => url.pathname.startsWith("/api/tasks") && request.method === "GET",
  new NetworkFirst({ cacheName: "api-tasks" })
);

// Example: static assets
registerRoute(
  ({ request }) => request.destination === "script" || request.destination === "style",
  new StaleWhileRevalidate({ cacheName: "assets" })
);
