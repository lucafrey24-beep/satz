// Offline-Betrieb. Strategie: zuerst Netzwerk (immer die neueste Version), bei fehlendem Netz der Zwischenspeicher.
// Bei jeder Veröffentlichung CACHE erhöhen, damit installierte Apps die alten Dateien verwerfen.
const CACHE = "satz-v0.2.1";
const FILES = ["./", "index.html", "css/app.css", "js/app.js", "js/store.js", "js/data.js", "manifest.webmanifest",
  "fonts/archivo.woff2", "icons/icon-192.png", "icons/icon-180.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, {cache: "reload"})))));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const r = await fetch(e.request, {cache: "no-cache"});
      if (r.ok) c.put(e.request, r.clone());
      return r;
    } catch (err) {
      return (await c.match(e.request, {ignoreSearch: true})) || (e.request.mode === "navigate" ? c.match("index.html") : Response.error());
    }
  })());
});
