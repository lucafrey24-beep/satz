// Offline-Betrieb. Strategie: zuerst Netzwerk (immer die neueste Version). Antwortet das Netz nicht binnen 3 s
// (schlechter Empfang im Studio), kommt sofort die gespeicherte Version; das Netz aktualisiert im Hintergrund weiter.
// Bei jeder Veröffentlichung CACHE erhöhen, damit installierte Apps die alten Dateien verwerfen.
const CACHE = "satz-v0.10.4";
const FILES = ["./", "index.html", "css/app.css", "js/app.js", "js/i18n.js", "js/lang/en.js", "js/store.js", "js/data.js", "js/nutrition.js", "js/anim.js", "js/body3d.js", "js/bell.js", "js/onboarding.js", "js/vendor/three.module.min.js", "manifest.webmanifest",
  "fonts/archivo-satz.woff2", "icons/icon-192.png", "icons/icon-180.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/icon.svg", "js/vendor/zxing.min.js"];
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
    const net = fetch(e.request, {cache: "no-cache"}).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; });
    const cached = () => c.match(e.request, {ignoreSearch: true}).then(r => r || (e.request.mode === "navigate" ? c.match("index.html") : null));
    const timeout = new Promise(res => setTimeout(res, 3000, "timeout"));
    try {
      const first = await Promise.race([net, timeout]);
      if (first !== "timeout") return first;
      e.waitUntil(net.catch(() => {}));
      return (await cached()) || await net;
    } catch (err) {
      return (await cached()) || Response.error();
    }
  })());
});
