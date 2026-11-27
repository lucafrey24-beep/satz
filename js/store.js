// Zustand, Speicherung, Progression und Volumen.
import {EXERCISES, TEMPLATES, MUSCLES, MEASURES, isCompound, defaultRest, isMobility, noLoad} from "./data.js";
import {LANG_IDS, locale, t as tx, tn as txn} from "./i18n.js";
const MEASURE_IDS = new Set(MEASURES.map(m => m.id));

const KEY = "satz-data";
export const VERSION = 1;
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

export let S = null;

function fresh() {
  const exercises = {};
  EXERCISES.forEach(e => exercises[e.id] = {...e});
  return {
    version: VERSION, exercises, plans: [], activePlanId: null, sessions: [], active: null,
    settings: {scale: 1, theme: "auto", contrast: false, rir: true, rest: 0, lang: ""},   // lang "" = beim ersten Start noch nicht gewählt
  };
}

// Beim Laden nie stillschweigend überschreiben: Unlesbare oder fremde Daten werden vorher beiseitegelegt.
export let recovered = null;   // {key, reason} wenn Altdaten gesichert wurden
// Lucas Regel: Gespeicherte Trainings überstehen jedes App-Update unverändert.
// 1. Vor dem ersten Start einer neuen App-Version wird der komplette alte Stand als Kopie abgelegt (die letzten 3 bleiben).
// 2. migrate() darf Trainings nie verändern. Passiert es doch, werden die Trainings aus dem geladenen Stand zurückgeschrieben.
const UPD = KEY + "-vor-update-";
export const updateBackups = () => Object.keys(localStorage).filter(k => k.startsWith(UPD)).sort().reverse();
function backupBeforeUpdate(raw, from, to) {
  const key = `${UPD}${new Date().toISOString().slice(0, 19)}`;
  try { localStorage.setItem(key, JSON.stringify({from: from || "vor 0.8.2", to, raw})); } catch (e) { return; }
  updateBackups().slice(3).forEach(k => localStorage.removeItem(k));
}
export function restoreUpdateBackup(key) {
  const b = JSON.parse(localStorage.getItem(key)); const d = JSON.parse(b.raw);
  if (!valid(d)) throw new Error(tx("Sicherung unlesbar"));
  S = keepLang(d); migrate(); save();
}
// Ältere Sicherungen kennen keine Sprache: Dann bleibt die aktuell eingestellte, statt auf Deutsch zurückzufallen.
function keepLang(d) {
  const cur = S && S.settings && S.settings.lang;
  if (d && d.settings && !d.settings.lang && cur) d.settings.lang = cur;
  return d;
}
export function load(appVersion) {
  const raw = localStorage.getItem(KEY);
  let d = null, reason = "";
  if (raw) { try { d = JSON.parse(raw); } catch (e) { reason = "unlesbar"; } }
  if (raw && !reason && !valid(d)) reason = d && d.version > VERSION ? "neuere Version" : "unbekanntes Format";
  if (reason) {
    const key = `${KEY}-gesichert-${new Date().toISOString().slice(0, 19)}`;
    try { localStorage.setItem(key, raw); recovered = {key, reason}; } catch (e) { recovered = {key: null, reason, raw}; }
  }
  S = reason || !d ? fresh() : d;
  const before = d && !reason ? JSON.stringify(d.sessions) : null;
  if (before && appVersion && d.appVersion !== appVersion) backupBeforeUpdate(raw, d.appVersion, appVersion);
  migrate();
  if (before && JSON.stringify(S.sessions) !== before) S.sessions = JSON.parse(before);
  if (appVersion && S.appVersion !== appVersion) { S.appVersion = appVersion; if (before) save(); }
}
export const corruptKeys = () => Object.keys(localStorage).filter(k => k.startsWith(KEY + "-gesichert-"));
// Ergänzt fehlende Felder (auch nach dem Laden einer älteren Sicherung)
function migrate() {
  // neue Bibliotheksübungen nachrüsten, ohne eigene Umbenennungen zu überschreiben
  // Bei Bibliotheksübungen sind die Muskeln fest hinterlegt: Korrekturen (z. B. Kreuzheben ab 0.7) übernehmen
  EXERCISES.forEach(e => { const x = S.exercises[e.id]; if (!x) S.exercises[e.id] = {...e}; else if (!x.custom) { x.primary = [...e.primary]; x.secondary = [...e.secondary]; } });
  // Ergänzungen ab Version 0.3 (Ernährung, Profil), rückwärtskompatibel
  S.profile = Object.assign({birth: "", sex: "", height: 0, pal: 1.55, goal: "maintain", manual: false, kcal: 0, p: 0, c: 0, f: 0}, S.profile || {});
  S.weights = S.weights || [];
  S.foods = S.foods || {};
  S.food = S.food || [];
  // Ab 0.9: Körpermaße und Entlastungsrhythmus. Bestehende Pläne starten ihren Zyklus am Tag des Updates,
  // damit kein laufender Plan plötzlich mitten in einer Entlastungswoche steht.
  S.measures = S.measures || [];
  // Ab 0.9.8: Pausenwochen fürs Wochenziel (Wochenanfang Montag, YYYY-MM-DD)
  S.pauses = S.pauses || [];
  // Ab 0.9.9: Tagesplan, nur Abweichungen vom Wochenmuster ({"YYYY-MM-DD": "train"|"rest"|"pause"})
  S.dayPlan = S.dayPlan && typeof S.dayPlan === "object" && !Array.isArray(S.dayPlan) ? S.dayPlan : {};
  S.plans.forEach(p => { if (!p.cycle) p.cycle = {weeks: DEFAULT_CYCLE, start: today()}; });
  // Ab 0.3.1 ist Grün der Standard (Lucas Wahl). Einmalig umstellen, danach gilt die eigene Auswahl.
  if (S.settings.sound == null) S.settings.sound = true;
  if (!S.settings.accentSet) { S.settings.accent = "gruen"; S.settings.accentSet = true; }
  // Oliv (bis 0.9.2) und Gras (0.9.3) gibt es nicht mehr. Wer eine davon gewählt hatte, bekommt Grün.
  if (S.settings.accent === "oliv" || S.settings.accent === "gras") S.settings.accent = "gruen";
  // Ab 0.10: Sprache. Wer SATZ schon vorher genutzt hat, bekommt keine Sprachauswahl und behält Deutsch.
  // Nur ein ganz neuer Start (fresh, lang "") zeigt die Auswahl.
  if (S.settings.lang === undefined) S.settings.lang = "de";
}
export const currentWeight = () => S.weights.length ? S.weights[S.weights.length - 1].kg : 0;

