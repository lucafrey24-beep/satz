// SATZ Trainings-Erinnerung: läuft in GitHub Actions, ohne eigenen Server und ohne fremde Pakete.
// Liest den Code aus der App (Repo-Secret SATZ_PUSH), prüft, ob heute ein Trainingstag ist und die Erinnerungszeit
// erreicht ist, und schickt dann eine verschlüsselte Web-Push-Nachricht (RFC 8291 aes128gcm, VAPID RFC 8292).
//   node push/send.mjs check   -> schreibt due=true|false und day=YYYY-MM-DD nach $GITHUB_OUTPUT
//   node push/send.mjs send    -> schickt die Nachricht (TEST=true: sofort eine Test-Nachricht)
import crypto from "node:crypto";
import fs from "node:fs";

const GRACE = 90; // Minuten nach der Erinnerungszeit, in denen noch gesendet wird (GitHub startet geplante Läufe oft verspätet)
const b64u = b => Buffer.from(b).toString("base64url");
const unb64u = s => Buffer.from(String(s), "base64url");
const out = (k, v) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); console.log(`${k}=${v}`); };

export function readCode(raw) {
  let c; try { c = JSON.parse(raw); } catch (e) { throw new Error("SATZ_PUSH ist kein gültiger Code. In SATZ unter Mehr → Push-Erinnerung den Code neu kopieren."); }
  const ok = c && c.v === 1 && c.sub && /^https:\/\//.test(c.sub.endpoint || "") && c.sub.keys && c.sub.keys.p256dh && c.sub.keys.auth
    && c.vapid && c.vapid.x && c.vapid.y && c.vapid.d && /^\d{2}:\d{2}$/.test(c.time || "") && Array.isArray(c.days);
  if (!ok) throw new Error("SATZ_PUSH ist unvollständig. In SATZ unter Mehr → Push-Erinnerung den Code neu kopieren.");
  return c;
}

// Datum und Uhrzeit in der Zeitzone des Handys
export function localNow(tz, now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {timeZone: tz || "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short"}).formatToParts(now).map(x => [x.type, x.value]));
  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday); // 0 = Montag wie in SATZ
  return {day: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute, wd};
}
const monday = (day, wd) => { const d = new Date(day + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - wd); return d.toISOString().slice(0, 10); };

// Gleiche Regel wie St.planFor in der App: Pausenwoche vor Einzeltag vor Wochenmuster
export function planFor(c, day, wd) {
  if ((c.pauses || []).includes(monday(day, wd))) return "pause";
  return (c.dayPlan || {})[day] || (c.days.includes(wd) ? "train" : "rest");
}

export function decide(c, now = new Date()) {
  const t = localNow(c.tz, now), [h, m] = c.time.split(":").map(Number);
  const at = Math.max(0, h * 60 + m - (+c.before || 0));
  const state = planFor(c, t.day, t.wd);
  const due = state === "train" && t.min >= at && t.min < at + GRACE;
  return {due, day: t.day, state, at, min: t.min};
}

export function message(c, test) {
  if (test) return {title: "SATZ", body: "Test: Push-Erinnerungen funktionieren.", url: "./#/heute", tag: "satz-test"};
  const b = +c.before || 0;
  return {title: "Trainingstag", body: b ? `Dein Training startet um ${c.time}. Noch ${b < 60 ? b + " Minuten" : "eine Stunde"}.` : `Jetzt ist Trainingszeit (${c.time}).`,
    url: "./#/heute", tag: "satz-training"};
}

// RFC 8291: Nachricht für genau dieses Abo verschlüsseln
export function encrypt(sub, payload, salt = crypto.randomBytes(16), eph = null) {
  if (!eph) { eph = crypto.createECDH("prime256v1"); eph.generateKeys(); }
  const uaPub = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth), asPub = eph.getPublicKey();
  const shared = eph.computeSecret(uaPub);
  const hmac = (k, d) => crypto.createHmac("sha256", k).update(d).digest();
  const ikm = hmac(hmac(auth, shared), Buffer.concat([Buffer.from("WebPush: info\0"), uaPub, asPub, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12);
  const ci = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([ci.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), ci.final(), ci.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, body]);
}

// RFC 8292: VAPID-Token, signiert mit dem Schlüssel, den die App erzeugt hat
export function vapidHeader(endpoint, vapid, now = Date.now()) {
  const key = crypto.createPrivateKey({key: {kty: "EC", crv: "P-256", x: vapid.x, y: vapid.y, d: vapid.d}, format: "jwk"});
  const head = b64u(JSON.stringify({typ: "JWT", alg: "ES256"}));
  const claims = b64u(JSON.stringify({aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: "https://lucafrey24-beep.github.io/satz/"}));
  const sig = crypto.sign("sha256", Buffer.from(`${head}.${claims}`), {key, dsaEncoding: "ieee-p1363"});
  const pub = Buffer.concat([Buffer.from([4]), unb64u(vapid.x), unb64u(vapid.y)]);
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${b64u(pub)}`;
}

export async function send(c, msg, fetchImpl = fetch) {
  const res = await fetchImpl(c.sub.endpoint, {method: "POST", headers: {
    "Content-Type": "application/octet-stream", "Content-Encoding": "aes128gcm", TTL: "5400", Urgency: "high", Topic: msg.tag.replace(/[^A-Za-z0-9_-]/g, ""),
    Authorization: vapidHeader(c.sub.endpoint, c.vapid)}, body: encrypt(c.sub, JSON.stringify(msg))});
  if (res.status === 404 || res.status === 410) throw new Error(`Das Abo ist abgelaufen (${res.status}). In SATZ unter Mehr → Push-Erinnerung neu aktivieren und den Code im Secret ersetzen.`);
  if (!res.ok) throw new Error(`Der Push-Dienst hat abgelehnt: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.status;
}

async function main() {
  const mode = process.argv[2], test = process.env.TEST === "true";
  if (!process.env.SATZ_PUSH) { console.log("Kein Secret SATZ_PUSH angelegt, nichts zu tun."); out("due", "false"); return; }
  const c = readCode(process.env.SATZ_PUSH);
  if (mode === "check") {
    const d = decide(c);
    console.log(`Heute ${d.day}: ${d.state}, Erinnerung ab ${String(d.at / 60 | 0).padStart(2, "0")}:${String(d.at % 60).padStart(2, "0")}, jetzt ${String(d.min / 60 | 0).padStart(2, "0")}:${String(d.min % 60).padStart(2, "0")}`);
    out("due", String(test || d.due)); out("day", d.day);
  } else if (mode === "send") {
    const st = await send(c, message(c, test));
    console.log(`Gesendet (${st}).`);
  } else throw new Error("Aufruf: node push/send.mjs check|send");
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(`::error::${e.message}`); process.exit(1); });
