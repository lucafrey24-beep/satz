// Zustand, Speicherung, Progression und Volumen.
import {EXERCISES, TEMPLATES, MUSCLES, isCompound} from "./data.js";

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

export function load() {
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!valid(S)) S = fresh();
  // neue Bibliotheksübungen nachrüsten, ohne eigene Umbenennungen zu überschreiben
  EXERCISES.forEach(e => { if (!S.exercises[e.id]) S.exercises[e.id] = {...e}; });
}

export function valid(d) {
  return d && d.version === VERSION && d.exercises && Array.isArray(d.plans) && Array.isArray(d.sessions) && d.settings;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch (e) { return false; }
}

export function replaceAll(data) { S = data; save(); }
export function snapshot() { return JSON.stringify(S); }
export function restore(snap) { S = JSON.parse(snap); save(); }

/* ---------- Pläne ---------- */
export function instantiate(t) {
  return {
    id: uid(), name: t.name, perWeek: t.perWeek, template: t.id,
    days: t.days.map(d => ({
      id: uid(), name: d.name,
      slots: d.slots.map(([exId, sets, min, max]) => ({id: uid(), exId, sets, min, max, rest: 0})),
    })),
  };
}
export const plan = id => S.plans.find(p => p.id === id);
export const activePlan = () => plan(S.activePlanId) || null;
export const ex = id => S.exercises[id] || {id, name: "Unbekannte Übung", primary: [], secondary: [], step: 2.5, unit: "kg"};

export function restFor(slot) {
  if (slot.rest) return slot.rest;
  if (S.settings.rest) return S.settings.rest;
  return isCompound(ex(slot.exId)) ? 120 : 90;
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
  S.sessions.filter(s => new Date(s.date).getTime() >= since).forEach(s => s.sets.forEach(x => addSets(v, x.exId, 1)));
  return v;
}
export function volStatus(m, x) {
  if (!m.major) return "";
  if (x < 10) return "low";
  if (x <= 20) return "ok";
  return "high";
}

/* ---------- Verlauf & Progression ---------- */
export const daysSince = iso => Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
export const lastSession = () => S.sessions[S.sessions.length - 1] || null;

export function lastSetsFor(exId) {
  for (let i = S.sessions.length - 1; i >= 0; i--) {
    const sets = S.sessions[i].sets.filter(x => x.exId === exId);
    if (sets.length) return {session: S.sessions[i], sets};
  }
  return null;
}
export function setCount(exId) {
  return S.sessions.reduce((a, s) => a + s.sets.filter(x => x.exId === exId).length, 0);
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
    return {kind: "new", kg: 0, reps: slot.max,
      text: e.unit === "bw"
        ? `Erstes Mal. Ziel: ${slot.sets} × ${slot.min}–${slot.max} Wiederholungen.`
        : `Erstes Mal. Wähle ein Gewicht, mit dem du ${slot.max} saubere Wiederholungen schaffst.`};
  }
  const kg = Math.max(...last.sets.map(x => x.kg));
  const top = last.sets.filter(x => x.kg === kg);
  const prev = `Letztes Mal: ${fmtW(e, kg)}, ${last.sets.map(x => x.reps).join(" + ")} Wdh.`;
  const gap = daysSince(last.session.date);
  if (gap > 14) {
    const lighter = roundTo(kg * 0.9, e.step);
    return {kind: "return", kg: lighter, reps: slot.min,
      text: `${prev} Das ist ${gap} Tage her. Starte heute etwas leichter mit ${fmtW(e, lighter)} und finde wieder rein.`};
  }
  if (top.length >= slot.sets && top.every(x => x.reps >= slot.max)) {
    const up = kg + e.step;
    return {kind: "up", kg: up, reps: slot.min,
      text: `${prev} Ziel erreicht. Heute ${fmtW(e, up)} versuchen, Ziel ab ${slot.min} Wdh.`};
  }
  if (kg > 0 && last.sets.every(x => x.reps < slot.min)) {
    const down = roundTo(kg - e.step, e.step);
    return {kind: "down", kg: down, reps: slot.min,
      text: `${prev} Alle Sätze unter ${slot.min} Wdh. Heute leichter: ${fmtW(e, down)}.`};
  }
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
export const loggedFor = (a, i) => a.sets.filter(x => x.q === i);
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
    sets: a.sets.map(({exId, kg, reps, rir}) => ({exId, kg, reps, rir})),
  };
  if (session.sets.length) S.sessions.push(session);
  S.active = null;
  save();
  return session;
}