export function valid(d) {
  return d && d.version === VERSION && d.exercises && Array.isArray(d.plans) && Array.isArray(d.sessions) && d.settings;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch (e) { return false; }
}

export function replaceAll(data) { S = keepLang(data); migrate(); save(); }
export function snapshot() { return JSON.stringify(S); }
export function restore(snap) { S = JSON.parse(snap); migrate(); save(); }

/* ---------- Pläne ---------- */
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
// Entlastungsrhythmus: (weeks − 1) Aufbauwochen, dann 1 Entlastungswoche. 0 = aus.
// Bell et al. (2023, Delphi-Konsens): Deloads meist alle 4–8 Wochen, vor allem weniger Volumen, Last etwas niedriger.
export const DEFAULT_CYCLE = 6, CYCLES = [0, 4, 5, 6, 8];
export function cycleWeek(p, on = today()) {
  const c = p && p.cycle; if (!c || !c.weeks) return null;
  const d = Math.floor((new Date(on + "T12:00:00") - new Date(c.start + "T12:00:00")) / 864e5);
  const n = Math.max(0, Math.floor(d / 7)) % c.weeks;
  return {week: n + 1, weeks: c.weeks, deload: n === c.weeks - 1, inDays: (7 - (((d % 7) + 7) % 7))};
}
export const deloadNow = p => !!(cycleWeek(p) || {}).deload;
export const deloadSets = n => Math.max(1, Math.ceil(n / 2));
export function instantiate(t) {
  return {
    id: uid(), name: t.name, perWeek: t.perWeek, template: t.id, goal: t.goal || "kraft", cycle: {weeks: DEFAULT_CYCLE, start: today()},
    days: t.days.map(d => ({
      id: uid(), name: d.name,
      slots: d.slots.map(([exId, sets, min, max, rest]) => ({id: uid(), exId, sets, min, max, rest: rest || 0})),
    })),
  };
}
export const plan = id => S.plans.find(p => p.id === id);
export const activePlan = () => plan(S.activePlanId) || null;
export const ex = id => S.exercises[id] || {id, name: tx("Unbekannte Übung"), primary: [], secondary: [], step: 2.5, unit: "kg"};

export function restFor(slot) {
  if (slot.rest) return slot.rest;
  if (S.settings.rest) return S.settings.rest;
  return defaultRest(ex(slot.exId), slot.max);
}

export function nextDayIndex(p) {
  if (!p || !p.days.length) return 0;
  const last = [...S.sessions].reverse().find(s => s.planId === p.id);
  if (!last) return 0;
  const i = p.days.findIndex(d => d.id === last.dayId);
  return i < 0 ? 0 : (i + 1) % p.days.length;
}

/* ---------- Volumen ---------- */
const zero = () => Object.fromEntries(MUSCLES.map(m => [m.id, 0]));
function addSets(v, exId, n) {
  const e = ex(exId);
  if (isMobility(e)) return;   // Dehnen und Mobility zählen nicht als Trainingsvolumen
  e.primary.forEach(m => v[m] = (v[m] || 0) + n);
  e.secondary.forEach(m => v[m] = (v[m] || 0) + n * 0.5);
}
export function planVolume(p) {
  const v = zero();
  if (!p.days.length) return v;
  const f = p.perWeek / p.days.length;
  p.days.forEach(d => d.slots.forEach(sl => addSets(v, sl.exId, sl.sets * f)));
  return v;
}
export function recentVolume(days = 7) {
  const v = zero(), since = Date.now() - days * 864e5;
  S.sessions.filter(s => new Date(s.date).getTime() >= since).forEach(s => s.sets.filter(isHard).forEach(x => addSets(v, x.exId, 1)));
  return v;
}
export function volStatus(m, x) {
  if (!m.major) return "";
  if (x < 10) return "low";
  if (x <= 20) return "ok";
  return "high";
}

/* ---------- Satztypen ----------
   work = Arbeitssatz, warm = Aufwärmsatz, drop = Drop-Satz.
   „Harter Satz“ (Schoenfeld et al. 2017; Refalo et al. 2023): Arbeits- oder Drop-Satz mit höchstens 3 Wdh. in Reserve.
   Ohne RIR-Angabe zählt ein Arbeitssatz als hart. RIR „4+“ (gespeichert als 4) zählt nicht. */
export const isWork = x => !x.type || x.type === "work";
export const isHard = x => x.type !== "warm" && (x.rir == null || x.rir < 4);
export const e1rm = (kg, reps) => reps > 0 ? kg * (1 + reps / 30) : 0;   // Epley (1985)

/* ---------- Verlauf & Progression ---------- */
export const daysSince = iso => Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
export const lastSession = () => S.sessions[S.sessions.length - 1] || null;

