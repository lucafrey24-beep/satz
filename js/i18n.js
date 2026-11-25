// Sprachen. Deutsch ist die Ausgangssprache: Der deutsche Text im Code ist zugleich der Schlüssel.
// Fehlt eine Übersetzung, erscheint der deutsche Text (nie ein leeres Feld).
//
// Neue Sprache hinzufügen:
//   1. js/lang/en.js nach js/lang/<code>.js kopieren (z. B. fr.js) und die Werte rechts übersetzen. Schlüssel links nie ändern.
//   2. Unten importieren und in LANGS eintragen (Name in der eigenen Sprache).
//   3. In sw.js die Datei in FILES aufnehmen und in store.js nichts ändern: Die Liste der Sprachen kommt von hier.
//   4. `node tools/i18n-check.js` zeigt fehlende und überflüssige Einträge je Sprache.
//
// Platzhalter: {name} im Text wird durch t("…", {name: "…"}) ersetzt. Die Platzhalter müssen in der Übersetzung gleich heißen.
// Gespeicherte Daten (Plan-, Tages- und eigene Übungsnamen, Trainings) werden nie übersetzt.
import en from "./lang/en.js";

export const LANGS = [
  {id: "de", name: "Deutsch", locale: "de-DE", dict: null},
  {id: "en", name: "English", locale: "en-GB", dict: en},
];
export const LANG_IDS = LANGS.map(l => l.id);

let cur = LANGS[0];
export const lang = () => cur.id;
// Datums- und Zahlenformat. Englisch: amerikanisches Format nur, wenn das Gerät auf US-Englisch steht.
export const locale = () => {
  if (cur.id !== "en") return cur.locale;
  const n = (navigator.languages || [navigator.language || ""]).find(x => /^en/i.test(x));
  return n && /^en-US$/i.test(n) ? "en-US" : cur.locale;
};
export function setLang(id) {
  cur = LANGS.find(l => l.id === id) || LANGS[0];
  document.documentElement.lang = cur.id;
}
// Vorschlag nach Gerätesprache, sonst Deutsch
export function guess() {
  const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "de"];
  for (const x of list) { const id = String(x).slice(0, 2).toLowerCase(); if (LANG_IDS.includes(id)) return id; }
  return "de";
}
const fill = (s, v) => v ? s.replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m) : s;
export const t = (s, v) => fill((cur.dict && cur.dict[s]) || s, v);
// Text in einer bestimmten Sprache (für die Sprachauswahl, die sich beim Antippen selbst umstellt)
export const tIn = (id, s, v) => { const l = LANGS.find(x => x.id === id); return fill((l && l.dict && l.dict[s]) || s, v); };
// Einzahl/Mehrzahl: tn(3, "{n} Satz", "{n} Sätze"). Beide Formen stehen als eigene Schlüssel in der Sprachdatei.
export const tn = (n, one, other, v) => t(n === 1 ? one : other, {n, ...v});

// Feste Texte in index.html: data-t (Textinhalt), data-t-aria (aria-label). Der deutsche Text bleibt als Schlüssel gemerkt,
// damit ein Sprachwechsel ohne Neuladen funktioniert.
export function applyStatic(root = document) {
  root.querySelectorAll("[data-t]").forEach(el => { if (!el.dataset.tKey) el.dataset.tKey = el.textContent.trim(); el.textContent = t(el.dataset.tKey); });
  root.querySelectorAll("[data-t-aria]").forEach(el => { if (!el.dataset.tAriaKey) el.dataset.tAriaKey = el.getAttribute("aria-label"); el.setAttribute("aria-label", t(el.dataset.tAriaKey)); });
}
