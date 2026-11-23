// Zustand, Speicherung, Progression und Volumen.
import {EXERCISES, TEMPLATES, MUSCLES, isCompound, defaultRest} from "./data.js";

const KEY = "satz-data";
export const VERSION = 1;
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

export let S = null;

function fresh() {
  const exercises = {};
  EXERCISES.forEach(e => exercises[e.id] = {...e});
  return {
    version: VERSION, exercises, plans: [], activePlanId: null, sessions: [], active: null,
    settings: {scale: 1, theme: "auto", contrast: false, rir: true, rest: 0},
  };
}

// Beim Laden nie stillschweigend überschreiben: Unlesbare oder fremde Daten werden vorher beiseitegelegt.
export let recovered = null;   // {key, reason} wenn Altdaten gesichert wurden
export function load() {
  const raw = localStorage.getItem(KEY);
  let d = null, reason = "";
  if (raw) { try { d = JSON.parse(raw); } catch (e) { reason = "unlesbar"; } }
  if (raw && !reason && !valid(d)) reason = d && d.version > VERSION ? "neuere Version" : "unbekanntes Format";
  if (reason) {
    const key = `${KEY}-gesichert-${new Date().toISOString().slice(0, 19)}`;
    try { localStorage.setItem(key, raw); recovered = {key, reason}; } catch (e) { recovered = {key: null, reason, raw}; }
  }
  S = reason || !d ? fresh() : d;
  migrate();
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
  // Ab 0.3.1 ist Grün der Standard (Lucas Wahl). Einmalig umstellen, danach gilt die eigene Auswahl.
  if (S.settings.sound == null) S.settings.sound = true;
  if (!S.settings.accentSet) { S.settings.accent = "gruen"; S.settings.accentSet = true; }
}
export const currentWeight = () => S.weights.length ? S.weights[S.weights.length - 1].kg : 0;

export function valid(d) {
  return d && d.version === VERSION && d.exercises && Array.isArray(d.plans) && Array.isArray(d.sessions) && d.settings;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch (e) { return false; }
}

export function replaceAll(data) { S = data; migrate(); save(); }
export function snapshot() { return JSON.stringify(S); }
export function restore(snap) { S = JSON.parse(snap); migrate(); save(); }

/* ---------- Pläne ---------- */
export function instantiate(t) {
  return {
    id: uid(), name: t.name, perWeek: t.perWeek, template: t.id, goal: t.goal || "kraft",
    days: t.days.map(d => ({
      id: uid(), name: d.name,
      slots: d.slots.map(([exId, sets, min, max, rest]) => ({id: uid(), exId, sets, min, max, rest: rest || 0})),
    })),
  };
}
export const plan = id => S.plans.find(p => p.id === id);
export const activePlan = () => plan(S.activePlanId) || null;
export const ex = id => S.exercises[id] || {id, name: "Unbekannte Übung", primary: [], secondary: [], step: 2.5, unit: "kg"};

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

export function lastSetsFor(exId) {
  for (let i = S.sessions.length - 1; i >= 0; i--) {
    const sets = S.sessions[i].sets.filter(x => x.exId === exId && isWork(x));
    if (sets.length) return {session: S.sessions[i], sets};
  }
  return null;
}
// Anzahl der letzten Trainings ohne neuen Bestwert beim geschätzten 1RM (ab 3 zählt es als Plateau)
export function plateau(exId) {
  let hist = S.sessions.map(s => s.sets.filter(x => x.exId === exId && isWork(x))).filter(x => x.length);
  const top = sets => Math.max(...sets.map(x => x.kg)), best = sets => Math.max(...sets.map(x => e1rm(x.kg, x.reps)));
  // Nach einer Entlastung (Training mit unter 95 % des vorherigen Gewichts) neu zählen
  for (let k = hist.length - 1; k > 0; k--) if (top(hist[k]) < top(hist[k - 1]) * 0.95) { hist = hist.slice(k + 1); break; }
  if (hist.length < 4) return 0;
  const vals = hist.map(best), peak = Math.max(...vals.slice(0, -3));
  return vals.slice(-3).every(v => v <= peak + 0.01) ? 3 : 0;
}
export function setCount(exId) {
  return S.sessions.reduce((a, s) => a + s.sets.filter(x => x.exId === exId).length, 0);
}
// Sinnvoller Startwert beim ersten Mal: Langhantel 20 kg, sonst ein leichtes Gewicht (danach direkt eintippen)
export function startWeight(e) {
  if (e.unit === "bw") return 0;
  if (/langhantel|bankdr|kniebeug|kreuzheb|rudern|schulterdr|sz/i.test(e.name) && !/kurzhantel/i.test(e.name)) return 20;
  return isCompound(e) ? 20 : 10;
}