// Entlastungstrainings zählen nicht als Grundlage für die nächste Steigerung: danach geht es vom Stand davor weiter.
export function lastSetsFor(exId, withDeload = false) {
  for (let i = S.sessions.length - 1; i >= 0; i--) {
    if (S.sessions[i].deload && !withDeload) continue;
    const sets = S.sessions[i].sets.filter(x => x.exId === exId && isWork(x));
    if (sets.length) return {session: S.sessions[i], sets};
  }
  return null;
}
// Anzahl der letzten Trainings ohne neuen Bestwert beim geschätzten 1RM (ab 3 zählt es als Plateau)
// Die letzten n Trainings mit dieser Übung (neueste zuerst), nur Arbeitssätze. Nur lesen.
export function recentFor(exId, n = 3) {
  const out = [];
  for (let i = S.sessions.length - 1; i >= 0 && out.length < n; i--) {
    const sets = S.sessions[i].sets.filter(x => x.exId === exId && isWork(x));
    if (sets.length) out.push({date: S.sessions[i].date, deload: !!S.sessions[i].deload, sets});
  }
  return out;
}
export function plateau(exId) {
  // Nach einer geplanten Entlastungswoche neu zählen
  const lastDl = S.sessions.map(s => !!s.deload).lastIndexOf(true);
  let hist = S.sessions.slice(lastDl + 1).map(s => s.sets.filter(x => x.exId === exId && isWork(x))).filter(x => x.length);
  const top = sets => Math.max(...sets.map(x => x.kg));
  // Nach einer Entlastung (Training mit unter 95 % des vorherigen Gewichts) neu zählen
  for (let k = hist.length - 1; k > 0; k--) if (top(hist[k]) < top(hist[k - 1]) * 0.95) { hist = hist.slice(k + 1); break; }
  if (hist.length < 4) return 0;
  // Fortschritt = höheres Spitzengewicht oder mehr Wdh. mit dem gleichen Spitzengewicht. Kein geschätztes 1RM mehr:
  // Epley wird über etwa 10 Wdh. ungenau und reagiert dann auf Rauschen.
  const perf = sets => { const kg = top(sets); return {kg, reps: sets.filter(x => x.kg === kg).reduce((a, x) => a + x.reps, 0)}; };
  const better = (a, b) => a.kg > b.kg || (a.kg === b.kg && a.reps > b.reps);
  const ps = hist.map(perf), peak = ps.slice(0, -3).reduce((m, x) => better(x, m) ? x : m);
  return ps.slice(-3).every(x => !better(x, peak)) ? 3 : 0;
}
export function setCount(exId) {
  return S.sessions.reduce((a, s) => a + s.sets.filter(x => x.exId === exId).length, 0);
}
// Vorbelegung für den ersten Testsatz einer neuen Übung. Bewusst leicht und ohne Raten am Namen:
// Das echte Arbeitsgewicht ermittelt die geführte Gewichtsfindung (findNext).
export function startWeight(e) {
  if (e.unit === "bw" || noLoad(e)) return 0;
  return isCompound(e) ? 20 : 5;
}
// Geführte Gewichtsfindung: aus dem letzten Testsatz (Gewicht, Wdh., Wdh. in Reserve) das Gewicht schätzen,
// mit dem das obere Ende der Spanne mit etwa 3 Wdh. in Reserve klappt. Schätzung nach Epley mit Wdh. bis zum Versagen = Wdh. + RIR.
// RIR-Schätzungen sind nahe am Versagen genauer als weit davon (Halperin et al. 2022), darum zählt „4+“ als 6 und Testsätze
// sollen nicht zu leicht sein. Ohne RIR-Angabe rechnet SATZ vorsichtig mit 1.
export const FIND_RIR = 3, FIND_MAX_TESTS = 4;
export function findNext(e, slot, tests) {
  const t = tests[tests.length - 1];
  if (!t) return {kg: startWeight(e), reps: slot.max, found: false};
  const rir = t.rir == null ? 1 : t.rir >= 4 ? 6 : t.rir;
  const rtf = Math.min(20, t.reps + rir), best = t.kg * (1 + rtf / 30);
  let kg = roundTo(best / (1 + (slot.max + FIND_RIR) / 30), e.step);
  if (t.rir >= 4) kg = Math.max(kg, t.kg + e.step);
  const ok = t.rir != null && t.rir >= 1 && t.rir <= 3 && t.reps >= slot.min && Math.abs(kg - t.kg) <= e.step;
  const found = ok || tests.length >= FIND_MAX_TESTS;
  return {kg: Math.max(0, ok ? t.kg : kg), reps: found ? slot.min : slot.max, found};
}
// Aufwärmrampe vor schweren Grundübungen: etwa 50/70/85 % des Arbeitsgewichts mit 8/5/3 Wdh.
// Doppelte Gewichte fallen weg, leichter als 40 % des Ziels oder unter dem Steigerungsschritt auch.
export function warmupRamp(e, kg) {
  if (e.unit !== "kg" || !isCompound(e) || kg < 30) return [];
  const out = [];
  [[0.5, 8], [0.7, 5], [0.85, 3]].forEach(([f, reps]) => {
    const w = roundTo(kg * f, e.step);
    if (w >= e.step && w < kg && !out.some(x => x.kg === w)) out.push({kg: w, reps});
  });
  return out;
}

const roundTo = (x, step) => step ? Math.max(0, Math.round(x / step) * step) : x;
export const fmt = n => (Math.round(n * 100) / 100).toLocaleString(locale());
export function fmtW(e, kg) {
  if (e.unit === "bw") return kg ? tx("Körpergewicht + {n} kg", {n: fmt(kg)}) : tx("Körpergewicht");
  if (e.unit === "band") return tx("Band");
  if (e.unit === "s") return tx("Halten");
  return `${fmt(kg)} kg`;
}
// Einheit der „Wiederholungen“: bei Halteübungen Sekunden
export const repWord = e => e.unit === "s" ? tx("Sekunden") : tx("Wiederholungen");
export const repShort = e => e.unit === "s" ? tx("Sek.") : tx("Wdh.");

