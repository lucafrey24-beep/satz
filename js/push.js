// Push-Erinnerung ohne eigenen Server: Die App erzeugt ein eigenes VAPID-Schlüsselpaar, abonniert Push beim Push-Dienst
// des Geräts (bei iPhones Apple) und gibt beides als „Code“ aus. Der Code kommt als Secret SATZ_PUSH ins GitHub-Repo,
// .github/workflows/push-erinnerung.yml verschickt damit die Erinnerungen. Schlüssel und Abo liegen in einem eigenen
// localStorage-Eintrag, nie in den Trainingsdaten und nie in einer Sicherung.
const KEY = "satz-push";
export const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const standalone = () => navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const permission = () => ("Notification" in window ? Notification.permission : "default");
export function load() { try { const r = JSON.parse(localStorage.getItem(KEY)); return r && r.vapid ? r : null; } catch (e) { return null; } }
function store(v) { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch (e) {} }
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));

export async function enable() {
  // Zuerst die Erlaubnis: iOS fragt nur, solange der Aufruf direkt aus dem Tippen kommt
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error(perm);
  let rec = load();
  if (!rec) {
    const kp = await crypto.subtle.generateKey({name: "ECDSA", namedCurve: "P-256"}, true, ["sign"]);
    const j = await crypto.subtle.exportKey("jwk", kp.privateKey);
    rec = {vapid: {x: j.x, y: j.y, d: j.d}};
  }
  const key = new Uint8Array([4, ...unb64u(rec.vapid.x), ...unb64u(rec.vapid.y)]);
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  let same = false; try { same = !!(sub && sub.options.applicationServerKey && b64u(sub.options.applicationServerKey) === b64u(key)); } catch (e) {}
  if (sub && !same) { await sub.unsubscribe(); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: key});
  const j = sub.toJSON();
  rec = {...rec, sub: {endpoint: j.endpoint, keys: {p256dh: j.keys.p256dh, auth: j.keys.auth}}, since: rec.sub && rec.sub.endpoint === j.endpoint ? rec.since : Date.now(), lost: false};
  store(rec); return rec;
}
export async function disable() {
  try { const reg = await navigator.serviceWorker.ready; const s = await reg.pushManager.getSubscription(); if (s) await s.unsubscribe(); } catch (e) {}
  store(null);
}
// iOS kann ein Abo still verwerfen (z. B. nach Entfernen der Mitteilungs-Erlaubnis). true, wenn sich der Zustand geändert hat.
export async function verify() {
  const rec = load(); if (!rec || !rec.sub || !supported()) return false;
  let sub = null; try { const reg = await navigator.serviceWorker.ready; sub = await reg.pushManager.getSubscription(); } catch (e) { return false; }
  const lost = !sub || sub.endpoint !== rec.sub.endpoint || permission() !== "granted";
  if (lost === !!rec.lost) return false;
  store({...rec, lost}); return true;
}
// Nur die Abweichungen ab heute bzw. ab dieser Woche, damit der Code klein bleibt
export function schedule({days, dayPlan, pauses, time, before, today, week}) {
  const dp = {}; Object.keys(dayPlan || {}).sort().forEach(k => { if (k >= today) dp[k] = dayPlan[k]; });
  return {time, before: +before || 0, days: [...days].sort(), dayPlan: dp, pauses: (pauses || []).filter(w => w >= week).sort()};
}
export function code(sch) {
  const r = load(); if (!r || !r.sub) return "";
  return JSON.stringify({v: 1, sub: r.sub, vapid: r.vapid, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin", ...sch});
}
export function markCopied(sch) { const r = load(); if (r) store({...r, copied: sch}); }
// Hat sich seit dem letzten Kopieren etwas am Plan geändert? Vergangene Tage zählen nicht.
export function changedSince(sch, today, week) {
  const r = load(); if (!r || !r.copied) return true;
  const old = schedule({...r.copied, today, week});
  return JSON.stringify(old) !== JSON.stringify(sch);
}
