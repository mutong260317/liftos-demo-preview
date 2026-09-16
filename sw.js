/* LiftOS Service Worker — versioned cache, skip-waiting updates */
const CACHE = "liftos-v0.3.1";
const ASSETS = [
  "./",
  "./index.html",
  "./css/tokens.css",
  "./css/base.css",
  "./css/components.css",
  "./css/training.css",
  "./css/screens.css",
  "./js/migrations.js",
  "./js/data.js",
  "./js/storage.js",
  "./js/stats.js",
  "./js/progression.js",
  "./js/plans.js",
  "./js/workout.js",
  "./js/gym.js",
  "./js/app.js",
  "./manifest.json",
  "./version.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // Cache each asset independently so one failure does not discard the rest
      await Promise.all(
        ASSETS.map((url) =>
          cache.add(url).catch(() => {
            /* optional asset failed — continue */
          })
        )
      );
      // Guarantee core shell
      await Promise.all(["./index.html", "./version.json"].map((u) => cache.add(u).catch(() => {})));
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // version.json always network-first for update checks
  if (url.pathname.endsWith("version.json")) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
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