// Band und Halten: kein Gewicht. Band: erst alle Sätze bis zum oberen Ende, dann stärkeres Band.
// Halten: bis zum oberen Ende steigern, dort bleiben. Mobility hat kein Leistungsziel.
function suggestNoLoad(slot, e, last) {
  const u = e.unit === "s" ? "s" : tx("Wdh."), range = `${slot.sets} × ${slot.min}–${slot.max} ${u}`;
  if (!last) return {kind: "new", kg: 0, reps: e.unit === "s" ? slot.min : slot.max,
    text: isMobility(e) ? tx("Locker in die Dehnung gehen, ruhig atmen, nicht wippen. Ziel: {range}.", {range})
      : e.unit === "s" ? tx("Erstes Mal. Halte sauber {n} s, Ziel: {range}.", {n: slot.min, range}) : tx("Erstes Mal. Wähle ein Band, mit dem du {n} saubere Wdh. schaffst.", {n: slot.max})};
  const prev = tx("Letztes Mal: {list} {u}.", {list: last.sets.map(x => x.reps).join(" + "), u});
  if (isMobility(e)) return {kind: "hold", kg: 0, reps: slot.max, text: `${prev} ${tx("Heute wieder {range}. Dehnen ohne Schmerz, mit dem Atem tiefer.", {range})}`};
  const all = last.sets.length >= slot.sets && last.sets.every(x => x.reps >= slot.max);
  if (e.unit === "band") return all
    ? {kind: "up", kg: 0, reps: slot.min, text: `${prev} ${tx("Ziel erreicht. Nimm heute ein stärkeres Band, Ziel ab {n} Wdh.", {n: slot.min})}`}
    : {kind: "hold", kg: 0, reps: Math.min(slot.max, Math.max(...last.sets.map(x => x.reps)) + 1), text: `${prev} ${tx("Gleiches Band, eine Wiederholung mehr. Ziel: {s} × {n}.", {s: slot.sets, n: slot.max})}`};
  return all
    ? {kind: "hold", kg: 0, reps: slot.max, text: `${prev} ${tx("Ziel erreicht. Halte die {n} s sauber oder wähle eine schwerere Variante.", {n: slot.max})}`}
    : {kind: "hold", kg: 0, reps: Math.min(slot.max, Math.max(...last.sets.map(x => x.reps)) + 5), text: `${prev} ${tx("Heute etwa 5 s länger. Ziel: {range}.", {range})}`};
}

// Doppelte Progression pro Übung (Plotkin et al. 2022): erst alle Sätze bis zum oberen Ende der Spanne, dann Gewicht steigern.
export function suggest(slot) {
  const e = ex(slot.exId), last = lastSetsFor(slot.exId);
  if (noLoad(e)) return suggestNoLoad(slot, e, last);
  if (!last) {
    return {kind: "new", kg: startWeight(e), reps: slot.max,
      text: e.unit === "bw"
        ? tx("Erstes Mal. Ziel: {s} × {a}–{b} Wiederholungen.", {s: slot.sets, a: slot.min, b: slot.max})
        : tx("Erstes Mal. SATZ hilft dir, das Gewicht zu finden: Testsatz mit {n} sauberen Wdh., dann angeben, wie viele noch gegangen wären.", {n: slot.max})};
  }
  const kg = Math.max(...last.sets.map(x => x.kg));
  const top = last.sets.filter(x => x.kg === kg);
  const prev = tx("Letztes Mal: {w}, {list} Wdh.", {w: fmtW(e, kg), list: last.sets.map(x => x.reps).join(" + ")});
  const pl = plateau(slot.exId);
  // Geplante Entlastungswoche: halbe Satzzahl, etwa 90 % der Last, Wiederholungen am unteren Ende mit Luft.
  if (slot.deload) {
    const lighter = kg > 0 ? roundTo(kg * 0.9, e.step) : 0;
    return {kind: "deload", kg: lighter, reps: slot.min,
      text: `${prev} ${txn(slot.sets, "Entlastungswoche: {n} Satz mit {w} und {r} Wdh., 3 oder mehr in Reserve. Nächste Woche geht es vom alten Stand weiter.", "Entlastungswoche: {n} Sätze mit {w} und {r} Wdh., 3 oder mehr in Reserve. Nächste Woche geht es vom alten Stand weiter.", {w: fmtW(e, lighter), r: slot.min})}`};
  }
  const gap = daysSince(last.session.date);
  // Nach über 14 Tagen Pause 90 %: vorsichtige Faustregel. Kraft lässt nach Trainingspausen messbar nach,
  // umso mehr, je länger die Pause (Bosquet et al. 2013). Der genaue Wert ist nicht belegt.
  if (gap > 14) {
    const lighter = roundTo(kg * 0.9, e.step);
    return {kind: "return", kg: lighter, reps: slot.min,
      text: `${prev} ${tx("Das ist {n} Tage her. Starte heute etwas leichter mit {w} und finde wieder rein.", {n: gap, w: fmtW(e, lighter)})}`};
  }
  // RIR fließt ein: Ziel erreicht und alle Sätze mit 3+ Wdh. in Reserve → zwei Schritte; Ziel erreicht → ein Schritt.
  const rirs = top.map(x => x.rir).filter(r => r != null), easy = rirs.length === top.length && rirs.length && rirs.every(r => r >= 3);
  // Steigern, wenn alle Sätze in der Spanne liegen und der erste Satz das obere Ende erreicht. Ein verpatzter letzter Satz
  // blockiert so nicht mehr. Ist der Gewichtsschritt groß im Verhältnis zur Last (über 10 %, z. B. 1 kg auf 8 kg beim Seitheben),
  // muss der erste Satz zwei Wdh. über die Spanne kommen, damit der Sprung nicht zu groß wird.
  const bigJump = kg > 0 && e.step / kg > 0.1, need = slot.max + (bigJump ? 2 : 0);
  const inRange = top.length >= slot.sets && top.every(x => x.reps >= slot.min);
  if (inRange && top[0].reps >= need) {
    const up = kg + e.step * (easy ? 2 : 1);
    return {kind: "up", kg: up, reps: slot.min,
      text: `${prev} ${easy ? tx("Ziel erreicht und es war noch viel Luft.") : tx("Ziel erreicht.")} ${tx("Heute {w} versuchen, Ziel ab {n} Wdh.", {w: fmtW(e, up), n: slot.min})}`};
  }
  if (inRange && bigJump && top[0].reps >= slot.max) return {kind: "hold", kg, reps: need,
    text: `${prev} ${tx("Der nächste Gewichtsschritt wäre über 10 %. Erst {n} Wdh. im ersten Satz schaffen, dann steigern.", {n: need})}`};
  // Plateau: dreimal in Folge kein Fortschritt beim geschätzten 1RM → kurz entlasten und neu aufbauen.
  // Eine Entlastung (Deload) ist eine kurze Phase mit weniger Last zur Erholung (Bell et al. 2023, Delphi-Konsens).
  if (pl && kg > 0) {
    const lighter = roundTo(kg * 0.9, e.step);
    return {kind: "plateau", kg: lighter, reps: slot.max,
      text: `${prev} ${tx("Seit {n} Trainings kein Fortschritt. Heute entlasten: {w} und {r} saubere Wdh., danach wieder steigern. Bleibt es hängen, tausch die Übung.", {n: pl, w: fmtW(e, lighter), r: slot.max})}`};
  }
  if (kg > 0 && last.sets.every(x => x.reps < slot.min)) {
    const down = roundTo(kg - e.step, e.step);
    return {kind: "down", kg: down, reps: slot.min,
      text: `${prev} ${tx("Alle Sätze unter {n} Wdh. Heute leichter: {w}.", {n: slot.min, w: fmtW(e, down)})}`};
  }
  if (easy) return {kind: "hold", kg, reps: Math.min(slot.max, top[0].reps + 2),
    text: `${prev} ${tx("Du hattest 3+ Wdh. in Reserve. Geh heute näher ans Limit, Ziel: {s} × {n}.", {s: slot.sets, n: slot.max})}`};
  return {kind: "hold", kg, reps: Math.min(slot.max, top[0].reps + 1),
    text: `${prev} ${tx("Gewicht halten und eine Wiederholung mehr schaffen. Ziel: {s} × {n}.", {s: slot.sets, n: slot.max})}`};
}

