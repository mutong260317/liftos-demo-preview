/* LiftOS Service Worker — cache-first for static shell */
const CACHE = "liftos-v0.2";
const ASSETS = [
  "./",
  "./index.html",
  "./css/tokens.css",
  "./css/base.css",
  "./css/components.css",
  "./css/training.css",
  "./css/screens.css",
  "./js/data.js",
  "./js/storage.js",
  "./js/stats.js",
  "./js/progression.js",
  "./js/plans.js",
  "./js/workout.js",
  "./js/app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS).catch(() => cache.addAll(["./index.html"])))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((hit) => {
      if (hit) return hit;
      return fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
