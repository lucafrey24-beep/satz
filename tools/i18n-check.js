// Prüft die Sprachdateien: node tools/i18n-check.js
// Sucht alle übersetzbaren Texte im Code (tx("…"), txn(n, "…", "…"), tIn("…"), data-t in index.html)
// und meldet je Sprache, was fehlt, und welche Einträge nirgends mehr vorkommen.
// Texte, die erst zur Laufzeit feststehen (z. B. tx(a.l) mit Namen aus data.js), stehen in DYNAMIC und zählen als benutzt.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const unq = s => JSON.parse(`"${s}"`);
const keys = new Set();
const Q = String.raw`"((?:[^"\\]|\\.)*)"`;
for (const f of fs.readdirSync(path.join(root, "js")).filter(f => f.endsWith(".js"))) {
  const src = read("js/" + f);
  for (const m of src.matchAll(new RegExp(String.raw`\b(?:tx|tIn|I\.t)\(\s*` + Q, "g"))) keys.add(unq(m[1]));
  for (const m of src.matchAll(new RegExp(String.raw`\b(?:txn|I\.tn)\([^,]+,\s*` + Q + String.raw`\s*,\s*` + Q, "g"))) { keys.add(unq(m[1])); keys.add(unq(m[2])); }
}
for (const m of read("index.html").matchAll(/<[^>]*\bdata-t(?=[\s>])[^>]*>([^<]+)</g)) keys.add(m[1].trim());
for (const m of read("index.html").matchAll(/aria-label="([^"]+)"[^>]*data-t-aria/g)) keys.add(m[1]);
// Laufzeit-Schlüssel: Namen aus Listen (Akzentfarben, Aktivität, Ziele, Zurück-Ziele, Gründe beim Laden)
const DYNAMIC = ["Grün", "Petrol", "Kobalt", "Violett", "Beere", "Signal", "Kupfer", "Ocker", "Graphit", "Pläne",
  "Bitte wählen", "Männlich", "Weiblich", "Keine Angabe (Mittelwert)", "unlesbar", "neuere Version", "unbekanntes Format", "früherer Start",
  "Arbeitssatz", "Zur Startzeit", "15 Min. vorher", "30 Min. vorher", "1 Std. vorher", "kein Training", "regelmäßig", "Alle", "Zu Hause", "erledigt", "geplant", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const nut = read("js/nutrition.js");
for (const m of nut.matchAll(/\b[ld]: "([^"]+)"/g)) DYNAMIC.push(m[1]);
// Listen in data.js, die über tx() angezeigt werden: Muskeln, Trainingsziele, Niveau der Vorlagen, Körpermaße
const data = read("js/data.js");
const block = (src, start) => { const i = src.indexOf(start); return i < 0 ? "" : src.slice(i, src.indexOf("];", i)); };
for (const m of block(data, "export const MUSCLES").matchAll(/name: "([^"]+)"/g)) DYNAMIC.push(m[1]);
for (const m of block(data, "export const GOALS").matchAll(/\b[ld]: "([^"]+)"/g)) DYNAMIC.push(m[1]);
for (const m of data.matchAll(/level: "([^"]+)"/g)) DYNAMIC.push(m[1]);
for (const m of block(data, "export const KIT_FILTERS").matchAll(/\bl: "([^"]+)"/g)) DYNAMIC.push(m[1]);
for (const m of block(data, "export const MEASURES").matchAll(/\b(?:l|how): "([^"]+)"/g)) DYNAMIC.push(m[1]);
for (const m of (data.match(/export const KIT_LABEL = \{[^}]*\}/) || [""])[0].matchAll(/: "([^"]+)"/g)) DYNAMIC.push(m[1]);
// Einstieg: alle Texte in onboarding.js (Fragen, Antworten, Begründungen). Kennungen sind kleingeschrieben ohne Leerzeichen.
for (const m of read("js/onboarding.js").matchAll(/"((?:[^"\\]|\\.)*)"/g)) if (/[A-ZÄÖÜ ]/.test(m[1]) && !/^\.\//.test(m[1])) DYNAMIC.push(unq(m[1]));
// Objekte in app.js, deren Werte über tx() angezeigt werden (mit Kommentar „über tx() angezeigt“ markiert)
for (const line of read("js/app.js").split("\n").filter(l => l.includes("über tx() angezeigt")))
  for (const m of line.replace(/\/\/.*$/, "").matchAll(/: "([^"]+)"/g)) DYNAMIC.push(m[1]);
DYNAMIC.forEach(k => keys.add(k));

let bad = 0;
for (const f of fs.readdirSync(path.join(root, "js/lang")).filter(f => f.endsWith(".js"))) {
  const src = read("js/lang/" + f).replace(/^\s*export default\s*/m, "module.exports = ");
  const m = {exports: {}}; new Function("module", src)(m); const dict = m.exports;
  const missing = [...keys].filter(k => !(k in dict)), unused = Object.keys(dict).filter(k => !keys.has(k));
  const ph = Object.entries(dict).filter(([k, v]) => (k.match(/\{\w+\}/g) || []).sort().join() !== (v.match(/\{\w+\}/g) || []).sort().join()).map(([k]) => k);
  console.log(`${f}: ${Object.keys(dict).length} Einträge, ${missing.length} fehlen, ${unused.length} unbenutzt, ${ph.length} mit falschen Platzhaltern`);
  missing.forEach(k => console.log("  fehlt:      " + JSON.stringify(k)));
  unused.forEach(k => console.log("  unbenutzt:  " + JSON.stringify(k)));
  ph.forEach(k => console.log("  Platzhalter: " + JSON.stringify(k)));
  bad += missing.length + ph.length;
}
console.log(`${keys.size} übersetzbare Texte im Code.`);
process.exitCode = bad ? 1 : 0;