/* ---------- Motivation: Wochenziel statt Tagesserie ----------
   Keine Streaks pro Tag: Ruhetage und Entlastungswochen gehören zum Training (Lally et al. 2010: ein verpasster Tag schadet der Gewohnheit nicht).
   Gezählt werden Wochen (Mo–So), in denen das Wochenziel des aktiven Plans erreicht wurde. Als Pause markierte Wochen (Urlaub, krank)
   unterbrechen die Serie nicht und zählen nicht mit. Die laufende Woche zählt erst, wenn ihr Ziel erreicht ist. */
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function weekStart(date = new Date()) {
  const d = new Date(date); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d);
}
export const sessionDay = s => ymd(new Date(s.date));
export const weekGoal = () => (activePlan() || {perWeek: 3}).perWeek;
export const isPaused = wk => (S.pauses || []).includes(wk);
export function togglePause(wk = weekStart()) {
  S.pauses = S.pauses || [];
  S.pauses = isPaused(wk) ? S.pauses.filter(x => x !== wk) : [...S.pauses, wk].sort();
  save();
}
export function weekDays(wk = weekStart()) {
  const start = new Date(wk + "T12:00:00");
  const byDay = {};
  S.sessions.forEach(s => { const k = sessionDay(s); byDay[k] = (byDay[k] || 0) + 1; });
  return Array.from({length: 7}, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); const k = ymd(d); return {key: k, date: d, n: byDay[k] || 0}; });
}
// Geplante Trainingstage (0 = Montag). Ohne eigene Planung: gleichmäßig verteilt nach „pro Woche“ des aktiven Plans.
export const PRESET_DAYS = {1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6]};
export const trainDays = () => Array.isArray(S.settings.trainDays) ? [...S.settings.trainDays] : [...(PRESET_DAYS[weekGoal()] || PRESET_DAYS[3])];
export const weekCount = wk => weekDays(wk).reduce((a, d) => a + d.n, 0);
/* Kalender: S.dayPlan speichert nur Abweichungen vom Wochenmuster. Ohne Eintrag gilt das Muster (trainDays).
   "pause" = Urlaub/krank: ein so markierter Trainingstag senkt das Wochenziel um 1, die Serie bricht nicht. */
