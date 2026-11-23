// Offline-Betrieb: App-Dateien zwischenspeichern, beim Start im Hintergrund aktualisieren.
const CACHE = "satz-v0.2.0";
const FILES = ["./", "index.html", "css/app.css", "js/app.js", "js/store.js", "js/data.js", "manifest.webmanifest",
  "fonts/archivo.woff2", "icons/icon-192.png", "icons/icon-180.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, {ignoreSearch: true});
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