const roundTo = (x, step) => step ? Math.max(0, Math.round(x / step) * step) : x;
export const fmt = n => (Math.round(n * 100) / 100).toLocaleString("de-DE");
export function fmtW(e, kg) {
  if (e.unit === "bw") return kg ? `Körpergewicht + ${fmt(kg)} kg` : "Körpergewicht";
  return `${fmt(kg)} kg`;
}

// Doppelte Progression pro Übung (Plotkin et al. 2022): erst alle Sätze bis zum oberen Ende der Spanne, dann Gewicht steigern.
export function suggest(slot) {
  const e = ex(slot.exId), last = lastSetsFor(slot.exId);
  if (!last) {
    return {kind: "new", kg: startWeight(e), reps: slot.max,
      text: e.unit === "bw"
        ? `Erstes Mal. Ziel: ${slot.sets} × ${slot.min}–${slot.max} Wiederholungen.`
        : `Erstes Mal. Wähle ein Gewicht, mit dem du ${slot.max} saubere Wiederholungen schaffst.`};
  }
  const kg = Math.max(...last.sets.map(x => x.kg));
  const top = last.sets.filter(x => x.kg === kg);
  const prev = `Letztes Mal: ${fmtW(e, kg)}, ${last.sets.map(x => x.reps).join(" + ")} Wdh.`;
  const pl = plateau(slot.exId);
  const gap = daysSince(last.session.date);
  // Nach über 14 Tagen Pause 90 %: vorsichtige Faustregel. Kraft lässt nach Trainingspausen messbar nach,
  // umso mehr, je länger die Pause (Bosquet et al. 2013). Der genaue Wert ist nicht belegt.
  if (gap > 14) {
    const lighter = roundTo(kg * 0.9, e.step);
    return {kind: "return", kg: lighter, reps: slot.min,
      text: `${prev} Das ist ${gap} Tage her. Starte heute etwas leichter mit ${fmtW(e, lighter)} und finde wieder rein.`};
  }
  // RIR fließt ein: Ziel erreicht und alle Sätze mit 3+ Wdh. in Reserve → zwei Schritte; Ziel erreicht → ein Schritt.
  const rirs = top.map(x => x.rir).filter(r => r != null), easy = rirs.length === top.length && rirs.length && rirs.every(r => r >= 3);
  if (top.length >= slot.sets && top.every(x => x.reps >= slot.max)) {
    const up = kg + e.step * (easy ? 2 : 1);
    return {kind: "up", kg: up, reps: slot.min,
      text: `${prev} Ziel erreicht${easy ? " und es war noch viel Luft" : ""}. Heute ${fmtW(e, up)} versuchen, Ziel ab ${slot.min} Wdh.`};
  }
  // Plateau: dreimal in Folge kein Fortschritt beim geschätzten 1RM → kurz entlasten und neu aufbauen.
  // Eine Entlastung (Deload) ist eine kurze Phase mit weniger Last zur Erholung (Bell et al. 2023, Delphi-Konsens).
  if (pl && kg > 0) {
    const lighter = roundTo(kg * 0.9, e.step);
    return {kind: "plateau", kg: lighter, reps: slot.max,
      text: `${prev} Seit ${pl} Trainings kein Fortschritt. Heute entlasten: ${fmtW(e, lighter)} und ${slot.max} saubere Wdh., danach wieder steigern. Bleibt es hängen, tausch die Übung.`};
  }
  if (kg > 0 && last.sets.every(x => x.reps < slot.min)) {
    const down = roundTo(kg - e.step, e.step);
    return {kind: "down", kg: down, reps: slot.min,
      text: `${prev} Alle Sätze unter ${slot.min} Wdh. Heute leichter: ${fmtW(e, down)}.`};
  }
  if (easy) return {kind: "hold", kg, reps: Math.min(slot.max, top[0].reps + 2),
    text: `${prev} Du hattest 3+ Wdh. in Reserve. Geh heute näher ans Limit, Ziel: ${slot.sets} × ${slot.max}.`};
  return {kind: "hold", kg, reps: Math.min(slot.max, top[0].reps + 1),
    text: `${prev} Gewicht halten und eine Wiederholung mehr schaffen. Ziel: ${slot.sets} × ${slot.max}.`};
}