export const DAY_STATES = ["train", "rest", "pause"];
const addDays = (key, n) => { const d = new Date(key + "T12:00:00"); d.setDate(d.getDate() + n); return ymd(d); };
export const keyAdd = addDays;
export const dateKey = d => ymd(new Date(d));
export const patternFor = key => trainDays().includes((new Date(key + "T12:00:00").getDay() + 6) % 7) ? "train" : "rest";
export const dayOverride = key => (S.dayPlan || {})[key] || null;
export function planFor(key) {
  if (isPaused(weekStart(new Date(key + "T12:00:00")))) return "pause";
  return dayOverride(key) || patternFor(key);
}
export function setDay(key, v, persist = true) {
  S.dayPlan = S.dayPlan || {};
  if (v == null || v === patternFor(key)) delete S.dayPlan[key];
  else if (DAY_STATES.includes(v)) S.dayPlan[key] = v;
  if (persist) save();
}
// Training verschieben: alter Tag wird Ruhetag, neuer Tag Trainingstag. Das Wochenmuster bleibt.
export function moveTraining(from, to) { setDay(from, "rest", false); setDay(to, "train", false); save(); }
// Zeitraum pausieren (max. 92 Tage) oder Pause darin wieder aufheben
export function pauseRange(from, to, on = true) {
  if (to < from) [from, to] = [to, from];
  for (let k = from, i = 0; k <= to && i < 92; k = addDays(k, 1), i++) {
    if (on) setDay(k, "pause", false); else if (dayOverride(k) === "pause") setDay(k, null, false);
  }
  save();
}
export function weekGoalFor(wk = weekStart()) {
  if (isPaused(wk)) return 0;
  let off = 0;
  for (let i = 0; i < 7; i++) { const k = addDays(wk, i); if (dayOverride(k) === "pause" && patternFor(k) === "train") off++; }
  return Math.max(0, weekGoal() - off);
}
// Serie: Wochen in Folge mit erreichtem Ziel, rückwärts ab der laufenden (zählt nur, wenn schon erreicht) bzw. der letzten Woche
export function weekStreak() {
  if (!S.sessions.length) return {weeks: 0, paused: 0};
  const first = weekStart(new Date(Math.min(...S.sessions.map(x => new Date(x.date).getTime()))));
  let wk = weekStart(), weeks = 0, paused = 0;
  const prev = k => addDays(k, -7);
  if (weekCount(wk) < weekGoalFor(wk) || weekGoalFor(wk) === 0) wk = prev(wk);
  while (wk >= first) {
    const goal = weekGoalFor(wk);
    if (goal === 0 && weekCount(wk) < weekGoal()) { paused++; wk = prev(wk); continue; }
    if (goal === 0) { weeks++; wk = prev(wk); continue; }
    if (weekCount(wk) < goal) break;
    weeks++; wk = prev(wk);
  }
  return {weeks, paused};
}
// Neue Bestwerte im laufenden Training gegenüber allen gespeicherten Trainings.
// Mit Gewicht: geschätztes 1RM (Epley). Ohne Gewicht: meiste Wdh. in einem Satz. Halten: längste Zeit. Mobility: keine Rekorde.
export function newRecords(sets) {
  const out = [], seen = new Set();
  for (const x of sets) {
    if (x.type === "warm" || seen.has(x.exId)) continue;
    seen.add(x.exId);
    const e = ex(x.exId); if (isMobility(e)) continue;
    const mine = sets.filter(y => y.exId === x.exId && y.type !== "warm");
    const old = S.sessions.flatMap(s => s.sets.filter(y => y.exId === x.exId && y.type !== "warm"));
    if (!old.length) continue;
    const weighted = e.unit === "kg" || (e.unit === "bw" && (mine.some(y => y.kg > 0) || old.some(y => y.kg > 0)));
    if (weighted) {
      const now = Math.max(...mine.map(y => e1rm(y.kg, y.reps))), before = Math.max(...old.map(y => e1rm(y.kg, y.reps)));
      if (now > before + 0.01) { const b = mine.find(y => e1rm(y.kg, y.reps) === now); out.push({exId: x.exId, name: e.name, text: tx("{w} × {r}, 1RM ca. {now} kg (vorher {before})", {w: fmtW(e, b.kg), r: b.reps, now: fmt(Math.round(now * 10) / 10), before: fmt(Math.round(before * 10) / 10)})}); }
    } else {
      const now = Math.max(...mine.map(y => y.reps)), before = Math.max(...old.map(y => y.reps));
      if (now > before) out.push({exId: x.exId, name: e.name, text: e.unit === "s" ? tx("{n} s gehalten (vorher {m} s)", {n: now, m: before}) : tx("{n} Wdh. in einem Satz (vorher {m})", {n: now, m: before})});
    }
  }
  return out;
}

/* ---------- Monatsrückblick ---------- */
// Trainings, harte Sätze (ohne Mobility), Trainingszeit, meistbelastete Muskeln und Bestwerte eines Kalendermonats (m: 0–11)
export function monthStats(y, m) {
  const inM = s => { const d = new Date(s.date); return d.getFullYear() === y && d.getMonth() === m; };
  const ses = S.sessions.filter(inM);
  const hard = ses.flatMap(s => s.sets.filter(isHard)).filter(x => !isMobility(ex(x.exId)));
  const mins = ses.reduce((a, s) => a + (s.end ? Math.max(0, Math.min(240, (new Date(s.end) - new Date(s.date)) / 60000)) : 0), 0);
  const v = zero(); hard.forEach(x => addSets(v, x.exId, 1));
  const top = MUSCLES.filter(mm => v[mm.id] > 0).sort((a, b) => v[b.id] - v[a.id]).slice(0, 3).map(mm => ({name: mm.name, sets: v[mm.id]}));
  // Bestwerte: jedes Training gegen alle früheren (Gewicht: geschätztes 1RM, ohne Gewicht: meiste Wdh. bzw. Sekunden)
  const best = {}; let records = 0;
  [...S.sessions].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(s => {
    const by = {};
    s.sets.filter(x => x.type !== "warm").forEach(x => { const e = ex(x.exId); if (isMobility(e)) return;
      const val = e.unit === "kg" ? e1rm(x.kg, x.reps) : x.reps; by[x.exId] = Math.max(by[x.exId] ?? 0, val); });
    for (const [k, val] of Object.entries(by)) { if (best[k] != null && val > best[k] + 0.01 && inM(s)) records++; best[k] = Math.max(best[k] ?? 0, val); }
  });
  return {sessions: ses.length, days: new Set(ses.map(sessionDay)).size, hard: hard.length, mins: Math.round(mins), top, records};
}

/* ---------- Kalenderdatei (.ics) ----------
   iOS stellt einer Web-App ohne Server keine verlässlichen Erinnerungen zu. Ein wiederkehrender Termin im Kalender
   mit Erinnerung funktioniert dagegen überall und ganz ohne SATZ im Hintergrund. RFC 5545, lokale Zeit ohne Zeitzone. */
const ICS_DAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
export function icsFor({days, time, before, minutes, title, url}) {
  const [hh, mm] = time.split(":").map(Number), now = new Date();
  const start = new Date(); start.setHours(hh, mm, 0, 0);
  for (let i = 0; i < 8; i++) { const wd = (start.getDay() + 6) % 7; if (days.includes(wd) && start > now) break; start.setDate(start.getDate() + 1); start.setHours(hh, mm, 0, 0); }
  const loc = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const utc = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const esc = t => t.replace(/[\\;,]/g, c => "\\" + c).replace(/\n/g, "\\n");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SATZ//Trainingsheft//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:satz-${uid()}@satz`, `DTSTAMP:${utc}`, `DTSTART:${loc(start)}`, `DURATION:PT${Math.max(15, Math.round(minutes))}M`,
    `RRULE:FREQ=WEEKLY;BYDAY=${days.sort((a, b) => a - b).map(d => ICS_DAYS[d]).join(",")}`,
    `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(tx("Öffne SATZ und starte dein Training:") + " " + url)}`, `URL:${url}`,
    ...(before >= 0 ? ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(title)}`, `TRIGGER:-PT${before}M`, "END:VALARM"] : []),
    "END:VEVENT", "END:VCALENDAR", ""].join("\r\n");
}

/* ---------- Training ---------- */
export function startSession(p, dayIdx) {
  const d = p.days[dayIdx], dl = deloadNow(p);
  S.active = {
    id: uid(), start: new Date().toISOString(), planId: p.id, planName: p.name, dayId: d.id, dayName: d.name,
    queue: d.slots.map(sl => ({slotId: sl.id, exId: sl.exId, sets: dl ? deloadSets(sl.sets) : sl.sets, min: sl.min, max: sl.max, rest: restFor(sl), skipped: false, extra: 0, ...(dl ? {deload: true} : {})})),
    ...(dl ? {deload: true} : {}),
    idx: 0, sets: [], restEnd: 0,
  };
  save();
}
export const loggedFor = (a, i) => a.sets.filter(x => x.q === i && x.type !== "warm");
// Arbeitssätze, die zum Satzziel zählen. Aufwärm- und Drop-Sätze kommen zusätzlich dazu (seit 0.9.2).
export const workFor = (a, i) => a.sets.filter(x => x.q === i && !x.type);
export const warmupsFor = (a, i) => a.sets.filter(x => x.q === i && x.type === "warm");
export const targetSets = item => item.sets + item.extra;
export function firstOpen(a, from = 0) {
  for (let k = 0; k < a.queue.length; k++) {
    const i = (from + k) % a.queue.length, it = a.queue[i];
    if (!it.skipped && workFor(a, i).length < targetSets(it)) return i;
  }
  return -1;
}
export function finishSession() {
  const a = S.active;
  const session = {
    id: a.id, date: a.start, end: new Date().toISOString(), planId: a.planId, planName: a.planName,
    dayId: a.dayId, dayName: a.dayName,
    sets: a.sets.map(({exId, kg, reps, rir, type}) => ({exId, kg, reps, rir, ...(type && type !== "work" ? {type} : {})})),
    ...(a.notes && Object.keys(a.notes).length ? {notes: a.notes} : {}),
    ...(a.deload ? {deload: true} : {}),
  };
  if (session.sets.length) S.sessions.push(session);
  S.active = null;
  save();
  return session;
}

/* ---------- Import-Prüfung ----------
   Eine Sicherungsdatei kann von irgendwoher kommen. Alles wird auf Typ und Wertebereich geprüft und neu aufgebaut,
   IDs dürfen nur aus Buchstaben, Ziffern, _ und - bestehen. Unbekannte Felder fallen weg. Wirft bei Fehlern. */
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const MUSCLE_IDS = new Set(MUSCLES.map(m => m.id));
function bad(msg) { throw new Error(msg); }
const id = (v, what) => typeof v === "string" && ID.test(v) ? v : bad(tx("Ungültige ID bei {what}.", {what: tx(what)}));
const optId = (v, what) => v == null ? null : id(v, what);
const str = (v, max = 200) => typeof v === "string" ? v.slice(0, max) : "";
const num = (v, lo, hi, what) => typeof v === "number" && isFinite(v) && v >= lo && v <= hi ? v : bad(tx("Ungültige Zahl bei {what}.", {what: tx(what)}));
const optNum = (v, lo, hi, def) => typeof v === "number" && isFinite(v) && v >= lo && v <= hi ? v : def;
const arr = (v, what) => Array.isArray(v) ? v : bad(tx("{what} fehlt.", {what: tx(what)}));
const iso = (v, what) => typeof v === "string" && !isNaN(new Date(v)) ? v : bad(tx("Ungültiges Datum bei {what}.", {what: tx(what)}));
const day = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : bad(tx("Ungültiges Datum."));
const per100 = v => ({kcal: num(v && v.kcal, 0, 900, "kcal"), p: num(v.p, 0, 100, "Protein"), c: num(v.c, 0, 100, "Kohlenhydrate"), f: num(v.f, 0, 100, "Fett")});
export function sanitizeImport(d) {
  if (!d || typeof d !== "object" || d.version !== VERSION) bad(tx("Keine SATZ-Sicherung dieser Version."));
  const exercises = {};
  for (const [k, e] of Object.entries(d.exercises || bad(tx("Übungen fehlen.")))) {
    id(k, "Übung");
    exercises[k] = {id: k, name: str(e.name, 80) || "Übung", primary: arr(e.primary, "Muskeln").filter(m => MUSCLE_IDS.has(m)), secondary: arr(e.secondary || [], "Muskeln").filter(m => MUSCLE_IDS.has(m)),
      step: optNum(e.step, 0.1, 50, 2.5), unit: ["bw", "band", "s"].includes(e.unit) ? e.unit : "kg", custom: !!e.custom, ...(e.archived ? {archived: true} : {})};
    if (!exercises[k].primary.length) exercises[k].primary = ["brust"];
  }
  const plans = arr(d.plans, "Pläne").map(p => ({id: id(p.id, "Plan"), name: str(p.name, 80) || "Plan", perWeek: Math.round(optNum(p.perWeek, 1, 7, 3)), template: typeof p.template === "string" && ID.test(p.template) ? p.template : undefined, goal: ["kraft", "ausdauer", "athletik", "mobil"].includes(p.goal) ? p.goal : "kraft",
    ...(p.cycle && typeof p.cycle === "object" ? {cycle: {weeks: CYCLES.includes(p.cycle.weeks) ? p.cycle.weeks : DEFAULT_CYCLE, start: day(p.cycle.start)}} : {}),
    days: arr(p.days, "Tage").map(dd => ({id: id(dd.id, "Tag"), name: str(dd.name, 80) || "Tag",
      slots: arr(dd.slots, "Übungen").map(s => ({id: id(s.id, "Slot"), exId: id(s.exId, "Übung"), sets: Math.round(num(s.sets, 1, 20, "Sätze")),
        min: Math.round(num(s.min, 1, 100, "Wdh.")), max: Math.round(num(s.max, 1, 100, "Wdh.")), rest: Math.round(optNum(s.rest, 0, 900, 0))}))}))}));
  const sessions = arr(d.sessions, "Trainings").map(x => ({id: id(x.id, "Training"), date: iso(x.date, "Training"), ...(x.end ? {end: iso(x.end, "Training")} : {}),
    planId: optId(x.planId, "Training"), planName: str(x.planName, 80), dayId: optId(x.dayId, "Training"), dayName: str(x.dayName, 80),
    sets: arr(x.sets, "Sätze").map(y => ({exId: id(y.exId, "Satz"), kg: num(y.kg, 0, 1000, "Gewicht"), reps: Math.round(num(y.reps, 0, 100, "Wdh.")),
      rir: y.rir == null ? null : Math.round(num(y.rir, 0, 4, "RIR")), ...(y.type === "warm" || y.type === "drop" ? {type: y.type} : {})})),
    ...(x.deload ? {deload: true} : {}),
    ...(x.notes && typeof x.notes === "object" ? {notes: Object.fromEntries(Object.entries(x.notes).filter(([k]) => ID.test(k)).map(([k, v]) => [k, str(v, 500)]))} : {})}));
  const s = d.settings || {};
  const settings = {scale: [1, 1.15, 1.3, 1.5].includes(s.scale) ? s.scale : 1, theme: ["auto", "light", "dark"].includes(s.theme) ? s.theme : "auto",
    contrast: !!s.contrast, rir: s.rir !== false, rest: [0, 60, 90, 120, 180].includes(s.rest) ? s.rest : 0, sound: s.sound !== false, voice: s.voice !== false, bgBell: !!s.bgBell, showFig: s.showFig !== false,
    accent: ["graphit", "gruen", "kobalt", "signal", "petrol", "violett", "beere", "kupfer", "ocker"].includes(s.accent) ? s.accent : "gruen", accentSet: true,
    ...(s.lastBackup ? {lastBackup: iso(s.lastBackup, "Sicherung")} : {}),
    ...(s.onboarded ? {onboarded: true} : {}),
    ...(Array.isArray(s.trainDays) ? {trainDays: [...new Set(s.trainDays.filter(v => Number.isInteger(v) && v >= 0 && v <= 6))].sort()} : {}),
    ...(s.remind && typeof s.remind === "object" ? {remind: {days: arr(s.remind.days || [], "Erinnerung").filter(v => Number.isInteger(v) && v >= 0 && v <= 6),
      time: typeof s.remind.time === "string" && /^\d{2}:\d{2}$/.test(s.remind.time) ? s.remind.time : "18:00", before: [0, 15, 30, 60].includes(s.remind.before) ? s.remind.before : 15}} : {}), ...(LANG_IDS.includes(s.lang) ? {lang: s.lang} : {})};
  const pr = d.profile || {};
  const profile = {birth: typeof pr.birth === "string" && /^\d{4}-\d{2}-\d{2}$/.test(pr.birth) ? pr.birth : "", sex: ["m", "w", "x"].includes(pr.sex) ? pr.sex : "",
    height: optNum(pr.height, 0, 250, 0), pal: [1.4, 1.55, 1.7, 1.9].includes(pr.pal) ? pr.pal : 1.55, goal: ["lose", "maintain", "gain"].includes(pr.goal) ? pr.goal : "maintain",
    manual: !!pr.manual, kcal: optNum(pr.kcal, 0, 8000, 0), p: optNum(pr.p, 0, 1000, 0), c: optNum(pr.c, 0, 2000, 0), f: optNum(pr.f, 0, 1000, 0),
    ...(pr.tdeeAdj && typeof pr.tdeeAdj === "object" ? {tdeeAdj: {tdee: num(pr.tdeeAdj.tdee, 800, 8000, "Verbrauch"), date: day(pr.tdeeAdj.date), days: Math.round(optNum(pr.tdeeAdj.days, 0, 60, 0))}} : {})};
  const weights = arr(d.weights || [], "Gewicht").map(w => ({date: day(w.date), kg: num(w.kg, 20, 400, "Gewicht")}));
  const measures = arr(d.measures || [], "Körpermaße").map(m => ({date: day(m.date),
    m: Object.fromEntries(Object.entries(m.m || {}).filter(([k, v]) => MEASURE_IDS.has(k) && typeof v === "number" && isFinite(v) && v >= 10 && v <= 250))}));
  const foods = {};
  for (const [k, f] of Object.entries(d.foods || {})) { id(k, "Lebensmittel"); foods[k] = {id: k, name: str(f.name, 120) || "Lebensmittel", brand: str(f.brand, 80), barcode: /^\d{0,14}$/.test(f.barcode || "") ? f.barcode || "" : "", per100: per100(f.per100), serving: optNum(f.serving, 0, 5000, 0), source: f.source === "off" ? "off" : "own", ...(f.fav ? {fav: true} : {})}; }
  const food = arr(d.food || [], "Tagebuch").map(e => ({id: id(e.id, "Eintrag"), date: day(e.date), meal: ["fruehstueck", "mittag", "abend", "snack"].includes(e.meal) ? e.meal : "snack",
    foodId: optId(e.foodId, "Eintrag"), name: str(e.name, 120) || "Lebensmittel", brand: str(e.brand, 80), per100: per100(e.per100), grams: num(e.grams, 0, 5000, "Menge"), ...(e.quick ? {quick: true} : {})}));
  const pauses = [...new Set(arr(d.pauses || [], "Pausenwochen").filter(v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)))].sort();
  const activePlanId = d.activePlanId && plans.some(p => p.id === d.activePlanId) ? d.activePlanId : plans[0]?.id || null;
  const dayPlan = {};
  for (const [k, v] of Object.entries(d.dayPlan && typeof d.dayPlan === "object" ? d.dayPlan : {})) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && DAY_STATES.includes(v)) dayPlan[k] = v;
  return {version: VERSION, exercises, plans, activePlanId, sessions, active: null, settings, profile, weights, measures, foods, food, pauses, dayPlan};
}