/* ---------- Training ---------- */
export function startSession(p, dayIdx) {
  const d = p.days[dayIdx];
  S.active = {
    id: uid(), start: new Date().toISOString(), planId: p.id, planName: p.name, dayId: d.id, dayName: d.name,
    queue: d.slots.map(sl => ({slotId: sl.id, exId: sl.exId, sets: sl.sets, min: sl.min, max: sl.max, rest: restFor(sl), skipped: false, extra: 0})),
    idx: 0, sets: [], restEnd: 0,
  };
  save();
}
export const loggedFor = (a, i) => a.sets.filter(x => x.q === i && x.type !== "warm");
export const warmupsFor = (a, i) => a.sets.filter(x => x.q === i && x.type === "warm");
export const targetSets = item => item.sets + item.extra;
export function firstOpen(a, from = 0) {
  for (let k = 0; k < a.queue.length; k++) {
    const i = (from + k) % a.queue.length, it = a.queue[i];
    if (!it.skipped && loggedFor(a, i).length < targetSets(it)) return i;
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
const id = (v, what) => typeof v === "string" && ID.test(v) ? v : bad(`Ungültige ID bei ${what}.`);
const optId = (v, what) => v == null ? null : id(v, what);
const str = (v, max = 200) => typeof v === "string" ? v.slice(0, max) : "";
const num = (v, lo, hi, what) => typeof v === "number" && isFinite(v) && v >= lo && v <= hi ? v : bad(`Ungültige Zahl bei ${what}.`);
const optNum = (v, lo, hi, def) => typeof v === "number" && isFinite(v) && v >= lo && v <= hi ? v : def;
const arr = (v, what) => Array.isArray(v) ? v : bad(`${what} fehlt.`);
const iso = (v, what) => typeof v === "string" && !isNaN(new Date(v)) ? v : bad(`Ungültiges Datum bei ${what}.`);
const day = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : bad("Ungültiges Datum.");
const per100 = v => ({kcal: num(v && v.kcal, 0, 900, "kcal"), p: num(v.p, 0, 100, "Protein"), c: num(v.c, 0, 100, "Kohlenhydrate"), f: num(v.f, 0, 100, "Fett")});
export function sanitizeImport(d) {
  if (!d || typeof d !== "object" || d.version !== VERSION) bad("Keine SATZ-Sicherung dieser Version.");
  const exercises = {};
  for (const [k, e] of Object.entries(d.exercises || bad("Übungen fehlen."))) {
    id(k, "Übung");
    exercises[k] = {id: k, name: str(e.name, 80) || "Übung", primary: arr(e.primary, "Muskeln").filter(m => MUSCLE_IDS.has(m)), secondary: arr(e.secondary || [], "Muskeln").filter(m => MUSCLE_IDS.has(m)),
      step: optNum(e.step, 0.1, 50, 2.5), unit: e.unit === "bw" ? "bw" : "kg", custom: !!e.custom, ...(e.archived ? {archived: true} : {})};
    if (!exercises[k].primary.length) exercises[k].primary = ["brust"];
  }
  const plans = arr(d.plans, "Pläne").map(p => ({id: id(p.id, "Plan"), name: str(p.name, 80) || "Plan", perWeek: Math.round(optNum(p.perWeek, 1, 7, 3)), template: typeof p.template === "string" && ID.test(p.template) ? p.template : undefined, goal: ["kraft", "ausdauer", "athletik"].includes(p.goal) ? p.goal : "kraft",
    days: arr(p.days, "Tage").map(dd => ({id: id(dd.id, "Tag"), name: str(dd.name, 80) || "Tag",
      slots: arr(dd.slots, "Übungen").map(s => ({id: id(s.id, "Slot"), exId: id(s.exId, "Übung"), sets: Math.round(num(s.sets, 1, 20, "Sätze")),
        min: Math.round(num(s.min, 1, 100, "Wdh.")), max: Math.round(num(s.max, 1, 100, "Wdh.")), rest: Math.round(optNum(s.rest, 0, 900, 0))}))}))}));
  const sessions = arr(d.sessions, "Trainings").map(x => ({id: id(x.id, "Training"), date: iso(x.date, "Training"), ...(x.end ? {end: iso(x.end, "Training")} : {}),
    planId: optId(x.planId, "Training"), planName: str(x.planName, 80), dayId: optId(x.dayId, "Training"), dayName: str(x.dayName, 80),
    sets: arr(x.sets, "Sätze").map(y => ({exId: id(y.exId, "Satz"), kg: num(y.kg, 0, 1000, "Gewicht"), reps: Math.round(num(y.reps, 0, 100, "Wdh.")),
      rir: y.rir == null ? null : Math.round(num(y.rir, 0, 4, "RIR")), ...(y.type === "warm" || y.type === "drop" ? {type: y.type} : {})})),
    ...(x.notes && typeof x.notes === "object" ? {notes: Object.fromEntries(Object.entries(x.notes).filter(([k]) => ID.test(k)).map(([k, v]) => [k, str(v, 500)]))} : {})}));
  const s = d.settings || {};
  const settings = {scale: [1, 1.15, 1.3, 1.5].includes(s.scale) ? s.scale : 1, theme: ["auto", "light", "dark"].includes(s.theme) ? s.theme : "auto",
    contrast: !!s.contrast, rir: s.rir !== false, rest: [0, 60, 90, 120, 180].includes(s.rest) ? s.rest : 0, sound: s.sound !== false, showFig: s.showFig !== false,
    accent: ["graphit", "gruen", "kobalt", "signal"].includes(s.accent) ? s.accent : "gruen", accentSet: true,
    ...(s.lastBackup ? {lastBackup: iso(s.lastBackup, "Sicherung")} : {})};
  const pr = d.profile || {};
  const profile = {birth: typeof pr.birth === "string" && /^\d{4}-\d{2}-\d{2}$/.test(pr.birth) ? pr.birth : "", sex: ["m", "w", "x"].includes(pr.sex) ? pr.sex : "",
    height: optNum(pr.height, 0, 250, 0), pal: [1.4, 1.55, 1.7, 1.9].includes(pr.pal) ? pr.pal : 1.55, goal: ["lose", "maintain", "gain"].includes(pr.goal) ? pr.goal : "maintain",
    manual: !!pr.manual, kcal: optNum(pr.kcal, 0, 8000, 0), p: optNum(pr.p, 0, 1000, 0), c: optNum(pr.c, 0, 2000, 0), f: optNum(pr.f, 0, 1000, 0)};
  const weights = arr(d.weights || [], "Gewicht").map(w => ({date: day(w.date), kg: num(w.kg, 20, 400, "Gewicht")}));
  const foods = {};
  for (const [k, f] of Object.entries(d.foods || {})) { id(k, "Lebensmittel"); foods[k] = {id: k, name: str(f.name, 120) || "Lebensmittel", brand: str(f.brand, 80), barcode: /^\d{0,14}$/.test(f.barcode || "") ? f.barcode || "" : "", per100: per100(f.per100), serving: optNum(f.serving, 0, 5000, 0), source: f.source === "off" ? "off" : "own", ...(f.fav ? {fav: true} : {})}; }
  const food = arr(d.food || [], "Tagebuch").map(e => ({id: id(e.id, "Eintrag"), date: day(e.date), meal: ["fruehstueck", "mittag", "abend", "snack"].includes(e.meal) ? e.meal : "snack",
    foodId: optId(e.foodId, "Eintrag"), name: str(e.name, 120) || "Lebensmittel", brand: str(e.brand, 80), per100: per100(e.per100), grams: num(e.grams, 0, 5000, "Menge"), ...(e.quick ? {quick: true} : {})}));
  const activePlanId = d.activePlanId && plans.some(p => p.id === d.activePlanId) ? d.activePlanId : plans[0]?.id || null;
  return {version: VERSION, exercises, plans, activePlanId, sessions, active: null, settings, profile, weights, foods, food};
}
