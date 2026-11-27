import * as St from "./store.js";
import * as OB from "./onboarding.js";
import {MUSCLES, MUSCLE_NAME, TEMPLATES, EXERCISES, INFO, PATTERN_BY_MUSCLE, GOALS as TGOALS, MEASURES, KIT, KIT_LABEL, KIT_FILTERS, kitMatch, noLoad, isMobility} from "./data.js";
import * as AN from "./anim.js";
import * as BELL from "./bell.js";
import * as N from "./nutrition.js";
import * as I from "./i18n.js";
const tx = I.t, txn = I.tn, L = () => I.locale();

/* ============ Hilfen ============ */
const $ = s => document.querySelector(s);
const view = $("#view"), dlg = $("#dlg"), tabs = $("#tabs"), bar = $("#appbar");
/* Info-Knöpfe (0.9.12): Erklärtexte stehen nicht mehr dauerhaft da, ein Tipp auf ⓘ öffnet sie als Blatt.
   Der Text wird beim Zeichnen unter seinem Titel abgelegt (INFOS) und beim Tippen angezeigt. Titel und Text kommen schon übersetzt an. */
const INFOS = {};
const ICO = `<svg class="iico" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="10" cy="10" r="8.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 9v5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="10" cy="6.1" r="1.15" fill="currentColor"/></svg>`;
const iB = (title, html) => { INFOS[title] = html; return `<button type="button" class="ibtn" data-act="info" data-t="${esc(title)}" aria-haspopup="dialog" aria-label="${esc(tx("Info: {title}", {title}))}">${ICO}</button>`; };
const iL = (title, html) => { INFOS[title] = html; return `<button type="button" class="ilink" data-act="info" data-t="${esc(title)}" aria-haspopup="dialog">${ICO}<span>${esc(title)}</span></button>`; };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
const D = () => St.S;
export const APP_VERSION = "0.11.3";
const ui = {day: null, eday: 0, summary: false, key: "", kg: 0, reps: 8, rir: null, draft: null, draftNew: false, pq: "", pm: "", kit: "", exq: "", histEx: ""};
const fmt = St.fmt;
const scheme = sl => `${sl.sets}×${sl.min}–${sl.max}${St.ex(sl.exId).unit === "s" ? " s" : ""}`;
const schemeSr = sl => `${txn(sl.sets, "{n} Satz", "{n} Sätze")}, ${tx("{a} bis {b}", {a: sl.min, b: sl.max})} ${St.repWord(St.ex(sl.exId))}`;
const dateDe = iso => new Date(iso).toLocaleDateString(L(), {weekday: "short", day: "numeric", month: "numeric"});
// Anzeigename einer Übung. Gespeicherte Namen bleiben unverändert (Übersetzung der Bibliothek folgt in Schritt 5).
// Anzeige-Namen: Gespeichert bleibt immer der deutsche Name. Übersetzt angezeigt wird er nur, solange er genau dem
// Namen aus der Bibliothek entspricht. Wer eine Übung, einen Plan oder Tag umbenennt, sieht immer seinen eigenen Namen.
const LIB_EX = Object.fromEntries(EXERCISES.map(e => [e.id, e.name]));
const LIB_NAMES = new Set(TEMPLATES.flatMap(t => [t.name, ...t.days.map(d => d.name)]));
// Gleiche deutsche Wörter mit anderer Bedeutung bekommen einen eigenen Schlüssel („Beinbeuger“ ist Muskel und Übung)
const EX_KEY = {"Beinbeuger": "Beinbeuger (Übung)"};
const exName = e => { if (e.custom || LIB_EX[e.id] !== e.name) return e.name; const k = EX_KEY[e.name] || e.name, r = tx(k); return r === k ? e.name : r; };
const lib = s => LIB_NAMES.has(s) ? tx(s) : s;
const muscleList = e => [...e.primary.map(m => tx(MUSCLE_NAME[m])), ...e.secondary.map(m => tx(MUSCLE_NAME[m]) + " " + tx("(mit)"))].join(", ");
// Gerät der Übung (nur Bibliothek) und Auswahlfeld für den Gerätefilter. Der Filter gilt für Auswahl und Übungsliste gemeinsam.
const kitOf = e => !e.custom && KIT_LABEL[KIT[e.id]] ? tx(KIT_LABEL[KIT[e.id]]) : "";
const exMeta = e => [muscleList(e), kitOf(e)].filter(Boolean).join(" · ");
const kitSelect = on => `<label class="field">${tx("Gerät")} <select data-on="${on}">${KIT_FILTERS.map(f => `<option value="${f.id}" ${ui.kit === f.id ? "selected" : ""}>${tx(f.l)}</option>`).join("")}</select></label>`;

function say(t) { const a = $("#announcer"); a.textContent = ""; setTimeout(() => a.textContent = t, 60); }

let toastTimer;
function toast(msg, undo) {
  const t = $("#toast");
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? `<button type="button" id="toastUndo">${tx("Rückgängig")}</button>` : ""}`;
  t.hidden = false;
  if (undo) $("#toastUndo").onclick = () => { undo(); hideToast(); say(tx("Rückgängig gemacht.")); };
  clearTimeout(toastTimer);
  const hide = () => { if (t.contains(document.activeElement)) toastTimer = setTimeout(hide, 4000); else hideToast(); };
  // Mit „Rückgängig“ bleibt der Hinweis 30 s (WCAG 2.2.1: genug Zeit), sonst 6 s
  toastTimer = setTimeout(hide, undo ? 30000 : 6000);
}
function hideToast() { $("#toast").hidden = true; }

function persist() { if (!St.save()) toast(tx("Speichern fehlgeschlagen. Ist der Speicher voll?")); }

/* ============ Dialog ============ */
let opener = null;
function openDialog(html, focusSel) {
  if (!dlg.open) opener = document.activeElement;
  dlg.innerHTML = html;
  if (!dlg.open) dlg.showModal();
  const f = focusSel && dlg.querySelector(focusSel);
  (f || dlg.querySelector("h2")).focus();
  AN.startAnim();
}
function closeDialog() { dlg.close(); }
dlg.addEventListener("close", () => { if (opener && document.contains(opener)) opener.focus(); opener = null; });
// Tippen neben das Sheet schließt es
dlg.addEventListener("click", ev => {
  if (ev.target !== dlg) return;
  const r = dlg.getBoundingClientRect();
  if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) closeDialog();
});
// Nach unten wischen schließt das Sheet (wenn es ganz oben ist), wie in iOS. Touch-Ereignisse, weil der Browser
// Pointer-Ereignisse beim Scrollen abbricht.
(() => {
  let y0 = null, dy = 0;
  const start = y => { y0 = y; dy = 0; };
  const move = (y, ev) => {
    if (y0 == null) return;
    dy = y - y0;
    if (dy > 0 && dlg.scrollTop <= 0) { if (ev.cancelable) ev.preventDefault(); dlg.style.transition = "none"; dlg.style.transform = `translateY(${dy}px)`; }
    else if (dy < 0) y0 = null;
  };
  const end = () => {
    if (y0 == null) { dlg.style.transform = ""; return; }
    const close = dy > 90; y0 = null;
    dlg.style.transition = "transform .25s ease"; dlg.style.transform = close ? "translateY(100%)" : "";
    if (close) setTimeout(() => { closeDialog(); dlg.style.transform = ""; dlg.style.transition = ""; }, 200);
  };
  const ok = t => !t.closest("input,select,textarea,video,.plist");
  dlg.addEventListener("touchstart", ev => { if (dlg.scrollTop <= 0 && ok(ev.target)) start(ev.touches[0].clientY); else y0 = null; }, {passive: true});
  dlg.addEventListener("touchmove", ev => move(ev.touches[0].clientY, ev), {passive: false});
  dlg.addEventListener("touchend", end); dlg.addEventListener("touchcancel", end);
})();
function dlgError(msg) { const e = dlg.querySelector(".err"); e.textContent = msg; e.hidden = false; }

/* ============ Einstellungen anwenden ============ */
function applySettings() {
  const s = D().settings, r = document.documentElement;
  r.style.setProperty("--scale", s.scale);
  if (s.scale && s.scale !== 1) r.dataset.scale = ""; else delete r.dataset.scale;
  if (s.theme === "auto") delete r.dataset.theme; else r.dataset.theme = s.theme;
  r.dataset.accent = s.accent || "gruen";
  if (s.contrast) r.dataset.contrast = "high"; else delete r.dataset.contrast;
  const dark = s.theme === "dark" || (s.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]').content = dark ? "#000000" : "#F2F2F7";
  if (body3d) body3d.recolor();
}

/* ============ Router ============ */
const ROUTES = {koerper: viewBody, heute: viewToday, kalender: viewCalendar, plaene: viewPlans, vorlage: viewTemplate, plan: viewEditor, uebungen: viewExercises, verlauf: viewHistory, ernaehrung: viewNutrition, mehr: viewMore, training: viewTraining};
function route() {
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  let name = parts[0] || "heute";
  // Laufendes Training: nur verlassen, wenn es zum Mini-Player verkleinert ist (wie bei Spotify)
  if (D().active && name !== "training" && !ui.mini) { location.replace("#/training"); return; }
  if (name === "training") ui.mini = false; else ui.miniFrom = "#/" + parts.filter(Boolean).join("/");
  if (!D().active && name === "training") { location.replace("#/heute"); return; }
  if (!ROUTES[name]) name = "heute";
  const training = name === "training";
  tabs.hidden = training;
  view.classList.toggle("modal", training);
  tabs.querySelectorAll("a").forEach(a => a.dataset.tab === tabFor(name) ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  placePill(tabFor(name));
  updateWakeLock();
  renderBar(training, name, parts[1]);
  renderMini();
  if (dlg.open) dlg.close();
  if (name !== "koerper") dropBody();
  ROUTES[name](parts[1]);
  AN.startAnim();
  view.scrollTop = 0;
  const h = view.querySelector("h1");
  if (h) { h.tabIndex = -1; h.focus({preventScroll: true}); }
  document.title = (h ? h.textContent.replace(/\s+/g, " ").trim() + " · " : "") + "SATZ";
}
// Heute ist Trainingstag laut Kalender und es gibt heute noch kein Training. Sonst heißt der Tag oben „Als Nächstes“.
const todayIsTraining = () => { const k = dkey(); return St.planFor(k) === "train" && !(St.weekDays().find(x => x.key === k) || {n: 0}).n; };
const tabFor = n => ({kalender: "heute", vorlage: "plaene", plan: "plaene", uebungen: "plaene", koerper: "plaene"})[n] || n;
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
function rerender(focusSel) {
  const top = view.scrollTop;
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  (ROUTES[parts[0]] || viewToday)(parts[1]);
  view.scrollTop = top;
  AN.startAnim();
  if (focusSel) { const f = view.querySelector(focusSel); if (f) f.focus({preventScroll: false}); }
}
const BACK = {kalender: ["#/heute", "Heute"], vorlage: ["#/plaene", "Pläne"], plan: ["#/plaene", "Pläne"], uebungen: ["#/plaene", "Pläne"], koerper: ["#/plaene", "Pläne"]};
function renderBar(training, name, sub) {
  const a = D().active, back = BACK[name] || (name === "mehr" && sub ? ["#/mehr", "Mehr"] : null);
  bar.classList.remove("titled");
  bar.innerHTML = training && a
    ? `<span class="navl"><button class="navbtn minbtn" data-act="mini" aria-label="${tx("Training verkleinern, Timer läuft weiter")}"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M5 9l7 7 7-7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="navbtn" data-act="end">${tx("Beenden")}</button></span><span class="ctx">${esc(lib(a.dayName))}</span>
       <button class="navbtn strong" data-act="overview" aria-haspopup="dialog">${tx("Übersicht")}</button>`
    : back
      ? `<a class="navbtn back" href="${back[0]}"><span aria-hidden="true">‹</span> ${tx(back[1])}<span class="sr"> ${tx("(zurück)")}</span></a><span class="ctx" id="barTitle" aria-hidden="true"></span><span class="navspace" aria-hidden="true"></span>`
      : `<a class="wordmark" href="#/heute" aria-label="${tx("SATZ, zur Startseite")}">SATZ<span aria-hidden="true">.</span></a><span class="ctx" id="barTitle" aria-hidden="true"></span><span class="navspace" aria-hidden="true"></span>`;
}
// Großer Titel klappt beim Scrollen in die Leiste (wie in iOS)
view.addEventListener("scroll", () => {
  const h = view.querySelector("h1.big"), t = $("#barTitle");
  if (!h || !t) return;
  const gone = h.getBoundingClientRect().bottom < bar.getBoundingClientRect().bottom + 4;
  if (gone && !t.textContent) t.textContent = h.textContent.replace(/\s+/g, " ").trim();
  bar.classList.toggle("titled", gone);
}, {passive: true});

/* ============ Bausteine ============ */
function dayBar(p, sel, act, label, add) {
  return `<div class="split" role="group" aria-label="${label}">
    ${p.days.map((d, i) => `<button type="button" aria-pressed="${i === sel}" data-act="${act}" data-i="${i}"><span class="d">${tx("Tag {n}", {n: i + 1})}</span><span class="m">${esc(lib(d.name))}</span></button>`).join("")}
    ${add ? `<button type="button" class="add" data-act="addday" aria-label="${tx("Tag hinzufügen")}"><span class="d" aria-hidden="true">+</span><span class="m">${tx("Tag")}</span></button>` : ""}
  </div>`;
}
const stLabel = {low: "unter 10", ok: "10–20", high: "über 20", "": ""}; // über tx() angezeigt
function volumeTable(v, caption, compare) {
  return `<div class="table-wrap"><table><caption class="sr">${esc(caption)}</caption>
    <thead><tr><th scope="col">${tx("Muskel")}</th>${compare ? `<th scope="col" class="n">${tx("Ist")}</th>` : ""}<th scope="col" class="n">${compare ? tx("Plan") : tx("Sätze/Wo.")}</th><th scope="col">${compare ? tx("Plan-Bereich") : tx("Bereich")}</th></tr></thead>
    <tbody>${MUSCLES.map(m => { const x = compare ? compare[m.id] : v[m.id], st = St.volStatus(m, x); return `<tr><th scope="row" style="font-size:.95rem;letter-spacing:0;text-transform:none;color:inherit">${tx(m.name)}</th>
      ${compare ? `<td class="n">${fmt(Math.round(v[m.id] * 10) / 10)}</td>` : ""}<td class="n">${fmt(Math.round(x * 10) / 10)}</td>
      <td class="st-${st || "none"}">${st ? (st === "ok" ? "✓ " : "! ") + tx(stLabel[st]) : "–"}</td></tr>`; }).join("")}</tbody></table></div>
    ${iL(tx("Wie SATZ Sätze zählt"), tx("Mitarbeitende Muskeln zählen als halber Satz. Für Muskelaufbau gelten etwa 10–20 harte Sätze pro Muskel und Woche als guter Bereich."))}`;
}
function lowMuscles(v) { return MUSCLES.filter(m => St.volStatus(m, v[m.id]) === "low").map(m => tx(m.name)); }
function templateCard(t, compact) {
  return `<article class="card" aria-labelledby="t-${t.id}">
    <h3 id="t-${t.id}">${esc(tx(t.name))}</h3>
    <p class="meta">${goalLabel(t.goal)} · ${tx(t.level)} · ${txn(t.days.length, "{n} Tag", "{n} Tage")} · ${tx("{n}× pro Woche", {n: t.perWeek})}</p>
    ${compact ? "" : `<p>${esc(tx(t.desc))}</p>`}
    <div class="row-btns"><a class="btn small" href="#/vorlage/${t.id}">${tx("Ansehen")}</a>
      <button class="btn small primary" data-act="adopt" data-id="${t.id}">${tx("Übernehmen")}</button></div>
  </article>`;
}
const goalLabel = g => tx((TGOALS.find(x => x.id === g) || TGOALS[0]).l);
// Fertige Pläne mit Filter nach Trainingsziel
function templatesBlock(compact) {
  const g = ui.tgoal || "all", list = TEMPLATES.filter(t => g === "all" || (g === "home" ? t.home : t.goal === g)), gd = TGOALS.find(x => x.id === g);
  return `<div class="seg wrap" role="group" aria-label="${tx("Trainingsziel")}" style="margin-bottom:10px">
      ${[["all", "Alle"], ["home", "Zu Hause"], ...TGOALS.map(x => [x.id, x.l])].map(([v, l]) => `<button type="button" data-act="tgoal" data-v="${v}" aria-pressed="${g === v}">${tx(l)}</button>`).join("")}</div>
    <p class="meta" aria-live="polite">${gd ? esc(tx(gd.d)) + " " : g === "home" ? tx("Pläne mit Kurzhanteln, Band oder ganz ohne Gerät.") + " " : ""}${txn(list.length, "{n} Plan.", "{n} Pläne.")}</p>
    ${list.map(t => templateCard(t, compact)).join("")}`;
}
function bodyCard() {
  return `<a class="card linkcard" href="#/koerper"><span class="lc-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><circle cx="12" cy="4.5" r="2.4" fill="currentColor"/><path d="M12 8v7m0 0-3 6m3-6 3 6M12 9.5 6.5 14M12 9.5l5.5 4.5" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg></span>
    <span><b>${tx("Körperkarte")}</b><small>${tx("Muskel antippen, passende Übungen mit Ablauf sehen und zum Plan hinzufügen.")}</small></span><span class="chev" aria-hidden="true">›</span></a>`;
}
function emptyPlanBtn() { return `<button class="btn" data-act="newplan">${tx("Leeren Plan anlegen")}</button>`; }

/* ============ Einstieg für neue Nutzer ============ */
// Nur ganz neue Daten: kein Plan, kein Training, Einstieg noch nicht erledigt. Wer schon Daten hat, sieht ihn nie.
// Eine Sprachauswahl beim ersten Start (Splash) kommt davor und stört den Ablauf nicht.
const needsOnboarding = () => !D().plans.length && !D().sessions.length && !D().settings.onboarded;
function viewOnboarding() {
  const ob = ui.ob || (ui.ob = {step: 0, a: {}}), Q = OB.QUESTIONS;
  if (ob.step < Q.length) {
    const q = Q[ob.step], cur = ob.a[q.id];
    view.innerHTML = `${ob.step === 0 ? `<p class="eyebrow">${tx("Willkommen bei SATZ")}</p>` : ""}
      <p class="meta" aria-hidden="true">${tx("Frage {n} von {m}", {n: ob.step + 1, m: Q.length})}</p>
      <div class="obbar" aria-hidden="true"><span style="width:${(ob.step / Q.length) * 100}%"></span></div>
      <h1 class="big" tabindex="-1"><span class="sr">${tx("Frage {n} von {m}", {n: ob.step + 1, m: Q.length})}: </span>${esc(tx(q.q))}</h1>
      ${ob.step === 0 ? `<p>${tx("Fünf kurze Fragen, dann schlägt SATZ dir einen passenden Plan vor. Du kannst danach alles ändern.")}</p>` : ""}
      <ul class="plist oblist" style="max-height:none">${q.opts.map(([v, l, d]) => `<li><button type="button" data-act="obpick" data-v="${v}" aria-pressed="${String(cur) === String(v)}"><b>${esc(tx(l))}</b>${d ? `<small>${esc(tx(d))}</small>` : ""}</button></li>`).join("")}</ul>
      <div class="row-btns" style="margin-top:12px">${ob.step ? `<button type="button" class="btn small" data-act="obback">${tx("Zurück")}</button>` : ""}<button type="button" class="btn small" data-act="obskip">${tx("Überspringen und selbst wählen")}</button></div>
      <div style="height:24px"></div>`;
    return;
  }
  const r = OB.recommend(ob.a), plan = St.instantiate(r.tpl);
  plan.perWeek = r.perWeek;
  const fit = OB.fitToTime(plan, ob.a.mins, St.restFor, sl => St.ex(sl.exId).unit === "s");
  ob.plan = plan;
  view.innerHTML = `<p class="eyebrow">${tx("Dein Vorschlag")}</p>
    <h1 class="big" tabindex="-1">${esc(lib(plan.name))}</h1>
    <p>${esc(tx(r.why))}</p>
    <p class="meta">${tx("{n}× pro Woche", {n: plan.perWeek})} · ${txn(plan.days.length, "{n} Trainingstag", "{n} Trainingstage im Wechsel")} · ${tx("ca. {n} Min. pro Training", {n: fit.minutes})}</p>
    ${fit.cut ? `<p class="note">${tx("Damit es in deine Zeit passt, hat SATZ einige Übungen auf 2 Sätze gekürzt. Mit mehr Zeit kannst du sie im Plan wieder erhöhen.")}</p>`
      : fit.minutes > ob.a.mins * 1.1 ? `<p class="note">${tx("Der Plan dauert etwas länger als deine Zeit. Lass im Plan eine Übung weg oder nimm weniger Sätze.")}</p>` : ""}
    ${plan.days.map(d => `<h2 class="sec">${esc(lib(d.name))}</h2><ol class="exlist">${d.slots.map(sl => `<li><span class="t">${esc(exName(St.ex(sl.exId)))}</span><span class="s"><span aria-hidden="true">${scheme(sl)}</span><span class="sr">${schemeSr(sl)}</span></span></li>`).join("")}</ol>`).join("")}
    <div class="actionbar"><button class="btn primary" data-act="obadopt">${tx("Plan übernehmen")}</button></div>
    <div class="row-btns" style="margin-top:12px"><button type="button" class="btn small" data-act="obrestart">${tx("Antworten ändern")}</button><button type="button" class="btn small" data-act="obskip">${tx("Andere Pläne ansehen")}</button></div>
    <div style="height:24px"></div>`;
}

/* ============ Heute ============ */
// Wochenkalender mit Wochenziel. Bewusst ohne Tagesserie und ohne Schuldgefühle: Pausenwochen halten die Serie an.
const WD = () => ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(d => tx(d)), WDL = () => ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"].map(d => tx(d));
const trainings = n => txn(n, "{n} Training", "{n} Trainings");
// Jeder Tag hat einen Zustand mit Farbe UND Symbol (nie Farbe allein):
// erledigt ✓ (gefüllt), Training geplant ● (Ring), Ruhetag ☾ (eigene Farbe), Pausenwoche ‖ (gestreift), vorbei ohne Training: leer.
const DAYSYM = {done: "✓", plan: "●", rest: "☾", pause: "‖", past: ""};
const DAYSR = {done: "", plan: "Training geplant", rest: "Ruhetag", pause: "Pause", past: "geplant, kein Training"};   // über tx() angezeigt
// Zustand eines Tages aus Kalender (Tagesplan mit Abweichungen) und erledigten Trainings
function dayState(d, todayKey) {
  if (d.n) return "done";
  const p = St.planFor(d.key);
  if (p === "pause") return "pause";
  if (p === "rest") return "rest";
  return d.key < todayKey ? "past" : "plan";
}
function weekCard() {
  const wk = St.weekStart(), days = St.weekDays(wk), goal = St.weekGoalFor(wk), n = days.reduce((a, d) => a + d.n, 0);
  const paused = goal === 0, st = St.weekStreak(), todayKey = dkey(), less = St.weekGoal() - goal;
  const streak = st.weeks > 0 ? (st.paused ? txn(st.weeks, "Eine Woche in Folge geschafft, {p} dazwischen.", "{n} Wochen in Folge geschafft, {p} dazwischen.", {p: txn(st.paused, "eine Pausenwoche", "{n} Pausenwochen")})
    : txn(st.weeks, "Eine Woche in Folge geschafft.", "{n} Wochen in Folge geschafft.")) : "";
  const ti = days.findIndex(d => d.key === todayKey), todayState = ti >= 0 ? dayState(days[ti], todayKey) : "";
  const msg = paused ? `${tx("Pausenwoche (Urlaub oder krank).")} ${n ? tx("Deine Trainings zählen trotzdem.") : tx("Deine Serie wartet einfach, bis du wieder trainierst.")}`
    : n >= goal ? `${tx("Wochenziel erreicht.")} ${streak}`
    : `${todayState === "rest" ? tx("Heute ist Ruhetag.") + " " : todayState === "pause" ? tx("Heute ist Pause.") + " " : ""}${less > 0 ? txn(goal - n, "Noch {n} Training bis zum Wochenziel (wegen Pausentagen {less} weniger).", "Noch {n} Trainings bis zum Wochenziel (wegen Pausentagen {less} weniger).", {less}) : txn(goal - n, "Noch {n} Training bis zum Wochenziel.", "Noch {n} Trainings bis zum Wochenziel.")} ${streak}`;
  const states = days.map(d => dayState(d, todayKey));
  return `<section class="card weekcard" aria-labelledby="wk-h">
    <div class="wkhead"><h2 id="wk-h">${tx("Diese Woche")} ${iB(tx("Die Wochenleiste"), `<ul class="wklegend big">${["done", "plan", "rest", "pause"].map(k => `<li class="d-${k}"><span class="dot" aria-hidden="true">${DAYSYM[k]}</span>${tx({done: "erledigt", plan: "Training geplant", rest: "Ruhetag", pause: "Pause (Urlaub, krank): senkt das Wochenziel, die Serie bleibt"}[k])}</li>`).join("")}</ul><p>${tx("Tage änderst du im Kalender.")}</p>`)}</h2>${paused ? `<span class="num">${tx("Pause")}</span>` : `<span class="num" aria-label="${tx("{n} von {m} Trainings", {n, m: goal})}">${n} / ${goal}</span>`}</div>
    <ol class="wkdays">${days.map((d, i) => { const k = states[i];
      return `<li class="d-${k}${d.key === todayKey ? " today" : ""}"><span aria-hidden="true">${WD()[i]}</span><span class="dot" aria-hidden="true">${k === "done" && d.n > 1 ? d.n : DAYSYM[k]}</span>
      <span class="sr">${WDL()[i]}${d.key === todayKey ? " " + tx("(heute)") : ""}: ${d.n ? txn(d.n, "{n} Training erledigt", "{n} Trainings erledigt") : tx(DAYSR[k])}${St.dayOverride(d.key) ? ", " + tx("geändert") : ""}</span></li>`; }).join("")}</ol>
    <p class="meta wkmsg">${esc(msg.trim())}</p>
    <div class="wkbtns"><a class="linkbtn" href="#/kalender">${tx("Kalender, Ruhetage, Pausen")} <span aria-hidden="true">›</span></a>
    ${St.isPaused(wk) ? `<button type="button" class="linkbtn" data-act="pauseweek">${tx("Pause aufheben")}</button>` : ""}</div>
  </section>`;
}
// Trainings- und Ruhetage festlegen. Gilt jede Woche, bis du es änderst.
function openPlanWeek() {
  const planned = St.trainDays(), goal = St.weekGoal();
  openDialog(`<h2 id="dlg-h">${tx("Woche planen")}</h2>
    <p class="meta" style="text-align:center;margin-top:-10px">${tx("Tippe auf einen Tag, um zwischen Training und Ruhetag zu wechseln. Gilt jede Woche.")}</p>
    <ul class="plist planweek" style="max-height:none">${WDL().map((w, i) => { const on = planned.includes(i);
      return `<li><button type="button" data-act="pwday" data-d="${i}" aria-pressed="${on}"><b>${w}</b><span class="pwstate d-${on ? "plan" : "rest"}"><span class="dot" aria-hidden="true">${on ? DAYSYM.plan : DAYSYM.rest}</span>${on ? tx("Training") : tx("Ruhetag")}</span></button></li>`; }).join("")}</ul>
    <p class="meta" id="pw-note" aria-live="polite">${pwNote(planned, goal)}</p>
    <div class="dlg-actions"><button class="btn" data-act="close">${tx("Fertig")}</button></div>`, "#dlg-h");
}
const pwNote = (planned, goal) => `${txn(planned.length, "{n} Trainingstag", "{n} Trainingstage")}, ${txn(7 - planned.length, "{n} Ruhetag.", "{n} Ruhetage.")} ${planned.length === goal ? tx("Passt zu deinem Wochenziel.")
  : planned.length < goal ? txn(goal, "Dein Plan sieht {n} Training pro Woche vor, plane also mehr Tage ein oder senke das Ziel im Plan.", "Dein Plan sieht {n} Trainings pro Woche vor, plane also mehr Tage ein oder senke das Ziel im Plan.")
  : txn(goal, "Dein Plan sieht {n} Training pro Woche vor.", "Dein Plan sieht {n} Trainings pro Woche vor.")}`;
/* ============ Kalender ============
   Monatsansicht. Jeder Tag folgt dem Wochenmuster, außer du änderst ihn hier (Training, Ruhetag, Pause).
   Gespeichert werden nur die Abweichungen (S.dayPlan); trainierte Tage bleiben unverändert. */
const CALNAME = {train: "Training", rest: "Ruhetag", pause: "Pause"}; // über tx() angezeigt
function viewCalendar() {
  const now = new Date(), off = ui.cOff || 0, first = new Date(now.getFullYear(), now.getMonth() + off, 1);
  const y = first.getFullYear(), m = first.getMonth(), len = new Date(y, m + 1, 0).getDate(), lead = (first.getDay() + 6) % 7;
  const todayKey = dkey(), byDay = {};
  D().sessions.forEach(x => { const k = St.sessionDay(x); byDay[k] = (byDay[k] || 0) + 1; });
  const name = first.toLocaleDateString(L(), {month: "long", year: "numeric"});
  const cells = Array.from({length: len}, (_, i) => {
    const key = St.dateKey(new Date(y, m, i + 1, 12)), d = {key, n: byDay[key] || 0}, k = dayState(d, todayKey), ov = St.dayOverride(key);
    const long = new Date(key + "T12:00:00").toLocaleDateString(L(), {weekday: "long", day: "numeric", month: "long"});
    return `<li class="d-${k}${key === todayKey ? " today" : ""}${ov ? " ovr" : ""}"${i === 0 ? ` style="grid-column-start:${lead + 1}"` : ""}>
      <button type="button" data-act="calday" data-k="${key}" aria-haspopup="dialog" aria-label="${long}${key === todayKey ? ", " + tx("heute") : ""}: ${d.n ? txn(d.n, "{n} Training erledigt", "{n} Trainings erledigt") : tx(DAYSR[k] || "kein Training")}${ov ? ", " + tx("geändert") : ""}">
      <span class="cnum">${i + 1}</span><span class="dot" aria-hidden="true">${k === "done" && d.n > 1 ? d.n : DAYSYM[k]}</span></button></li>`;
  }).join("");
  const wk = St.weekStart(), goal = St.weekGoalFor(wk);
  view.innerHTML = `<h1 class="big">${tx("Kalender")}</h1>
    ${iL(tx("So änderst du einzelne Tage"), tx("Tippe auf einen Tag, um ihn zu ändern oder ein Training zu verschieben. Das Wochenmuster bleibt dabei gleich."))}
    <section class="card calcard" aria-labelledby="cal-h">
      <div class="wkhead"><h2 id="cal-h">${esc(name)}</h2>
        <span class="mnav"><button type="button" class="linkbtn" data-act="cprev" aria-label="${tx("Vorheriger Monat")}">‹</button><button type="button" class="linkbtn" data-act="cnext" aria-label="${tx("Nächster Monat")}">›</button></span></div>
      <ol class="calhead" aria-hidden="true">${WD().map(w => `<li>${w}</li>`).join("")}</ol>
      <ol class="calgrid">${cells}</ol>
      <ul class="wklegend" aria-hidden="true">${["done", "plan", "rest", "pause"].map(k => `<li class="d-${k}"><span class="dot">${DAYSYM[k]}</span>${tx({done: "erledigt", plan: "geplant", rest: "Ruhetag", pause: "Pause"}[k])}</li>`).join("")}<li class="ovr"><span class="ovmark"></span>${tx("geändert")}</li></ul>
      <p class="meta">${goal ? txn(goal, "Diese Woche: Ziel {n} Training.", "Diese Woche: Ziel {n} Trainings.") : tx("Diese Woche: Pausenwoche.")} ${off ? `<button type="button" class="linkbtn" data-act="ctoday">${tx("Zum heutigen Monat")}</button>` : ""}</p>
    </section>
    <div class="row-btns"><button type="button" class="btn" data-act="calrange" aria-haspopup="dialog">${tx("Zeitraum pausieren (Urlaub, krank)")}</button>
    <button type="button" class="btn" data-act="planweek" aria-haspopup="dialog">${tx("Wochenmuster planen")}</button></div>
    <div style="height:24px"></div>`;
}
function openCalDay(key) {
  const todayKey = dkey(), n = D().sessions.filter(x => St.sessionDay(x) === key).length, cur = St.planFor(key), ov = St.dayOverride(key);
  const weekPaused = St.isPaused(St.weekStart(new Date(key + "T12:00:00")));
  const long = new Date(key + "T12:00:00").toLocaleDateString(L(), {weekday: "long", day: "numeric", month: "long"});
  const wk = St.weekStart(new Date(key + "T12:00:00"));
  const targets = Array.from({length: 7}, (_, i) => St.keyAdd(wk, i)).filter(k => k !== key && k >= todayKey && St.planFor(k) !== "train" && St.planFor(k) !== "pause");
  const opt = v => `<li><button type="button" data-act="calset" data-k="${key}" data-v="${v}" aria-pressed="${cur === v}"><b>${tx(CALNAME[v])}</b><span class="pwstate d-${v === "train" ? "plan" : v}"><span class="dot" aria-hidden="true">${DAYSYM[v === "train" ? "plan" : v]}</span>${cur === v ? tx("ausgewählt") : ""}</span></button></li>`;
  openDialog(`<h2 id="dlg-h">${esc(long)}</h2>
    <p class="meta" style="text-align:center;margin-top:-10px">${n ? txn(n, "{n} Training erledigt.", "{n} Trainings erledigt.") + " " : ""}${weekPaused ? tx("Die ganze Woche ist pausiert.") : ov ? tx("Geändert. Laut Wochenmuster: {x}.", {x: tx(CALNAME[St.patternFor(key)])}) : tx("Folgt dem Wochenmuster.")}</p>
    ${weekPaused ? "" : `<ul class="plist planweek" style="max-height:none">${["train", "rest", "pause"].map(opt).join("")}</ul>
    ${ov ? `<button type="button" class="linkbtn" data-act="calset" data-k="${key}" data-v="">${tx("Wie im Wochenmuster")}</button>` : ""}
    ${cur === "train" && !n && key >= todayKey ? `<h3 class="sec">${tx("Training verschieben")}</h3>
      ${targets.length ? `<p class="meta">${tx("Nur für diese Woche. Der Tag wird zum Ruhetag.")}</p><div class="row-btns">${targets.map(k => `<button type="button" class="btn small" data-act="calmove" data-from="${key}" data-to="${k}">${new Date(k + "T12:00:00").toLocaleDateString(L(), {weekday: "short", day: "numeric", month: "numeric"})}</button>`).join("")}</div>`
        : `<p class="meta">${tx("In dieser Woche ist kein freier Tag mehr übrig.")}</p>`}` : ""}`}
    <div class="dlg-actions"><button class="btn" data-act="close">${tx("Fertig")}</button></div>`, "#dlg-h");
}
function openCalRange() {
  const t = dkey();
  openDialog(`<h2 id="dlg-h">${tx("Zeitraum pausieren")}</h2>
    <p class="meta" style="text-align:center;margin-top:-10px">${tx("Urlaub oder krank: Pausentage senken dein Wochenziel, deine Serie bleibt erhalten.")}</p>
    <label class="field">${tx("Von")} <input type="date" id="cr-from" value="${t}"></label>
    <label class="field">${tx("Bis")} <input type="date" id="cr-to" value="${St.keyAdd(t, 6)}"></label>
    <p class="meta" id="cr-note" aria-live="polite">${tx("Höchstens 3 Monate am Stück.")}</p>
    <div class="dlg-actions"><button class="btn" data-act="crclear">${tx("Pause aufheben")}</button><button class="btn primary" data-act="crset">${tx("Pausieren")}</button></div>`, "#dlg-h");
}
function calRangeApply(on) {
  const f = $("#cr-from").value, t = $("#cr-to").value, re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(f) || !re.test(t)) { $("#cr-note").textContent = tx("Bitte zwei Daten wählen."); return; }
  St.pauseRange(f, t, on); dlg.close(); rerender();
  say(on ? tx("Zeitraum ist als Pause markiert.") : tx("Pause im Zeitraum aufgehoben."));
}
function viewToday() {
  const p = St.activePlan();
  if (!p && needsOnboarding()) return viewOnboarding();
  if (!p) {
    view.innerHTML = `<h1 class="big">${tx("Willkommen bei SATZ.")}</h1>
      <p>${tx("SATZ ist dein Trainingsheft: Plan wählen, Satz für Satz eintragen, und die App sagt dir, wann du steigern kannst.")}</p>
      <p>${tx("Wähle einen Plan als Startpunkt. Du kannst später alles ändern, Übungen tauschen und eigene anlegen.")}</p>
      <h2 class="sec">${tx("Fertige Pläne")}</h2>
      ${templatesBlock(false)}
      ${emptyPlanBtn()}<div style="height:24px"></div>`;
    return;
  }
  if (!p.days.length) {
    view.innerHTML = `<p class="eyebrow">${tx("Plan: {name}", {name: esc(lib(p.name))})}</p><h1 class="big">${tx("Noch leer")}</h1><p>${tx("Leg den ersten Trainingstag an.")}</p>
      <a class="btn primary" href="#/plan/${p.id}">${tx("Plan bearbeiten")}</a>`;
    return;
  }
  const di = ui.day != null && ui.day < p.days.length ? ui.day : St.nextDayIndex(p);
  const dlw = St.deloadNow(p), dsl = sl => dlw ? {...sl, sets: St.deloadSets(sl.sets)} : sl;
  const d = p.days[di], sets = d.slots.reduce((a, s) => a + dsl(s).sets, 0);
  const mins = Math.round(d.slots.reduce((a, s) => a + dsl(s).sets * (St.restFor(s) + 45), 0) / 60);
  const last = St.lastSession(), gap = last ? St.daysSince(last.date) : null;
  view.innerHTML = `
    <p class="eyebrow planname">${esc(lib(p.name))}</p>
    <h1 class="big">${di === St.nextDayIndex(p) ? (todayIsTraining() ? tx("Heute:") : tx("Als Nächstes:")) + "<br>" : ""}${esc(lib(d.name))}</h1>
    ${gap != null && gap > 14 ? `<p class="note">${tx("Willkommen zurück. Dein letztes Training ist {n} Tage her. Die Vorschläge starten heute etwas leichter.", {n: gap})}</p>` : ""}
    ${weekCard()}
    ${cycleNote(p)}
    ${backupDue() ? `<div class="bkline"><span>${D().settings.lastBackup ? txn(St.daysSince(D().settings.lastBackup), "Letzte Sicherung vor {n} Tag.", "Letzte Sicherung vor {n} Tagen.") : tx("Noch keine Sicherung.")} ${iB(tx("Warum sichern?"), tx("Deine Trainings liegen nur auf diesem Gerät. Eine Sicherungsdatei schützt sie bei Verlust oder Handywechsel. Speichere sie zum Beispiel in iCloud Drive."))}</span>
      <button class="btn small primary" data-act="export">${tx("Sichern")}</button><button class="btn small" data-act="snoozebackup" aria-label="${tx("Später erinnern")}">${tx("Später")}</button></div>` : ""}
    ${p.days.length > 1 ? dayBar(p, di, "pickday", tx("Trainingstag wählen")) : ""}
    <p class="meta">${txn(d.slots.length, "{n} Übung", "{n} Übungen")} · ${txn(sets, "{n} Satz", "{n} Sätze")} · ${tx("ca. {n} Min.", {n: mins})}</p>
    <ol class="exlist" aria-label="${tx("Übungen")}">
      ${d.slots.map(sl => { const e = St.ex(sl.exId), l = St.lastSetsFor(sl.exId);
        return `<li><span class="t">${esc(exName(e))}</span><span class="s"><span aria-hidden="true">${scheme(dsl(sl))}</span><span class="sr">${schemeSr(dsl(sl))}</span></span>
        ${l ? `<span class="l">${tx("Zuletzt:")} ${noLoad(e) ? "" : St.fmtW(e, Math.max(...l.sets.map(x => x.kg))) + ", "}${l.sets.map(x => x.reps).join(" + ")} ${St.repShort(e)}</span>` : ""}</li>`; }).join("")}
    </ol>
    ${d.slots.length ? `<div class="actionbar"><button class="btn primary" data-act="start" data-i="${di}">${D().active ? tx("Training fortsetzen") : tx("Training starten")}</button></div>`
      : `<p class="meta">${tx("Dieser Tag hat noch keine Übungen.")}</p><a class="btn" href="#/plan/${p.id}">${tx("Plan bearbeiten")}</a>`}`;
}

// Entlastungsrhythmus: Woche x von n, wann die nächste Phase beginnt
const inDaysLabel = n => { const d = new Date(Date.now() + n * 864e5); return n <= 1 ? tx("morgen") : d.toLocaleDateString(L(), {weekday: "long", day: "numeric", month: "numeric"}).replace(",", "").replace(/\.$/, ""); };
function cycleNote(p) {
  const c = St.cycleWeek(p); if (!c) return "";
  const dots = `<span class="cyc" aria-hidden="true">${Array.from({length: c.weeks}, (_, k) => `<i class="${k === c.weeks - 1 ? "dl" : ""}${k === c.week - 1 ? " on" : ""}"></i>`).join("")}</span>`;
  if (c.deload) return `<div class="note cycnote">${dots}<b>${tx("Entlastungswoche.")}</b> ${tx("Halbe Satzzahl, etwa 90 % Gewicht, 3 oder mehr Wdh. in Reserve. So erholst du dich, bevor es wieder bergauf geht. Aufbau ab {d}.", {d: esc(inDaysLabel(c.inDays))})}</div>`;
  const next = c.inDays + (c.weeks - 1 - c.week) * 7;
  return `<p class="meta cycline">${dots}${tx("Woche {n} von {m}: Aufbau. Entlastung ab {d}.", {n: c.week, m: c.weeks, d: esc(inDaysLabel(next))})}</p>`;
}
function cycleEditor(p) {
  const c = St.cycleWeek(p), w = p.cycle ? p.cycle.weeks : 0;
  return `<h2 class="sec">${tx("Rhythmus")}</h2>
    <label class="field">${tx("Entlastungswoche")} <select data-on="cycleweeks">
      ${St.CYCLES.map(n => `<option value="${n}" ${n === w ? "selected" : ""}>${n ? tx("Alle {n} Wochen ({m} Aufbau + 1 Entlastung)", {n, m: n - 1}) : tx("Aus")}</option>`).join("")}</select></label>
    ${c ? `<p class="meta">${c.deload ? tx("Gerade: Woche {n} von {m}, Entlastung.", {n: c.week, m: c.weeks}) : tx("Gerade: Woche {n} von {m}, Aufbau.", {n: c.week, m: c.weeks})}</p>
    <div class="row-btns">${c.deload ? `<button class="btn small" data-act="cyclerestart">${tx("Entlastung beenden, Aufbau starten")}</button>` : `<button class="btn small" data-act="deloadnow">${tx("Diese Woche entlasten")}</button><button class="btn small" data-act="cyclerestart">${tx("Mit Woche 1 neu beginnen")}</button>`}</div>` : ""}
    ${iL(tx("Was die Entlastungswoche macht"), tx("In der Entlastungswoche halbiert SATZ die Sätze und schlägt etwa 90 % des Gewichts vor. Danach geht es vom Stand davor weiter. Entlastungen alle 4–8 Wochen sind in der Praxis üblich, vor allem mit weniger Volumen (Bell et al. 2023, Expertenkonsens). Fühlst du dich früher platt, entlaste früher."))}`;
}

/* ============ Pläne ============ */
function viewPlans() {
  const s = D(), customN = Object.values(s.exercises).filter(e => e.custom).length;
  view.innerHTML = `<h1 class="big">${tx("Pläne")}</h1>
    ${bodyCard()}
    ${s.plans.length ? s.plans.map(p => `<article class="card" aria-labelledby="p-${p.id}">
      <h3 id="p-${p.id}">${esc(lib(p.name))}${p.id === s.activePlanId ? `<span class="badge">${tx("aktiv")}</span>` : ""}</h3>
      <p class="meta">${p.goal ? goalLabel(p.goal) + " · " : ""}${txn(p.days.length, "{n} Tag", "{n} Tage")} · ${tx("{n}× pro Woche", {n: p.perWeek})}${(c => c ? ` · ${tx("Woche {n}/{m}", {n: c.week, m: c.weeks})}${c.deload ? " " + tx("Entlastung") : ""}` : "")(St.cycleWeek(p))}</p>
      <div class="row-btns">
        ${p.id !== s.activePlanId ? `<button class="btn small primary" data-act="activate" data-id="${p.id}">${tx("Aktivieren")}</button>` : ""}
        <a class="btn small" href="#/plan/${p.id}" aria-label="${tx("{name} bearbeiten", {name: esc(lib(p.name))})}">${tx("Bearbeiten")}</a>
        <button class="btn small" data-act="copyplan" data-id="${p.id}" aria-label="${tx("{name} kopieren", {name: esc(lib(p.name))})}">${tx("Kopieren")}</button>
        <button class="btn small destructive" data-act="delplan" data-id="${p.id}" aria-label="${tx("{name} löschen", {name: esc(lib(p.name))})}">${tx("Löschen")}</button>
      </div></article>`).join("") : `<p>${tx("Noch kein eigener Plan.")}</p>`}
    ${emptyPlanBtn()}
    <h2 class="sec">${tx("Fertige Pläne")} ${iB(tx("Fertige Pläne"), tx("Nach Trainingswissenschaft zusammengestellt. Übernehmen erstellt eine Kopie, die du frei ändern kannst."))}</h2>
    ${templatesBlock(true)}
    <h2 class="sec">${tx("Übungen")}</h2>
    <p class="meta">${tx("{n} Übungen, davon {m} eigene.", {n: Object.keys(s.exercises).length, m: customN})}</p>
    <a class="btn" href="#/uebungen">${tx("Übungen verwalten")}</a><div style="height:24px"></div>`;
}

function viewTemplate(id) {
  const t = TEMPLATES.find(x => x.id === id);
  if (!t) return go("#/plaene");
  const p = St.instantiate(t);
  view.innerHTML = `<p class="eyebrow">${tx("Fertiger Plan")} · ${goalLabel(t.goal)} · ${tx(t.level)}</p><h1 class="big">${esc(tx(t.name))}</h1>
    <p>${esc(tx(t.desc))}</p><p class="meta">${txn(t.days.length, "{n} Tag", "{n} Tage")} · ${tx("{n}× pro Woche", {n: t.perWeek})}</p>
    ${t.days.map((d, i) => `<h2 class="sec">${tx("Tag {n}", {n: i + 1})}: ${esc(lib(d.name))}</h2><ol class="exlist">
      ${p.days[i].slots.map(sl => `<li><span class="t">${esc(exName(St.ex(sl.exId)))}</span><span class="s"><span aria-hidden="true">${scheme(sl)}</span><span class="sr">${schemeSr(sl)}</span></span></li>`).join("")}</ol>`).join("")}
    <h2 class="sec">${tx("Wochenvolumen")}</h2>${volumeTable(St.planVolume(p), tx("Sätze pro Muskel und Woche"))}
    <div class="actionbar"><button class="btn primary" data-act="adopt" data-id="${t.id}">${tx("Plan übernehmen")}</button></div>`;
}

/* ============ Editor ============ */
function viewEditor(id) {
  const p = St.plan(id);
  if (!p) return go("#/plaene");
  ui.eday = Math.min(ui.eday, Math.max(0, p.days.length - 1));
  const d = p.days[ui.eday], v = St.planVolume(p), low = lowMuscles(v);
  view.innerHTML = `<p class="eyebrow">${tx("Plan bearbeiten")}</p><h1 class="big">${esc(lib(p.name))}</h1>
    <label class="field">${tx("Name des Plans")} <input data-on="pname" value="${esc(p.name)}" autocomplete="off"></label>
    <div class="field" role="group" aria-labelledby="pw-l"><span id="pw-l">${tx("Trainings pro Woche")}</span>
      <div class="stepper sm" style="margin-top:6px">
        <button data-act="perweek" data-d="-1" aria-label="${tx("Ein Training weniger pro Woche")}">−</button>
        <output aria-live="polite"><span class="v num">${p.perWeek}</span><span class="u">${tx("pro Woche")}</span></output>
        <button data-act="perweek" data-d="1" aria-label="${tx("Ein Training mehr pro Woche")}">+</button></div></div>
    ${dayBar(p, ui.eday, "eday", tx("Tag zum Bearbeiten wählen"), true)}
    ${d ? `<label class="field">${tx("Name von Tag {n}", {n: ui.eday + 1})} <input data-on="dname" value="${esc(d.name)}" autocomplete="off"></label>
    <h2 class="sec" id="exh" style="margin-top:8px">${tx("Übungen an Tag {n}", {n: ui.eday + 1})}</h2>
    ${d.slots.length ? "" : `<p class="meta">${tx("Noch keine Übungen.")}</p>`}
    <ol class="edlist" aria-labelledby="exh">
      ${d.slots.map((sl, i) => { const e = St.ex(sl.exId); return `<li>
        <div class="edrow"><span class="t">${esc(exName(e))}${e.custom ? `<span class="badge">${tx("eigene")}</span>` : ""}</span>
          <button class="chip" data-act="slot" data-i="${i}" aria-label="${esc(exName(e))}: ${schemeSr(sl)}. ${tx("Ändern")}">${scheme(sl)}</button></div>
        <div class="edtools">
          <button data-act="mv" data-i="${i}" data-d="-1" ${i === 0 ? "disabled" : ""} aria-label="${tx("{name} nach oben", {name: esc(exName(e))})}">↑</button>
          <button data-act="mv" data-i="${i}" data-d="1" ${i === d.slots.length - 1 ? "disabled" : ""} aria-label="${tx("{name} nach unten", {name: esc(exName(e))})}">↓</button>
          <button data-act="swapslot" data-i="${i}" aria-label="${tx("Übung {name} tauschen", {name: esc(exName(e))})}">${tx("Tauschen")}</button>
          <button class="push" data-act="delslot" data-i="${i}" aria-label="${tx("{name} entfernen", {name: esc(exName(e))})}">${tx("Entfernen")}</button>
        </div></li>`; }).join("")}
    </ol>
    <button class="btn" data-act="addslot" id="addslot">+ ${tx("Übung hinzufügen")}</button>
    ${p.days.length > 1 ? `<button class="btn destructive" data-act="delday">${tx("Tag {n} löschen", {n: ui.eday + 1})}</button>` : ""}` : `<p>${tx("Dieser Plan hat noch keine Tage.")}</p>`}
    ${cycleEditor(p)}
    <h2 class="sec">${tx("Wochenvolumen")}</h2>
    <p>${low.length ? tx("Unter 10 Sätzen pro Woche: {list}. Mehr Sätze, mehr Trainings pro Woche oder eine zusätzliche Übung heben das an.", {list: `<b>${low.join(", ")}</b>`}) : tx("Alle großen Muskelgruppen liegen bei mindestens 10 Sätzen pro Woche.")}</p>
    <details><summary>${tx("Tabelle: Sätze pro Muskel und Woche")}</summary>${volumeTable(v, tx("Sätze pro Muskel und Woche"))}</details>
    <div class="actionbar"><a class="btn primary" href="#/plaene">${tx("Fertig")}</a></div>`;
}
const curPlan = () => St.plan(location.hash.split("/")[2]);

/* ---------- Slot-Dialog ---------- */
// Halteübungen bis 100 s (so groß darf ein gespeicherter Satz sein), sonst bis 50 Wdh.
const maxReps = e => e.unit === "s" ? 100 : 50;
// Satzschema, wenn eine Übung neu in den Plan kommt: Halten und Mobility in Sekunden, sonst 3 × 8–12
const slotDefault = e => isMobility(e) ? {sets: 2, min: 30, max: 45, rest: 15} : e.unit === "s" ? {sets: 3, min: 20, max: 45, rest: 60} : {sets: 3, min: 8, max: 12, rest: 0};
// Satzschema nach einem Tausch: Sätze, Wdh. und Pause bleiben, solange beide Übungen gleich gezählt werden.
// Wechselt die Einheit (Wdh. ↔ Sekunden) oder Kraft ↔ Mobility, passt das Schema nicht mehr: dann das Standardschema der neuen Übung.
const sameScheme = (from, to) => (to.unit === "s") === (from.unit === "s") && isMobility(to) === isMobility(from);
const swapScheme = (sl, from, to) => sameScheme(from, to) ? {sets: sl.sets, min: sl.min, max: sl.max, rest: sl.rest} : slotDefault(to);
function openSlot() {
  const sl = ui.draft, e = St.ex(sl.exId);
  openDialog(`<h2 id="dlg-h">${ui.draftNew ? tx("Übung hinzufügen") : tx("Übung im Plan")}</h2>
    <p class="err" role="alert" hidden></p>
    <div class="field"><span id="exsel-l">${tx("Übung")}</span>
      <div class="exsel"><span>${esc(exName(e))}</span><button class="btn small" data-act="swap" aria-label="${tx("Übung {name} tauschen", {name: esc(exName(e))})}">${tx("Tauschen")}</button></div>
      <small>${tx("Tauschen behält den Verlauf beider Übungen getrennt.")}</small></div>
    <div class="pair">
      <label class="field">${tx("Sätze")} <input id="f-sets" type="number" inputmode="numeric" min="1" max="10" value="${sl.sets}"></label>
      <label class="field">${tx("Pause")} <select id="f-rest">
        ${[...new Set([0, 15, 30, 45, 60, 90, 120, 150, 180, 240, sl.rest || 0])].sort((a, b) => a - b).map(r => `<option value="${r}" ${sl.rest === r ? "selected" : ""}>${r ? r + " s" : tx("Standard")}</option>`).join("")}
      </select></label></div>
    <fieldset><legend>${St.repWord(e)}</legend><div class="pair">
      <label class="field">${tx("von")} <input id="f-min" type="number" inputmode="numeric" min="1" max="${maxReps(e)}" value="${sl.min}"></label>
      <label class="field">${tx("bis")} <input id="f-max" type="number" inputmode="numeric" min="1" max="${maxReps(e)}" value="${sl.max}"></label></div></fieldset>
    <div class="dlg-actions"><button class="btn" data-act="close">${tx("Abbrechen")}</button><button class="btn primary" data-act="slotsave">${tx("Speichern")}</button></div>`,
    ui.draftNew ? "#f-sets" : "#dlg-h");
}
function saveSlot() {
  const sets = +$("#f-sets").value, min = +$("#f-min").value, max = +$("#f-max").value, rest = +$("#f-rest").value;
  if (!(sets >= 1 && sets <= 10)) return dlgError(tx("Sätze: bitte eine Zahl von 1 bis 10."));
  const mx = maxReps(St.ex(ui.draft.exId));
  if (!(min >= 1 && max <= mx && min <= max)) return dlgError(tx("{what}: „von“ muss zwischen 1 und „bis“ liegen, „bis“ höchstens {n}.", {what: St.repWord(St.ex(ui.draft.exId)), n: mx}));
  const p = curPlan(), d = p.days[ui.eday];
  Object.assign(ui.draft, {sets, min, max, rest});
  if (ui.draftNew) d.slots.push(ui.draft); else d.slots[d.slots.findIndex(s => s.id === ui.draft.id)] = ui.draft;
  persist();
  const idx = d.slots.findIndex(s => s.id === ui.draft.id), name = exName(St.ex(ui.draft.exId));
  opener = null; closeDialog(); rerender(`[data-act="slot"][data-i="${idx}"]`);
  say(tx("{name} gespeichert: {what}.", {name, what: schemeSr(ui.draft)}));
}

/* ---------- Übungsauswahl ---------- */
let pickCb = null;
function openPicker(cb, swapFrom) {
  pickCb = cb; ui.pq = ""; ui.pm = ""; ui.swapFrom = swapFrom || null;
  openDialog(`<h2 id="dlg-h">${tx("Übung wählen")}</h2>
    <label class="field">${tx("Suchen oder eigenen Namen eingeben")} <input id="pq" type="search" data-on="pq" autocomplete="off" enterkeyhint="search"></label>
    <div class="pair"><label class="field">${tx("Muskel")} <select data-on="pm"><option value="">${tx("Alle Muskeln")}</option>${MUSCLES.map(m => `<option value="${m.id}">${tx(m.name)}</option>`).join("")}</select></label>
    ${kitSelect("kitp")}</div>
    <div id="pres"></div>
    <button class="btn" data-act="close">${tx("Abbrechen")}</button>`, "#pq");
  renderPickList();
}
function renderPickList() {
  const q = ui.pq.trim().toLowerCase();
  const list = Object.values(D().exercises)
    .filter(e => !e.archived && (!q || (exName(e) + " " + e.name).toLowerCase().includes(q)) && (!ui.pm || e.primary.includes(ui.pm) || e.secondary.includes(ui.pm)) && kitMatch(e, ui.kit))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  const exact = list.some(e => e.name.toLowerCase() === q);
  // Beim Tauschen: Alternativen für denselben Hauptmuskel zuerst, im gewählten Gerätefilter
  const from = ui.swapFrom && St.ex(ui.swapFrom);
  const alts = from && !q && !ui.pm ? Object.values(D().exercises).filter(e => !e.archived && e.id !== from.id && e.primary[0] === from.primary[0] && isMobility(e) === isMobility(from) && kitMatch(e, ui.kit))
    .sort((a, b) => (St.setCount(b.id) - St.setCount(a.id)) || a.name.localeCompare(b.name, "de")).slice(0, 6) : [];
  $("#pres").innerHTML = `
    ${q && !exact ? `<button class="btn primary" data-act="newex" style="margin-bottom:12px">${tx("„{name}“ als eigene Übung anlegen", {name: esc(ui.pq.trim())})}</button>` : ""}
    ${alts.length ? `<h3 class="sec" id="alt-h">${tx("Alternativen für {name}", {name: esc(exName(from))})}</h3><ul class="plist" aria-labelledby="alt-h">${alts.map(e => `<li><button data-act="pick" data-id="${e.id}"><b>${esc(exName(e))}</b><small>${esc(exMeta(e))}</small></button></li>`).join("")}</ul><h3 class="sec">${tx("Alle Übungen")}</h3>` : ""}
    <p class="meta" aria-live="polite">${tx("{n} Treffer", {n: list.length})}${ui.kit ? ". " + tx("Eigene Übungen erscheinen nur bei „Alle Geräte“.") : ""}</p>
    <ul class="plist">${list.map(e => `<li><button data-act="pick" data-id="${e.id}"><b>${esc(exName(e))}${e.custom ? `<span class="badge">${tx("eigene")}</span>` : ""}</b><small>${esc(exMeta(e))}</small></button></li>`).join("")}</ul>`;
}

/* ---------- Übung anlegen / bearbeiten ---------- */
function openExForm(exId, name, after) {
  const e = exId ? St.ex(exId) : {name: name || "", primary: [ui.pm || "brust"], secondary: [], step: 2.5, unit: "kg", custom: true};
  const lockMuscles = e.primary.length > 1;
  const used = exId && D().plans.some(p => p.days.some(d => d.slots.some(s => s.exId === exId)));
  ui.exAfter = after; ui.exEdit = exId;
  openDialog(`<h2 id="dlg-h">${exId ? tx("Übung bearbeiten") : tx("Eigene Übung")}</h2>
    ${exId ? exFigure(e) : ""}
    <p class="err" role="alert" hidden></p>
    <label class="field">${tx("Name")} <input id="x-name" value="${esc(exId ? exName(e) : e.name)}" autocomplete="off"></label>
    ${lockMuscles ? `<p class="meta">${tx("Muskeln: {list}. Bei dieser Übung sind sie fest hinterlegt.", {list: esc(muscleList(e))})}</p>` : `
    <label class="field">${tx("Hauptmuskel")} <select id="x-prim">${MUSCLES.map(m => `<option value="${m.id}" ${e.primary[0] === m.id ? "selected" : ""}>${tx(m.name)}</option>`).join("")}</select></label>
    <fieldset><legend>${tx("Mitarbeitende Muskeln (zählen als halber Satz)")}</legend><div class="checks">
      ${MUSCLES.map(m => `<label class="check"><input type="checkbox" name="x-sec" value="${m.id}" ${e.secondary.includes(m.id) ? "checked" : ""}>${tx(m.name)}</label>`).join("")}
    </div></fieldset>`}
    <div class="pair">
      <label class="field">${tx("Einheit")} <select id="x-unit"><option value="kg" ${e.unit === "kg" ? "selected" : ""}>${tx("Gewicht")}</option><option value="bw" ${e.unit === "bw" ? "selected" : ""}>${tx("Körpergewicht")}</option><option value="band" ${e.unit === "band" ? "selected" : ""}>${tx("Widerstandsband")}</option><option value="s" ${e.unit === "s" ? "selected" : ""}>${tx("Halten (Sekunden)")}</option></select></label>
      <label class="field">${tx("Steigerung")} <select id="x-step">${[1, 1.25, 2, 2.5, 5, 10].map(s => `<option value="${s}" ${e.step === s ? "selected" : ""}>${fmt(s)} kg</option>`).join("")}</select></label>
    </div>
    ${exId ? `<p class="meta">${tx("Umbenennen ändert nichts am Verlauf: {n} gespeicherte Sätze bleiben dieser Übung zugeordnet.", {n: St.setCount(exId)})}</p>` : ""}
    <div class="dlg-actions"><button class="btn" data-act="close">${tx("Abbrechen")}</button><button class="btn primary" data-act="exsave">${tx("Speichern")}</button></div>
    ${exId && e.custom && !used ? `<button class="btn destructive" data-act="exdel" style="margin-top:10px">${tx("Übung archivieren")}</button>` : ""}`, "#x-name");
}
function saveEx() {
  const old = ui.exEdit && D().exercises[ui.exEdit];
  let name = $("#x-name").value.trim();
  if (!name) return dlgError(tx("Bitte gib der Übung einen Namen."));
  if (old && name === exName(old)) name = old.name; // unveränderter, nur übersetzt angezeigter Name bleibt wie gespeichert
  const clash = Object.values(D().exercises).find(e => !e.archived && e.id !== ui.exEdit && [e.name, exName(e)].some(n => n.toLowerCase() === name.toLowerCase()));
  if (clash) return dlgError(tx("„{name}“ gibt es schon. Wähle sie in der Liste oder nimm einen anderen Namen.", {name: exName(clash)}));
  const step = +$("#x-step").value, unit = $("#x-unit").value;
  let e;
  if (ui.exEdit) {
    e = D().exercises[ui.exEdit];
    Object.assign(e, {name, step, unit});
  } else {
    e = {id: "c_" + St.uid(), name, primary: [], secondary: [], step, unit, custom: true};
    D().exercises[e.id] = e;
  }
  const prim = $("#x-prim");
  if (prim) { e.primary = [prim.value]; e.secondary = [...dlg.querySelectorAll('input[name="x-sec"]:checked')].map(c => c.value).filter(m => m !== prim.value); }
  persist();
  say(tx("{name} gespeichert.", {name: exName(e)}));
  const after = ui.exAfter; ui.exAfter = null;
  if (after) after(e.id); else { closeDialog(); rerender(); }
}

/* ============ Übungen ============ */
function viewExercises() {
  const q = ui.exq.trim().toLowerCase();
  const list = Object.values(D().exercises).filter(e => !e.archived && (!q || (exName(e) + " " + e.name).toLowerCase().includes(q)) && kitMatch(e, ui.kit)).sort((a, b) => (b.custom - a.custom) || a.name.localeCompare(b.name, L()));
  view.innerHTML = `<p class="eyebrow"><a href="#/plaene">${tx("Pläne")}</a></p><h1 class="big">${tx("Übungen")}</h1>
    ${iL(tx("Dein Verlauf bleibt erhalten"), tx("Umbenennen und Tauschen lassen deinen Verlauf unverändert. Jede Übung behält ihre eigenen Sätze."))}
    <button class="btn primary" data-act="newexlist">${tx("Eigene Übung anlegen")}</button>
    <div class="pair" style="margin-top:14px"><label class="field">${tx("Suchen")} <input type="search" data-on="exq" value="${esc(ui.exq)}" autocomplete="off"></label>
    ${kitSelect("kitx")}</div>
    <p class="meta" aria-live="polite">${txn(list.length, "{n} Übung", "{n} Übungen")}${ui.kit ? tx(". Eigene Übungen erscheinen nur bei „Alle Geräte“.") : ""}</p>
    <ul class="plist" style="max-height:none">${list.map(e => `<li><button data-act="editex" data-id="${e.id}" aria-label="${esc(tx("{name} bearbeiten", {name: exName(e)}))}"><b>${esc(exName(e))}${e.custom ? `<span class="badge">${tx("eigene")}</span>` : ""}</b>
      <small>${esc(exMeta(e))} · ${txn(St.setCount(e.id), "{n} Satz im Verlauf", "{n} Sätze im Verlauf")}</small></button></li>`).join("")}</ul><div style="height:24px"></div>`;
}

/* ============ Ausführung: Gerät und Bewegungsablauf ============ */
function exInfo(e) {
  const i = INFO[e.id];
  return i ? {pat: i[0], eq: tx(i[1]), cue: tx(i[2])} : {pat: PATTERN_BY_MUSCLE[e.primary[0]] || "squat", eq: "", cue: ""};
}
function exFigure(e, small) {
  const x = exInfo(e);
  return `<figure class="exfig${small ? " small" : ""}">${AN.svgFor(x.pat, e.primary, esc(tx("Bewegungsablauf {name}, schematisch", {name: exName(e)})))}
    <figcaption>${x.eq ? `<b>${esc(x.eq)}.</b> ${esc(x.cue)}` : tx("Eigene Übung: grober Ablauf nach Hauptmuskel, nicht genau deine Übung.")}</figcaption></figure>`;
}

/* ============ Körperkarte ============ */
// Muskeln, die man von hinten sieht: beim Antippen in der Liste dreht sich die Figur um
const BACKSIDE = new Set(["ruecken", "lrs", "trizeps", "hamstrings", "gluteus", "waden"]);
let body3d = null;
function dropBody() { if (body3d) { body3d.destroy(); body3d = null; } }
function viewBody() {
  dropBody();
  const m = ui.bm || null, side = ui.bside || "front";
  view.innerHTML = `<p class="eyebrow"><a href="#/plaene">${tx("Pläne")}</a></p><h1 class="big">${tx("Körperkarte")}</h1>
    ${iL(tx("So bedienst du die Figur"), tx("Tippe auf einen Muskel oder wähle ihn unten in der Liste. Zum Drehen seitlich ziehen."))}
    <div class="b3wrap"><div class="body3d" id="body3d"><p class="meta b3load">${tx("Figur wird geladen …")}</p></div>
      <button type="button" class="b3tag" id="b3tag" data-act="b3go" ${m ? "" : "hidden"}>${m ? `${tx(MUSCLE_NAME[m])} <span aria-hidden="true">↓</span>` : ""}</button></div>
    <div class="seg" role="group" aria-label="${tx("Figur drehen")}" style="margin:10px 0 4px">
      <button type="button" data-act="bside" data-v="front" aria-pressed="${side === "front"}">${tx("Vorne")}</button><button type="button" data-act="bside" data-v="back" aria-pressed="${side === "back"}">${tx("Hinten")}</button></div>
    <h2 class="sec" id="bm-h">${tx("Muskelgruppe")}</h2>
    <div class="chips" role="group" aria-labelledby="bm-h">${MUSCLES.map(x => `<button type="button" class="chip" data-act="bm" data-m="${x.id}" aria-pressed="${x.id === m}">${tx(x.name)}</button>`).join("")}</div>
    <div id="bmList">${muscleExList(m)}</div><div style="height:24px"></div>`;
  const host = $("#body3d");
  import("./body3d.js").then(mod => {
    if (!document.contains(host)) return;
    host.innerHTML = "";
    body3d = mod.mountBody(host, {selected: m, onPick: id => pickMuscle(id, true)});
    if (body3d && side === "back") body3d.back();
  }).catch(() => { host.innerHTML = `<p class="meta b3load">${tx("Die 3D-Figur ließ sich nicht laden. Nutze die Liste darunter.")}</p>`; });
}
function muscleExList(m) {
  if (!m) return `<p class="meta" style="margin-top:12px">${tx("Noch kein Muskel gewählt.")}</p>`;
  const all = Object.values(D().exercises).filter(e => !e.archived), byName = (a, b) => exName(a).localeCompare(exName(b), L());
  const prim = all.filter(e => e.primary.includes(m)).sort(byName), sec = all.filter(e => !e.primary.includes(m) && e.secondary.includes(m)).sort(byName);
  return `<h2 class="sec" id="bx-h" tabindex="-1">${tx(MUSCLE_NAME[m])}: ${txn(prim.length, "{n} Übung", "{n} Übungen")}</h2>
    ${prim.map(e => `<article class="card exsug" aria-labelledby="bx-${e.id}"><h3 id="bx-${e.id}">${esc(exName(e))}${e.custom ? `<span class="badge">${tx("eigene")}</span>` : ""}</h3>${exFigure(e)}
      <p class="meta">${esc(muscleList(e))}</p>
      <div class="row-btns"><button class="btn small primary" data-act="bmadd" data-id="${e.id}" aria-haspopup="dialog" aria-label="${esc(tx("{name} zum Plan hinzufügen", {name: exName(e)}))}">${tx("Zum Plan hinzufügen")}</button></div></article>`).join("")}
    ${sec.length ? `<p class="meta">${tx("Arbeitet außerdem mit bei: {list}.", {list: sec.map(e => esc(exName(e))).join(", ")})}</p>` : ""}`;
}
function pickMuscle(id, from3d) {
  ui.bm = id;
  view.querySelectorAll('[data-act="bm"]').forEach(b => b.setAttribute("aria-pressed", String(b.dataset.m === id)));
  const box = $("#bmList"); if (box) box.innerHTML = muscleExList(id);
  AN.startAnim();
  if (body3d) { body3d.select(id); if (!from3d) { const back = BACKSIDE.has(id); back ? body3d.back() : body3d.front(); setSide(back ? "back" : "front"); } }
  const n = Object.values(D().exercises).filter(e => !e.archived && e.primary.includes(id)).length;
  say(txn(n, "{muscle} gewählt. {n} passende Übung.", "{muscle} gewählt. {n} passende Übungen.", {muscle: tx(MUSCLE_NAME[id])}));
  const tag = $("#b3tag");
  if (tag) { tag.hidden = false; tag.innerHTML = `${tx(MUSCLE_NAME[id])} · ${txn(n, "{n} Übung", "{n} Übungen")} <span aria-hidden="true">↓</span>`; }
}
function setSide(v) { ui.bside = v; view.querySelectorAll('[data-act="bside"]').forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === v))); }
// Standard-Satzschema nach Ziel des Plans (abgeglichen mit dem ACSM Position Stand 2026, siehe README)
const goalScheme = g => g === "ausdauer" ? [3, 15, 20, 45] : g === "athletik" ? [3, 4, 6, 150] : g === "mobil" ? [2, 30, 45, 15] : [3, 8, 12, 0];
// Halte- und Mobility-Übungen behalten ihr Sekunden-Schema, egal welches Ziel der Plan hat
const schemeFor = (e, g) => e.unit === "s" ? (({sets, min, max, rest}) => [sets, min, max, rest])(slotDefault(e)) : goalScheme(g);

/* ============ Training ============ */
function viewTraining() {
  const a = D().active;
  // ui.pin: Übung, die bewusst angezeigt wird (Zurück/Vor), auch wenn sie schon erledigt ist
  if (ui.pin != null && ui.pin !== a.idx) ui.pin = null;
  if (ui.summary || (ui.pin == null && St.firstOpen(a, a.idx) < 0)) return viewSummary();
  if (ui.pin == null && (a.queue[a.idx].skipped || St.workFor(a, a.idx).length >= St.targetSets(a.queue[a.idx]))) a.idx = St.firstOpen(a, a.idx);
  const i = a.idx, it = a.queue[i], e = St.ex(it.exId), logged = St.workFor(a, i), target = St.targetSets(it);
  const all = a.sets.filter(x => x.q === i), done = logged.length >= target;
  const sug = St.suggest(it), key = `${a.id}:${i}:${logged.length}:${all.length}`;
  const warms = St.warmupsFor(a, i);
  if (ui.key !== key) {
    const entering = !ui.key.startsWith(`${a.id}:${i}:`);
    if (entering) {
      ui.stype = "work"; ui.addAfter = false; ui.mode = null; ui.found = null;
      // Neue Übung mit Gewicht: geführte Gewichtsfindung mit Testsätzen (zählen als Aufwärmsätze)
      if (sug.kind === "new" && e.unit === "kg" && !all.length && !it.deload) { ui.mode = "find"; ui.stype = "warm"; }
    }
    ui.key = key; ui.rir = null;
    const l = all[all.length - 1];
    if (l) { ui.kg = l.kg; ui.reps = l.reps; } else { ui.kg = sug.kg; ui.reps = sug.reps; }
    if (ui.mode === "find") {
      const f = St.findNext(e, it, warms);
      if (f.found) { ui.mode = null; ui.stype = "work"; ui.found = f.kg; setTimeout(() => { say(tx("Arbeitsgewicht gefunden: {w}. Jetzt die Arbeitssätze.", {w: St.fmtW(e, f.kg)})); toast(tx("Arbeitsgewicht gefunden: {w}. Jetzt die Arbeitssätze.", {w: St.fmtW(e, f.kg)})); }, 50); }
      ui.kg = f.kg; ui.reps = f.reps;
    } else if (ui.mode === "ramp") {
      const r = St.warmupRamp(e, ui.rampKg)[warms.length];
      if (r) { ui.kg = r.kg; ui.reps = r.reps; } else { ui.mode = null; ui.stype = "work"; ui.kg = ui.rampKg; ui.reps = sug.reps; }
    }
    if (!logged.length && ui.stype === "work" && ui.found != null && sug.kind === "new") { ui.kg = ui.found; ui.reps = it.min; }
  }
  // Erledigte Übung: Formular nur, wenn bewusst ein Drop-Satz angehängt wird
  const form = !done || ui.addAfter;
  const bw = e.unit === "bw", resting = a.restEnd > Date.now(), st = ui.stype || "work";
  const next = a.queue.findIndex((q, k) => k > i && !q.skipped && St.workFor(a, k).length < St.targetSets(q));
  const lastNote = [...D().sessions].reverse().find(x => x.notes && x.notes[it.exId]);
  const note = (a.notes || {})[it.exId];
  view.innerHTML = `
    <div class="progress" aria-hidden="true">${a.queue.map((q, k) => `<span class="${q.skipped ? "skip" : k === i ? "now" : St.workFor(a, k).length >= St.targetSets(q) ? "done" : ""}"></span>`).join("")}</div>
    <div class="exnav"><button type="button" class="linkbtn" data-act="exprev" ${i === 0 ? "disabled" : ""}><span aria-hidden="true">‹</span> ${tx("Vorherige Übung")}</button>
      <button type="button" class="linkbtn" data-act="exnext" ${i >= a.queue.length - 1 ? "disabled" : ""}>${tx("Nächste Übung")} <span aria-hidden="true">›</span></button></div>
    <p class="eyebrow">${tx("Übung {n} von {m}", {n: i + 1, m: a.queue.length})} · ${done ? tx("erledigt, {n} von {m} Sätzen", {n: logged.length, m: target}) : tx("Satz {n} von {m}", {n: logged.length + 1, m: target})}</p>
    <div class="exhead"><h1 class="big">${esc(exName(e))}</h1>${D().settings.showFig !== false ? `<button type="button" class="figthumb" data-act="exfig" aria-haspopup="dialog" aria-label="${tx("Ausführung ansehen")}">${AN.svgFor(exInfo(e).pat, e.primary, "")}</button>` : ""}</div>
    ${done ? "" : ui.mode === "find" ? findChip(e, it, warms) : targetChip(e, it, ui.found != null && sug.kind === "new" ? {...sug, kg: ui.found, reps: it.min} : sug)}
    ${done || ui.mode === "find" ? "" : `<p class="hint2">${esc(ui.found != null && sug.kind === "new" ? tx("Arbeitsgewicht aus der Gewichtsfindung. Ziel: {s} × {a}–{b} Wdh., beim nächsten Mal steigert SATZ von hier.", {s: it.sets, a: it.min, b: it.max}) : sug.text)}${lastNote && !note ? `<br><b>${tx("Notiz vom {date}:", {date: dateDe(lastNote.date)})}</b> ${esc(lastNote.notes[it.exId])}` : ""}${note ? `<br><b>${tx("Notiz:")}</b> ${esc(note)}` : ""}</p>`}
    ${recentList(e)}
    ${restSlot(resting, form, st, it)}
    ${!form ? `<p class="note">${it.skipped ? tx("Diese Übung hast du ausgelassen.") : tx("Alle Sätze dieser Übung sind eingetragen.")} ${tx("Tippe unten auf einen Satz, um ihn zu korrigieren.")}</p>
    <div class="actionbar"><button class="btn primary" data-act="exgo" id="saveset">${St.firstOpen(a, 0) >= 0 ? tx("Weiter zur offenen Übung") : tx("Zur Zusammenfassung")}</button></div>` : `
    ${ui.mode === "find" ? `<div class="modebar" role="status"><b>${tx("Testsatz {n}", {n: warms.length + 1})}</b><button type="button" class="linkbtn" data-act="findskip">${tx("Gewicht steht, Arbeitssätze")}</button></div>`
      : ui.mode === "ramp" ? `<div class="modebar" role="status"><b>${tx("Aufwärmen {n} von {m}", {n: warms.length + 1, m: St.warmupRamp(e, ui.rampKg).length})}</b><button type="button" class="linkbtn" data-act="rampskip">${tx("Überspringen")}</button></div>`
      : st !== "work" ? `<div class="modebar" role="status"><b>${st === "warm" ? tx("Aufwärmsatz") : tx("Drop-Satz")}</b><button type="button" class="linkbtn" data-act="stype" data-v="work">${tx("Zurück zum Arbeitssatz")}</button></div>`
      : rampOffer(e, it, sug, all)}
    ${noLoad(e) ? "" : `<div class="stepper" role="group" aria-labelledby="kg-l">
      <button data-act="kg" data-d="-1" aria-label="${tx("Gewicht um {n} Kilo verringern", {n: fmt(e.step)})}">−</button>
      <div class="val"><input id="kgIn" class="v num" data-on="kgin" inputmode="decimal" autocomplete="off" enterkeyhint="done" value="${fmt(ui.kg)}" aria-describedby="kg-l"><label id="kg-l" for="kgIn" class="u">${bw ? tx("kg zusätzlich") : "kg"}<span class="sr"> · ${tx("antippen zum Eintippen")}</span></label></div>
      <button data-act="kg" data-d="1" aria-label="${tx("Gewicht um {n} Kilo erhöhen", {n: fmt(e.step)})}">+</button></div>`}
    <div class="stepper" role="group" aria-labelledby="reps-l">
      <button data-act="reps" data-d="-1" aria-label="${e.unit === "s" ? tx("5 Sekunden weniger") : tx("Eine Wiederholung weniger")}">−</button>
      <div class="val"><input id="repsIn" class="v num" data-on="repsin" inputmode="numeric" pattern="[0-9]*" autocomplete="off" enterkeyhint="done" value="${ui.reps}"><label id="reps-l" for="repsIn" class="u">${St.repWord(e)}</label></div>
      <button data-act="reps" data-d="1" aria-label="${e.unit === "s" ? tx("5 Sekunden mehr") : tx("Eine Wiederholung mehr")}">+</button></div>
    ${(D().settings.rir && st !== "warm" && !isMobility(e)) || ui.mode === "find" ? `<div class="rirrow" role="group" aria-label="${tx("Wie viele Wdh. wären noch gegangen?")} ${tx("(optional)")}"><span class="rirl" aria-hidden="true">${tx("Reserve")}</span>
      <div class="rir">${[0, 1, 2, 3, 4].map(r => `<button type="button" data-act="rir" data-v="${r}" aria-pressed="${ui.rir === r}">${r === 4 ? "4+" : r}</button>`).join("")}</div></div>` : ""}
    <div class="actionbar"><button class="btn primary" data-act="saveset" id="saveset">${ui.mode === "find" ? tx("Testsatz speichern") : st === "warm" ? tx("Aufwärmsatz speichern") : st === "drop" ? tx("Drop-Satz speichern") : tx("Satz {n} speichern", {n: logged.length + 1})}</button></div>`}
    ${setTable(a, i, it, e, all, logged, target, done, st, sug, form)}
    <div class="row-btns" style="margin-top:16px">${it.skipped ? `<button class="btn small" data-act="unskip" data-i="${i}">${tx("Wieder aufnehmen")}</button>` : ""}<button class="btn small" data-act="note" aria-haspopup="dialog">${note ? tx("Notiz ändern") : tx("Notiz")}</button><button class="btn small" data-act="exmore" aria-haspopup="dialog">${tx("Mehr …")}</button></div>
    <p class="meta" style="margin-top:12px">${next >= 0 ? tx("Danach: {name}", {name: esc(exName(St.ex(a.queue[next].exId)))}) : tx("Das ist die letzte offene Übung.")}</p>
    <div style="height:16px"></div>`;
}
// Wie oft eine Übung schon trainiert wurde (für das zugeklappte Bewegungsbild)
const exSessions = id => D().sessions.reduce((n, x) => n + (x.sets.some(y => y.exId === id) ? 1 : 0), 0);
// Ziel des Satzes als großer Chip (Erkennen statt Lesen), Erklärung klein darunter
function targetChip(e, it, sug) {
  const r = e.unit === "s" ? `${sug.reps} s` : `${sug.reps}`;
  const val = noLoad(e) ? `${r} ${e.unit === "s" ? "" : St.repShort(e)}` : e.unit === "bw" ? `${sug.kg ? "+" + fmt(sug.kg) + " kg" : tx("KG")} × ${r}` : `${fmt(sug.kg)} kg × ${r}`;
  return `<div class="target"><span class="tv num">${val.trim()}</span><span class="ts">${tx("Ziel")} ${it.min === it.max ? it.max : `${it.min}–${it.max}`} ${St.repShort(e)}</span></div>`;
}
// Gewichtsfindung: Testsatz-Ziel und Erklärung
function findChip(e, it, warms) {
  const t = warms[warms.length - 1];
  const msg = !t ? tx("Nimm ein Gewicht, das sich leicht anfühlt, und mach {n} saubere Wdh. Danach angeben, wie viele noch gegangen wären. Daraus schätzt SATZ das Arbeitsgewicht für etwa 3 Wdh. in Reserve.", {n: it.max})
    : t.rir == null ? tx("Ohne Angabe zur Reserve rechnet SATZ vorsichtig. Gib nach diesem Satz an, wie viele Wdh. noch gegangen wären.")
    : tx("Letzter Testsatz: {w} × {r}, {rir} in Reserve. Nächster Versuch etwas angepasst.", {w: St.fmtW(e, t.kg), r: t.reps, rir: t.rir === 4 ? "4+" : t.rir});
  return `<div class="target"><span class="tv num">${fmt(ui.kg)} kg × ${ui.reps}</span><span class="ts">${tx("Testsatz")}</span></div><p class="hint2">${esc(msg)}</p>`;
}
// Angebot für die Aufwärmrampe bei schweren Grundübungen, solange noch kein Satz eingetragen ist
function rampOffer(e, it, sug, all) {
  if (all.length || it.deload) return "";
  const kg = sug.kind === "new" && ui.found != null ? ui.found : sug.kg, r = St.warmupRamp(e, kg);
  if (!r.length) return "";
  return `<div class="rampoffer"><span><b>${tx("Aufwärmen")}</b> <span class="num">${r.map(x => `${fmt(x.kg)}×${x.reps}`).join(" · ")}</span></span><button type="button" class="btn small" data-act="rampgo" data-kg="${kg}">${tx("Übernehmen")}</button></div>`;
}
// Die letzten Trainings dieser Übung auf einen Blick (nur Arbeitssätze)
function recentList(e) {
  const rows = St.recentFor(e.id, 3); if (!rows.length) return "";
  // Gleiches Gewicht zusammenfassen: „57,5 × 8, 8, 7“
  const line = sets => { if (noLoad(e)) return sets.map(x => `${x.reps}${e.unit === "s" ? " s" : ""}`).join(", ");
    const g = []; sets.forEach(x => { const l = g[g.length - 1]; if (l && l.kg === x.kg) l.r.push(x.reps); else g.push({kg: x.kg, r: [x.reps]}); });
    return g.map(x => `${kgCell(e, x.kg)} × ${x.r.join(", ")}`).join(" · "); };
  return `<details class="recent"><summary>${tx("Letzte Trainings")}<span class="rc-last num">${line(rows[0].sets)}</span></summary><ul>${rows.map(r => `<li><span>${esc(dateDe(r.date))}${r.deload ? ` <small>${tx("Entlastung")}</small>` : ""}</span><span class="num">${line(r.sets)}</span></li>`).join("")}</ul></details>`;
}
// Fester Platz für die Pause: gleiche Höhe mit und ohne laufenden Timer, damit nichts springt
function restSlot(resting, form, st, it) {
  if (resting) return `<div class="restslot on" role="group" aria-label="${tx("Pause")}"><span class="rs-l">${tx("Pause")}</span><span class="num rs-n" id="rt" aria-hidden="true">${restLeft()}</span>
    <button class="btn small" data-act="rest30">+30 s</button><button class="btn small" data-act="skiprest">${tx("Beenden")}</button><i class="rs-bar" id="rtbar" aria-hidden="true"></i></div>`;
  const r = !form ? 0 : st === "warm" ? (ui.mode === "find" ? 90 : 60) : st === "drop" ? 0 : it.rest;
  return `<div class="restslot"><span class="rs-l">${r ? tx("Danach {t} Pause", {t: fmtSec(r)}) : form ? tx("Danach keine Pause") : ""}</span></div>`;
}
// Selten gebrauchte Knöpfe im Training stecken in einem Blatt „Mehr …“
function openExMore() {
  const a = D().active, i = a.idx, it = a.queue[i], e = St.ex(it.exId), logged = St.workFor(a, i), target = St.targetSets(it);
  const all = a.sets.filter(x => x.q === i), done = it.skipped || logged.length >= target;
  const b = (act, l, cls = "") => `<button class="btn ${cls}" data-act="exm" data-a="${act}">${l}</button>`;
  openDialog(`<h2 id="dlg-h">${esc(exName(e))}</h2>
    <div class="exmore">${!done && (ui.stype || "work") !== "warm" ? b("warmset", tx("+ Aufwärmsatz eintragen")) : ""}${!done && logged.length && (ui.stype || "work") !== "drop" ? b("dropset", tx("+ Drop-Satz eintragen")) : ""}${done && !it.skipped ? b("adddrop", tx("+ Drop-Satz anhängen")) : ""}${b("extraset", "+ " + tx("Extra-Satz"))}${it.extra > 0 && logged.length < target ? b("extraless", "− " + tx("Extra-Satz")) : ""}
    ${done ? "" : b("swapex", tx("Übung tauschen (nur heute)"))}${all.length ? b("undoset", tx("Letzten Satz löschen")) : ""}${b("exfig", tx("Ausführung ansehen"))}${done ? "" : b("skipex", tx("Übung auslassen"), "destructive")}</div>
    <div class="dlg-actions"><button class="btn" data-act="close">${tx("Abbrechen")}</button></div>`, "#dlg-h");
}
// Satz-Tabelle: alle Sätze der Übung in einer Liste. Eingetragene (bearbeitbar), der aktuelle (hervorgehoben)
// und die noch offenen mit geplanten Werten. Aufwärmsätze stehen oben, Drop-Sätze bleiben unter ihrem Satz.
// Nur Anzeige: Die gespeicherten Sätze selbst werden dafür nicht umsortiert oder verändert.
function setTable(a, i, it, e, all, logged, target, done, st, sug, form) {
  const rir = l => l.rir != null ? (l.rir === 4 ? "4+" : String(l.rir)) : "–";
  const warm = all.filter(l => l.type === "warm"), rest = all.filter(l => l.type !== "warm");
  const rows = [];
  let wn = 0, n = 0;
  for (const l of warm) rows.push({l, lab: warm.length > 1 ? tx("Aufwärmen {n}", {n: ++wn}) : tx("Aufwärmen"), kind: "warm"});
  const cur = (lab, kind) => ({cur: true, lab, kind});
  if (form && st === "warm") rows.push(cur(warm.length ? tx("Aufwärmen {n}", {n: warm.length + 1}) : tx("Aufwärmen"), "warm"));
  for (const l of rest) rows.push({l, lab: l.type === "drop" ? tx("Drop-Satz") : tx("Satz {n}", {n: ++n}), kind: l.type === "drop" ? "drop" : "work"});
  if (form && st === "drop") rows.push(cur(tx("Drop-Satz"), "drop"));
  const lastWork = [...rest].reverse().find(l => l.type !== "drop");
  const plan = lastWork ? {kg: lastWork.kg, reps: lastWork.reps} : {kg: sug.kg, reps: sug.reps};
  for (let k = logged.length; k < target; k++) {
    if (k === logged.length && !done && st === "work") rows.push(cur(tx("Satz {n}", {n: k + 1}), "work"));
    else rows.push({open: true, lab: tx("Satz {n}", {n: k + 1}), kind: "work", extra: k >= it.sets});
  }
  if (!rows.length) return "";
  const kgTxt = v => kgCell(e, v);
  const kgSay = v => e.unit === "band" ? tx("Band") : e.unit === "s" ? tx("Halten") : e.unit === "bw" ? (v ? tx("Körpergewicht plus {n} Kilo", {n: fmt(v)}) : tx("Körpergewicht")) : tx("{n} Kilo", {n: fmt(v)});
  const showRir = D().settings.rir !== false && !isMobility(e);
  const rirCell = v => showRir ? `<span class="c-n c-rir">${v}</span>` : "";
  const lab = r => r.kind === "drop" ? `<span aria-hidden="true">↳ </span>${r.lab}` : r.lab;
  const body = rows.map(r => {
    if (r.l) {
      const k = a.sets.indexOf(r.l);
      return `<li class="done ${r.kind}"><button type="button" class="srow" data-act="editset" data-k="${k}" aria-haspopup="dialog" aria-label="${tx("{lab}, erledigt: {kg} mal {reps}", {lab: r.lab, kg: kgSay(r.l.kg), reps: r.l.reps})}${r.l.rir != null ? `, RIR ${rir(r.l)}` : ""}. ${tx("Bearbeiten")}">
        <span class="c-lab">${lab(r)}</span><span class="c-n">${kgTxt(r.l.kg)}</span><span class="c-n">${r.l.reps}</span>${rirCell(rir(r.l))}<span class="c-st" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button></li>`;
    }
    if (r.cur) return `<li class="now ${r.kind}" aria-current="step"><span class="sr">${tx("{lab}, jetzt dran, eingestellt sind die Werte oben.", {lab: r.lab})}</span><div class="srow" aria-hidden="true"><span class="c-lab">${lab(r)}</span><span class="c-n" id="curKg">${kgTxt(ui.kg)}</span><span class="c-n" id="curReps">${ui.reps}</span>${rirCell("–")}<span class="c-st"><span class="nowtag">${tx("jetzt")}</span></span></div></li>`;
    const reps = it.min === it.max ? `${it.max}` : `${it.min}–${it.max}`;
    return `<li class="open"><span class="sr">${r.lab}${r.extra ? ", " + tx("Extra-Satz") : ""}, ${tx("offen, geplant {kg} mal {reps}", {kg: kgSay(plan.kg), reps: reps.replace("–", " " + tx("bis") + " ")})}</span><div class="srow" aria-hidden="true"><span class="c-lab">${r.lab}${r.extra ? `<span class="xtag">${tx("extra")}</span>` : ""}</span><span class="c-n">${kgTxt(plan.kg)}</span><span class="c-n">${reps}</span>${rirCell("–")}<span class="c-st"></span></div></li>`;
  }).join("");
  const wDone = logged.length, summary = done ? tx("{n} von {m} Sätzen erledigt", {n: wDone, m: target}) : `${tx("Satz {n} von {m}", {n: Math.min(wDone + 1, target), m: target})}${target - wDone - 1 > 0 ? ", " + tx("danach noch {n} offen", {n: target - wDone - 1}) : ", " + tx("der letzte")}`;
  return `<h2 class="sec" id="sets-h" style="margin-top:8px">${tx("Sätze")} <span class="sec-sub">${summary}</span></h2>
    <div class="sets"><div class="sethead ${showRir ? "" : "norir"}" aria-hidden="true"><span class="c-lab"></span><span class="c-n">${noLoad(e) ? "" : e.unit === "bw" ? "+kg" : "kg"}</span><span class="c-n">${St.repShort(e)}</span>${showRir ? `<span class="c-n c-rir">RIR</span>` : ""}<span class="c-st"></span></div>
    <ol class="setlist ${showRir ? "" : "norir"}" aria-labelledby="sets-h">${body}</ol></div>`;
}
// Gewichtsspalte der Satz-Tabelle: Band, Halten (–), Körpergewicht (KG oder +Zusatz), sonst kg
const kgCell = (e, v) => e.unit === "band" ? tx("Band") : e.unit === "s" ? "–" : e.unit === "bw" ? (v ? `+${fmt(v)}` : tx("KG")) : fmt(v);
const fmtSec = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
function restLeft() {
  const s = Math.max(0, Math.ceil((D().active.restEnd - Date.now()) / 1000));
  return fmtSec(s);
}
let lastRestState = false;
setInterval(() => {
  const a = D() && D().active;
  if (!a || !a.restEnd) return;
  const left = a.restEnd - Date.now(), el = $("#rt");
  if (left > 0) { if (el) el.textContent = restLeft(); const bar = $("#rtbar"); if (bar && a.restTotal) bar.style.width = Math.max(0, Math.min(100, left / (a.restTotal * 10))) + "%"; lastRestState = true; updateMini(); return; }
  a.restEnd = 0; persist();
  if (lastRestState) {
    say(tx("Pause vorbei.")); if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
    const fresh = -left < 5000, st = D().settings;
    // Ohne geplante Glocke (sehr lange Pause) jetzt läuten; Ansage nur, wenn die App gerade sichtbar ist
    if (st.sound && fresh && !BELL.scheduledUntil) BELL.ring();
    if (st.sound && st.voice !== false && fresh && document.visibilityState === "visible") setTimeout(BELL.announce, 1300);
  }
  lastRestState = false;
  if (location.hash === "#/training" && !ui.summary && !dlg.open) rerender();
  updateMini();
}, 1000);

/* ---------- Mini-Player: verkleinertes Training über der Tab-Bar ---------- */
const mini = $("#mini");
function miniText() {
  const a = D().active; if (!a) return null;
  const i = St.firstOpen(a, a.idx) < 0 ? -1 : a.idx, it = i >= 0 ? a.queue[i] : null;
  const resting = a.restEnd > Date.now();
  const name = it ? exName(St.ex(it.exId)) : tx("Alle Übungen erledigt");
  const sub = resting ? tx("Pause · noch {t}", {t: restLeft()}) : it ? tx("Satz {n} von {m} · bereit", {n: Math.min(St.workFor(a, i).length + 1, St.targetSets(it)), m: St.targetSets(it)}) : tx("Zum Speichern öffnen");
  const pct = resting && a.restTotal ? Math.max(0, Math.min(100, (a.restEnd - Date.now()) / (a.restTotal * 1000) * 100)) : 0;
  return {name, sub, resting, pct};
}
function renderMini() {
  const on = !!(D().active && ui.mini && !location.hash.startsWith("#/training"));
  mini.hidden = !on; document.body.classList.toggle("hasmini", on);
  if (on) updateMini(true);
}
function updateMini(force) {
  if (mini.hidden) return;
  const t = miniText(); if (!t) { renderMini(); return; }
  if (force || !mini.firstChild) mini.innerHTML = `<span class="mi-ic" aria-hidden="true"><svg viewBox="0 0 28 28" width="22" height="22" fill="currentColor"><rect x="1" y="11" width="3" height="6" rx="1.5"/><rect x="24" y="11" width="3" height="6" rx="1.5"/><rect x="4.5" y="7" width="4.5" height="14" rx="2"/><rect x="19" y="7" width="4.5" height="14" rx="2"/><rect x="9" y="12.5" width="10" height="3" rx="1"/></svg></span>
    <span class="mi-t"><b></b><small></small></span><span class="mi-up" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 15l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span><i class="mi-bar" aria-hidden="true"></i>`;
  mini.querySelector("b").textContent = t.name; mini.querySelector("small").textContent = t.sub;
  mini.querySelector(".mi-bar").style.width = t.pct + "%";
  mini.classList.toggle("resting", t.resting);
  mini.setAttribute("aria-label", `${tx("Training öffnen.")} ${t.name}, ${t.sub}`);
}
function minimize() {
  if (!D().active) return;
  ui.mini = true; readSetInputs(); persist();
  go(ui.miniFrom || "#/heute");
  say(tx("Training verkleinert. Der Timer läuft weiter. Unten über der Tab-Leiste kannst du es wieder öffnen."));
}
// Nach unten wischen verkleinert das Training (nur ganz oben, nicht auf Eingabefeldern)
(() => {
  let y0 = null, dy = 0;
  view.addEventListener("touchstart", ev => {
    if (!view.classList.contains("modal") || view.scrollTop > 0 || dlg.open || ev.target.closest("input,select,textarea,.stepper,.seg,.rir,button")) { y0 = null; return; }
    y0 = ev.touches[0].clientY; dy = 0;
  }, {passive: true});
  view.addEventListener("touchmove", ev => {
    if (y0 == null) return;
    dy = ev.touches[0].clientY - y0;
    if (dy > 0 && view.scrollTop <= 0) { if (ev.cancelable) ev.preventDefault(); view.style.transition = "none"; view.style.transform = `translateY(${dy * 0.8}px)`; view.style.opacity = String(Math.max(0.4, 1 - dy / 600)); }
    else { y0 = null; view.style.transform = ""; view.style.opacity = ""; }
  }, {passive: false});
  const end = () => {
    if (y0 == null) return; y0 = null;
    const go2 = dy > 110;
    view.style.transition = "transform .22s ease, opacity .22s ease";
    view.style.transform = go2 ? "translateY(60%)" : ""; view.style.opacity = go2 ? "0" : "";
    setTimeout(() => { view.style.transition = ""; view.style.transform = ""; view.style.opacity = ""; if (go2) minimize(); }, go2 ? 200 : 230);
  };
  view.addEventListener("touchend", end); view.addEventListener("touchcancel", end);
})();

/* ---------- Ton am Pausenende: Ringglocke + „Next Round“ (js/bell.js) ---------- */
function cancelBeep() { BELL.cancel(); }
function scheduleBeep(sec) { if (D().settings.sound) BELL.schedule(sec, !!D().settings.bgBell); else BELL.cancel(); }

/* ---------- Bildschirm wach halten im Training (Wake Lock, iOS ab 16.4) ---------- */
let wake = null;
async function updateWakeLock() {
  const want = !!(D() && D().active) && document.visibilityState === "visible";
  try {
    if (want && !wake && navigator.wakeLock) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); }
    if (!want && wake) { await wake.release(); wake = null; }
  } catch (e) { wake = null; }
}
document.addEventListener("visibilitychange", updateWakeLock);

function readSetInputs() {
  const k = $("#kgIn"), r = $("#repsIn");
  if (k) { const v = parseFloat(k.value.replace(",", ".")); if (isFinite(v) && v >= 0 && v <= 1000) ui.kg = Math.round(v * 100) / 100; }
  if (r) { const v = parseInt(r.value, 10); if (isFinite(v) && v >= 0 && v <= 100) ui.reps = v; }
  syncCur();
}
// Hält die hervorgehobene Zeile der Satz-Tabelle auf den Werten der Eingabe, ohne neu zu zeichnen
function syncCur() {
  const k = $("#curKg"), r = $("#curReps"), a = D() && D().active; if (!a || (!k && !r)) return;
  const e = St.ex(a.queue[a.idx].exId);
  if (k) k.textContent = kgCell(e, ui.kg);
  if (r) r.textContent = ui.reps;
}
function saveSet() {
  readSetInputs(); ui.pin = null;
  const a = D().active, i = a.idx, it = a.queue[i], e = St.ex(it.exId), type = ui.stype || "work";
  a.sets.push({q: i, exId: it.exId, kg: ui.kg, reps: ui.reps, rir: type === "warm" && ui.mode !== "find" ? null : ui.rir, t: Date.now(), ...(type !== "work" ? {type} : {})});
  const n = St.workFor(a, i).length, target = St.targetSets(it);
  let msg = `${tx("Gespeichert:")} ${type === "warm" ? tx("Aufwärmsatz") + ", " : type === "drop" ? tx("Drop-Satz") + ", " : ""}${noLoad(e) ? "" : St.fmtW(e, ui.kg) + ", "}${ui.reps} ${St.repWord(e)}.`;
  if (type === "work" && ui.reps < it.min) msg += " " + tx("Unter dem Ziel von {n}.", {n: it.min});
  if (type === "drop") { ui.stype = "work"; ui.addAfter = false; }
  const nextIdx = St.firstOpen(a, i);
  if (nextIdx < 0) { a.restEnd = 0; cancelBeep(); persist(); ui.summary = true; say(msg + " " + tx("Alle Übungen erledigt.")); rerender(); view.querySelector("h1").focus(); return; }
  const rest = type === "warm" ? (ui.mode === "find" ? 90 : 60) : type === "drop" ? 0 : it.rest;
  a.restEnd = rest ? Date.now() + rest * 1000 : 0; a.restTotal = rest; lastRestState = !!rest; scheduleBeep(rest);
  if (n >= target) { a.idx = nextIdx; msg += " " + tx("{name} erledigt. Nächste Übung: {next}.", {name: exName(e), next: exName(St.ex(a.queue[nextIdx].exId))}); }
  if (rest) msg += " " + tx("Pause {n} Sekunden.", {n: rest});
  persist(); say(msg); rerender(); view.scrollTop = 0;
  (n >= target ? view.querySelector("h1") : $("#saveset")).focus();
}

// Zwischen Übungen blättern, auch zu erledigten (zum Korrigieren)
function moveEx(d) {
  readSetInputs();
  const a = D().active, n = a.idx + d;
  if (n < 0 || n >= a.queue.length) return;
  a.idx = n; ui.pin = n; ui.key = ""; persist(); rerender(); view.scrollTop = 0;
  const h = view.querySelector("h1"); if (h) h.focus();
  say(tx("Übung {n}: {name}.", {n: n + 1, name: exName(St.ex(a.queue[n].exId))}));
}
function openSetEdit(k) {
  const a = D().active, x = a.sets[k]; if (!x) return;
  const e = St.ex(x.exId); ui.setEdit = k;
  openDialog(`<h2 id="dlg-h">${tx("Satz korrigieren")}</h2><p class="meta" style="text-align:center;margin-top:-10px">${esc(exName(e))}</p>
    <p class="err" role="alert" hidden></p>
    <div class="seg" role="group" aria-label="${tx("Satztyp")}" style="margin-bottom:12px">${[["work", "Arbeitssatz"], ["warm", "Aufwärmen"], ["drop", "Drop-Satz"]].map(([v, l]) => `<button type="button" data-act="setype" data-v="${v}" aria-pressed="${(x.type || "work") === v}">${tx(l)}</button>`).join("")}</div>
    <div class="pair"><label class="field" ${noLoad(e) ? "hidden" : ""}>${e.unit === "bw" ? tx("kg zusätzlich") : "kg"} <input id="se-kg" inputmode="decimal" autocomplete="off" value="${fmt(x.kg)}"></label>
      <label class="field">${St.repWord(e)} <input id="se-reps" inputmode="numeric" autocomplete="off" value="${x.reps}"></label></div>
    ${D().settings.rir ? `<label class="field">${tx("Wdh. in Reserve")} <select id="se-rir"><option value="">${tx("keine Angabe")}</option>${[0, 1, 2, 3, 4].map(r => `<option value="${r}" ${x.rir === r ? "selected" : ""}>${r === 4 ? "4+" : r}</option>`).join("")}</select></label>` : ""}
    <div class="dlg-actions"><button class="btn" data-act="close">${tx("Abbrechen")}</button><button class="btn primary" data-act="setsave">${tx("Speichern")}</button></div>
    <button class="btn destructive" data-act="setdel" style="margin-top:10px">${tx("Satz löschen")}</button>`, noLoad(e) ? "#se-reps" : "#se-kg");
}
function saveSetEdit() {
  const a = D().active, x = a.sets[ui.setEdit]; if (!x) return closeDialog();
  const kg = num($("#se-kg").value), reps = Math.round(num($("#se-reps").value));
  if (!(kg >= 0 && kg <= 1000) || !$("#se-kg").value.trim()) return dlgError(tx("Bitte ein Gewicht zwischen 0 und 1000 kg eintragen."));
  if (!(reps >= 0 && reps <= 100) || !$("#se-reps").value.trim()) return dlgError(tx("Bitte 0 bis 100 Wiederholungen eintragen."));
  const type = dlg.querySelector('[data-act="setype"][aria-pressed="true"]').dataset.v, r = $("#se-rir");
  x.kg = Math.round(kg * 100) / 100; x.reps = reps;
  if (type === "work") delete x.type; else x.type = type;
  x.rir = type === "warm" ? null : r && r.value !== "" ? +r.value : r ? null : x.rir;
  persist(); opener = null; closeDialog(); ui.pin = a.idx; ui.key = ""; rerender(); say(tx("Satz geändert: {kg} Kilo, {n} Wiederholungen.", {kg: fmt(x.kg), n: reps}));
  const b = view.querySelector(`[data-act="editset"][data-k="${ui.setEdit}"]`); if (b) b.focus();
}
function swapToday(a, i, exId) {
  const it = a.queue[i], from = St.ex(it.exId), to = St.ex(exId), done = St.workFor(a, i).length, any = a.sets.some(x => x.q === i);
  const sc = sameScheme(from, to) ? {sets: St.targetSets(it) - done, min: it.min, max: it.max, rest: it.rest}
    : (s => ({sets: it.deload ? St.deloadSets(s.sets) : s.sets, min: s.min, max: s.max, rest: St.restFor({...s, exId})}))(slotDefault(to));
  const orig = it.swapFrom || from.id, swapFrom = orig === exId ? undefined : orig;
  if (!any) {
    Object.assign(it, {exId, ...sc, sets: Math.max(1, sameScheme(from, to) ? it.sets : sc.sets), extra: sameScheme(from, to) ? it.extra : 0});
    if (swapFrom) it.swapFrom = swapFrom; else delete it.swapFrom;
  } else {
    // Ab hier zählen die Satz-Nummern der späteren Übungen eins weiter. Nur die Zuordnung im laufenden Training ändert sich.
    a.sets.forEach(x => { if (x.q > i) x.q++; });
    it.sets = done; it.extra = 0;
    a.queue.splice(i + 1, 0, {slotId: it.slotId, exId, ...sc, sets: Math.max(1, sc.sets), skipped: false, extra: 0, ...(it.deload ? {deload: true} : {}), ...(swapFrom ? {swapFrom} : {})});
    a.idx = i + 1;
  }
  a.restEnd = 0; cancelBeep(); ui.pin = null; ui.key = ""; ui.summary = false; persist(); rerender(); view.scrollTop = 0;
  say(tx("Heute {to} statt {from}.", {from: exName(from), to: exName(to)}));
  toast(tx("Heute {to} statt {from}. Dein Plan bleibt, wie er ist.", {from: exName(from), to: exName(to)}));
}
function openOverview() {
  const a = D().active;
  openDialog(`<h2 id="dlg-h">${tx("Übersicht")}</h2><ol class="edlist">
    ${a.queue.map((q, k) => { const n = St.workFor(a, k).length, t = St.targetSets(q), name = esc(exName(St.ex(q.exId)));
      return `<li><div class="edrow"><span class="t">${k + 1}. ${name}</span><span class="num">${q.skipped ? tx("ausgelassen") : `${n}/${t}`}</span></div>
      <div class="edtools">${q.skipped ? `<button class="push" data-act="unskip" data-i="${k}">${tx("Wieder aufnehmen")}</button>`
        : k === a.idx ? "" : n < t ? `<button class="push" data-act="jump" data-i="${k}">${tx("Jetzt machen")}</button>` : `<button class="push" data-act="jump" data-i="${k}">${tx("Ansehen &amp; korrigieren")}</button>`}</div></li>`; }).join("")}
    </ol><button class="btn" data-act="close">${tx("Schließen")}</button>`);
}

function viewSummary() {
  const a = D().active, p = St.plan(a.planId);
  const open = St.firstOpen(a, 0) >= 0, mins = Math.max(1, Math.round((Date.now() - new Date(a.start)) / 60000));
  const devs = [];
  a.queue.forEach((q, k) => {
    const day = p && p.days.find(d => d.id === a.dayId), slot = day && day.slots.find(s => s.id === q.slotId);
    if (!slot) return;
    const name = exName(St.ex(q.exId));
    if (q.swapFrom && St.ex(q.swapFrom)) { if (!q.skipped && slot.exId === q.swapFrom) devs.push({k, kind: "swap", label: tx("{from} im Plan dauerhaft durch {to} ersetzen", {from: exName(St.ex(q.swapFrom)), to: name})}); return; }
    if (q.skipped) devs.push({k, kind: "remove", label: tx("{name} aus dem Plan entfernen", {name})});
    else if (q.extra > 0) devs.push({k, kind: "sets", label: tx("{name}: dauerhaft {n} statt {m} Sätze", {name, n: q.sets + q.extra, m: q.sets})});
  });
  const byEx = a.queue.map((q, k) => ({q, sets: St.loggedFor(a, k)})).filter(x => x.sets.length);
  const recs = St.newRecords(a.sets);
  view.innerHTML = `<p class="eyebrow">${esc(lib(a.dayName))} · ${tx("{n} Min.", {n: mins})}</p>
    <h1 class="big">${open ? tx("Training beenden?") : tx("Geschafft.")}</h1>
    <p>${open ? txn(a.sets.length, "{n} Satz eingetragen, einige Übungen sind noch offen.", "{n} Sätze eingetragen, einige Übungen sind noch offen.") : txn(a.sets.length, "{n} Satz eingetragen.", "{n} Sätze eingetragen.")}</p>
    ${recs.length ? `<section class="card recs" aria-labelledby="rec-h"><h2 id="rec-h">${tx("Neue Bestwerte")}</h2><ul>${recs.map(r => `<li><b>${esc(exName(St.ex(r.exId)))}</b><span>${esc(r.text)}</span></li>`).join("")}</ul></section>` : ""}
    ${byEx.length ? `<ul class="logged">${byEx.map(x => { const e = St.ex(x.q.exId); return `<li><span>${esc(exName(e))}</span><span class="num">${x.sets.map(s => noLoad(e) ? `${s.reps}${e.unit === "s" ? " s" : ""}` : `${fmt(s.kg)}×${s.reps}`).join(", ")}</span></li>`; }).join("")}</ul>` : ""}
    ${devs.length ? `<fieldset style="margin-top:16px"><legend>${tx("Abweichungen für künftige Trainings übernehmen?")}</legend>
      ${devs.map((d, n) => `<label class="check"><input type="checkbox" name="dev" value="${n}">${esc(d.label)}</label>`).join("")}
      <p class="meta">${tx("Ohne Haken bleibt dein Plan, wie er ist.")}</p></fieldset>` : ""}
    <div class="actionbar">
      <button class="btn primary" data-act="finish">${a.sets.length ? tx("Training speichern") : tx("Ohne Speichern beenden")}</button>
      ${open ? `<button class="btn" data-act="resume">${tx("Weiter trainieren")}</button>` : ""}
      ${a.sets.length ? `<button class="btn destructive" data-act="discard">${tx("Training verwerfen")}</button>` : ""}
    </div>`;
  ui.devs = devs;
}

/* ============ Verlauf ============ */
// Monatsrückblick: Zahlen des gewählten Monats, darunter der Vormonat zum Vergleich. Ohne Bewertung, nur Überblick.
function monthCard() {
  const now = new Date(), off = ui.mOff || 0, d = new Date(now.getFullYear(), now.getMonth() - off, 1), pd = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const m = St.monthStats(d.getFullYear(), d.getMonth()), pm = St.monthStats(pd.getFullYear(), pd.getMonth());
  const name = d.toLocaleDateString(L(), {month: "long", year: "numeric"}), hm = n => n < 60 ? `${n}<small class="u"> ${tx("Min.")}</small>` : `${Math.floor(n / 60)}<small class="u"> ${tx("Std.")}</small>${n % 60 ? ` ${n % 60}<small class="u"> ${tx("Min.")}</small>` : ""}`;
  const cell = (v, l, pv) => `<div><b class="num">${v}</b><span>${l}</span><small>${tx("Vormonat {v}", {v: pv})}</small></div>`;
  return `<section class="card monthcard" aria-labelledby="mo-h">
    <div class="wkhead"><h2 id="mo-h">${tx("Rückblick {month}", {month: esc(name)})}</h2>
      <span class="mnav"><button type="button" class="linkbtn" data-act="mprev" aria-label="${tx("Vorheriger Monat")}">‹</button><button type="button" class="linkbtn" data-act="mnext" aria-label="${tx("Nächster Monat")}" ${off ? "" : "disabled"}>›</button></span></div>
    ${m.sessions ? `<div class="mstats">${cell(m.sessions, m.sessions === 1 ? tx("Training") : tx("Trainings"), pm.sessions)}${cell(m.hard, tx("harte Sätze"), pm.hard)}${cell(m.mins ? hm(m.mins) : "–", tx("Trainingszeit"), pm.mins ? hm(pm.mins) : "–")}${cell(m.records, m.records === 1 ? tx("Bestwert") : tx("Bestwerte"), pm.records)}</div>
    ${m.top.length ? `<p class="meta">${tx("Am meisten trainiert: {list}.", {list: m.top.map(t => `${esc(tx(t.name))} (${txn(t.sets, "{n} Satz", "{n} Sätze", {n: fmt(t.sets)})})`).join(", ")})}</p>` : ""}`
    : `<p class="meta">${tx("In diesem Monat gibt es noch kein Training.")}</p>`}
  </section>`;
}
function viewHistory() {
  const s = D(), ses = [...s.sessions].reverse();
  if (!ses.length) {
    view.innerHTML = `<h1 class="big">${tx("Verlauf")}</h1><p>${tx("Noch keine Trainings. Nach deinem ersten Training siehst du hier, was sich bei jeder Übung verändert.")}</p>${weightSection()}${measureSection()}<div style="height:24px"></div>`;
    return;
  }
  const exIds = [...new Set(s.sessions.flatMap(x => x.sets.map(y => y.exId)))];
  const changes = exIds.filter(id => !noLoad(St.ex(id))).map(id => {
    const hist = s.sessions.filter(x => x.sets.some(y => y.exId === id));
    if (hist.length < 2) return null;
    const top = x => Math.max(...x.sets.filter(y => y.exId === id && St.isWork(y)).map(y => y.kg), 0);
    return {id, from: top(hist[0]), to: top(hist[hist.length - 1]), since: hist[0].date, last: hist[hist.length - 1].date};
  }).filter(Boolean).sort((a, b) => new Date(b.last) - new Date(a.last)).slice(0, 8);
  if (!ui.histEx || !exIds.includes(ui.histEx)) ui.histEx = exIds[0];
  const p = St.activePlan();
  view.innerHTML = `<h1 class="big">${tx("Verlauf")}</h1>
    ${monthCard()}
    ${weightSection()}
    ${measureSection()}
    ${changes.length ? `<h2 class="sec" style="margin-top:4px">${tx("Was sich verändert hat")} ${iB(tx("Was sich verändert hat"), tx("Schwerster Satz im ersten und im letzten Training."))}</h2><ul class="logged">
      ${changes.map(c => { const e = St.ex(c.id), d = c.to - c.from; return `<li><span>${esc(exName(e))}</span><span class="num">${fmt(c.from)} → ${fmt(c.to)} kg <span class="sr">,</span>(${d > 0 ? "+" : d < 0 ? "−" : "±"}${fmt(Math.abs(d))})</span></li>`; }).join("")}
    </ul>` : ""}
    <h2 class="sec">${tx("Übung im Detail")}</h2>
    <label class="field">${tx("Übung")} <select data-on="histex">${exIds.map(id => `<option value="${id}" ${id === ui.histEx ? "selected" : ""}>${esc(exName(St.ex(id)))}</option>`).join("")}</select></label>
    ${exDetail(ui.histEx)}
    <h2 class="sec">${tx("Letzte 7 Tage")}</h2>
    ${volumeTable(St.recentVolume(7), tx("Sätze pro Muskel in den letzten 7 Tagen, verglichen mit dem Plan"), p ? St.planVolume(p) : null)}
    <h2 class="sec">${tx("Trainings")}</h2>
    ${ses.map(x => `<details><summary>${dateDe(x.date)} · ${esc(lib(x.dayName))} · ${txn(x.sets.length, "{n} Satz", "{n} Sätze")}</summary>
      <ul class="logged">${groupSets(x.sets).map(g => `<li><span>${esc(exName(St.ex(g.exId)))}</span><span class="num">${g.sets.map(y => `${y.type === "warm" ? tx("A") + " " : y.type === "drop" ? tx("D") + " " : ""}${noLoad(St.ex(g.exId)) ? `${y.reps}${St.ex(g.exId).unit === "s" ? " s" : ""}` : `${fmt(y.kg)}×${y.reps}`}`).join(", ")}</span></li>`).join("")}</ul>
      ${x.notes ? `<p class="meta" style="margin:8px 0 0">${Object.entries(x.notes).map(([k, v]) => `<b>${esc(exName(St.ex(k)))}:</b> ${esc(v)}`).join("<br>")}</p>` : ""}
      <div class="row-btns" style="margin:10px 0"><button class="btn small" data-act="sessedit" data-id="${esc(x.id)}" aria-haspopup="dialog">${tx("Korrigieren")}</button><button class="btn small destructive" data-act="delsession" data-id="${esc(x.id)}">${tx("Training löschen")}</button></div></details>`).join("")}
    <div style="height:24px"></div>`;
}
function groupSets(sets) {
  const g = [];
  sets.forEach(s => { const last = g[g.length - 1]; if (last && last.exId === s.exId) last.sets.push(s); else g.push({exId: s.exId, sets: [s]}); });
  return g;
}
// Liniendiagramm mit Achsenwerten. Fester Seitenverhältnis-Rahmen, damit Punkte rund bleiben.
function chart(vals, labels, unit, caption, trend) {
  if (vals.length < 2) return "";
  const W = 320, H = 120, L = 40, R = 10, T = 10, B = 22;
  const all = trend ? vals.concat(trend) : vals, lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * 0.1 || 1;
  const y0 = lo - pad, y1 = hi + pad, X = k => L + k * ((W - L - R) / (vals.length - 1)), Y = v => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const path = arr => "M" + arr.map((v, k) => `${X(k).toFixed(1)},${Y(v).toFixed(1)}`).join(" L");
  const ax = v => hi - lo < 5 ? Math.round(v * 10) / 10 : Math.round(v);
  const ring = !trend && vals.indexOf(Math.max(...vals)) !== vals.length - 1;
  return `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tx("{caption}: von {from} auf {to} {unit}", {caption, from: fmt(Math.round(vals[0] * 10) / 10), to: fmt(Math.round(vals.at(-1) * 10) / 10), unit}))}">
    <line x1="${L}" x2="${W - R}" y1="${Y(hi)}" y2="${Y(hi)}" class="grid"/><line x1="${L}" x2="${W - R}" y1="${Y(lo)}" y2="${Y(lo)}" class="grid"/>
    <text x="${L - 6}" y="${Y(hi) + 4}" text-anchor="end">${fmt(ax(hi))}</text><text x="${L - 6}" y="${Y(lo) + 4}" text-anchor="end">${fmt(ax(lo))}</text>
    <text x="${L}" y="${H - 6}">${esc(labels[0])}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${esc(labels.at(-1))}</text>
    <line x1="${L}" x2="${W - R}" y1="${Y((hi + lo) / 2)}" y2="${Y((hi + lo) / 2)}" class="grid mid"/>
    ${trend ? `<path d="${path(trend)}" class="trend"/>` : ""}<path d="${path(vals)}"/>${vals.map((v, k) => `<circle cx="${X(k).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${k === vals.length - 1 ? 4.5 : 3}"${k === vals.length - 1 ? ' class="last"' : ""}/>`).join("")}
    ${(() => { const bi = vals.indexOf(Math.max(...vals)), lx = X(vals.length - 1), ly = Y(vals.at(-1));
      return (ring ? `<circle cx="${X(bi).toFixed(1)}" cy="${Y(vals[bi]).toFixed(1)}" r="6" class="best"/>` : "")
        + `<text x="${(lx - 8).toFixed(1)}" y="${(ly < T + 14 ? ly + 16 : ly - 9).toFixed(1)}" text-anchor="end" class="val">${fmt(Math.round(vals.at(-1) * 10) / 10)} ${esc(unit)}</text>`; })()}
  </svg><figcaption class="meta">${esc(caption)}${trend ? " · " + tx("gestrichelt: 7-Tage-Mittel") : ring ? " · " + tx("Ring: bisheriger Bestwert") : ""}</figcaption></figure>`;
}
const shortDate = iso => new Date(iso).toLocaleDateString(L(), {day: "numeric", month: "numeric"});
function exDetail(id) {
  const e = St.ex(id), bw = e.unit === "bw";
  const hist = D().sessions.filter(x => x.sets.some(y => y.exId === id && St.isWork(y))).map(x => {
    const sets = x.sets.filter(y => y.exId === id && St.isWork(y));
    const best = sets.reduce((m, y) => St.e1rm(y.kg, y.reps) > St.e1rm(m.kg, m.reps) ? y : m, sets[0]);
    return {date: x.date, best, e1: St.e1rm(best.kg, best.reps), reps: sets.reduce((a, y) => a + y.reps, 0), sets};
  });
  const pts = hist.slice(-12);
  // Bei Körpergewichtsübungen ohne Zusatzlast zählen die Wiederholungen, sonst das geschätzte 1RM (Epley)
  const useReps = noLoad(e) || (bw && pts.every(h => h.best.kg === 0)), rs = St.repShort(e);
  const svg = chart(pts.map(h => useReps ? h.reps : h.e1), pts.map(h => shortDate(h.date)), useReps ? rs : "kg",
    useReps ? tx("{word} gesamt pro Training", {word: St.repWord(e)}) : tx("Geschätztes 1RM (Epley) aus dem besten Satz"));
  return `${svg}<div class="table-wrap"><table><caption class="sr">${tx("Arbeitssätze pro Training")}</caption><thead><tr><th scope="col">${tx("Datum")}</th><th scope="col">${tx("Sätze")}</th><th scope="col" class="n">${useReps ? rs : tx("1RM ca.")}</th></tr></thead>
    <tbody>${[...pts].reverse().map(h => `<tr><td>${dateDe(h.date)}</td><td class="num">${h.sets.map(y => noLoad(e) ? `${y.reps}` : `${fmt(y.kg)}×${y.reps}`).join(", ")}</td><td class="n">${useReps ? h.reps : fmt(Math.round(h.e1 * 10) / 10) + " kg"}</td></tr>`).join("")}</tbody></table></div>
    ${iL(tx("Wie das 1RM geschätzt wird"), tx("1RM ca. = Gewicht × (1 + Wdh./30), Epley (1985). Steigt auch, wenn du bei gleichem Gewicht mehr Wiederholungen schaffst."))}`;
}
// Gewicht: eine Karte, die überall gleich aussieht und das Eintragen-Sheet öffnet
const dmd = k => new Date(k + "T12:00:00").toLocaleDateString(L(), {day: "numeric", month: "long"});
const dl = k => k === dkey() ? tx("heute") : k === shiftDay(dkey(), -1) ? tx("gestern") : tx("am {date}", {date: dmd(k)});
const dSince = k => k === dkey() ? tx("seit heute") : k === shiftDay(dkey(), -1) ? tx("seit gestern") : tx("seit dem {date}", {date: dmd(k)});
function weightCard() {
  const w = D().weights, today = dkey(), last = w.at(-1), done = last && last.date === today;
  const prev = done ? w.at(-2) : last, d = done && prev ? Math.round((last.kg - prev.kg) * 10) / 10 : null;
  return `<button type="button" class="card wcard" data-act="wopen" aria-haspopup="dialog">
    <span class="wl"><span class="eyebrow">${tx("Gewicht heute")}</span><b class="${done ? "num" : "nonum"}">${done ? `${fmt(last.kg)} kg` : tx("Noch nicht eingetragen")}</b>
      <small>${done ? (d != null ? `${d > 0 ? "+" : d < 0 ? "−" : "±"}${fmt(Math.abs(d))} kg ${dSince(prev.date)}` : tx("Erster Eintrag")) : last ? tx("Zuletzt {kg} kg, {when}", {kg: fmt(last.kg), when: dl(last.date)}) : tx("Am besten morgens, vor dem Frühstück")}</small></span>
    <span class="wbtn">${done ? tx("Ändern") : tx("Eintragen")}</span></button>`;
}
function openWeight(date) {
  const w = D().weights, k = date || dkey(), cur = w.find(x => x.date === k), base = cur ? cur.kg : St.currentWeight() || 70;
  ui.wkg = base; ui.wdate = k;
  openDialog(`<h2 id="dlg-h">${tx("Gewicht eintragen")}</h2>
    <p class="err" role="alert" hidden></p>
    <div class="stepper" role="group" aria-labelledby="w-l">
      <button type="button" data-act="wstep" data-d="-1" aria-label="${tx("100 Gramm weniger")}">−</button>
      <div class="val"><input id="wIn" class="v num" inputmode="decimal" autocomplete="off" enterkeyhint="done" value="${fmt(base)}"><label id="w-l" for="wIn" class="u">${tx("kg · antippen zum Eintippen")}</label></div>
      <button type="button" data-act="wstep" data-d="1" aria-label="${tx("100 Gramm mehr")}">+</button></div>
    <label class="field">${tx("Datum")} <input id="wDate" type="date" value="${k}" max="${dkey()}" min="2000-01-01"></label>
    <div class="dlg-actions"><button class="btn" data-act="close">${tx("Abbrechen")}</button><button class="btn primary" data-act="wsave">${tx("Speichern")}</button></div>
    ${w.length ? `<h3 class="meta" style="margin:16px 0 6px">${tx("Letzte Einträge")}</h3><ul class="logged">${w.slice(-7).reverse().map(x => `<li><span>${esc(dayLabel(x.date))}</span><span class="num">${fmt(x.kg)} kg <button type="button" class="linkbtn" data-act="wdel" data-d="${x.date}" aria-label="${esc(tx("Eintrag {day} löschen", {day: dayLabel(x.date)}))}">${tx("Löschen")}</button></span></li>`).join("")}</ul>` : ""}`, "#wIn");
}
function saveWeight() {
  const v = Math.round(num($("#wIn").value) * 10) / 10, k = $("#wDate").value || dkey();
  if (!(v >= 30 && v <= 300)) return dlgError(tx("Bitte ein Gewicht zwischen 30 und 300 kg eintragen."));
  if (k > dkey()) return dlgError(tx("Das Datum liegt in der Zukunft."));
  const w = D().weights, cur = w.find(x => x.date === k);
  if (cur) cur.kg = v; else w.push({date: k, kg: v});
  w.sort((a, b) => a.date.localeCompare(b.date));
  persist(); opener = null; closeDialog(); rerender(); say(tx("{kg} Kilo für {day} gespeichert.", {kg: fmt(v), day: dayLabel(k)}));
  const b = view.querySelector('[data-act="wopen"]'); if (b) b.focus();
}
function weightSection() {
  const w = D().weights.slice(-60);
  const avg = w.map((x, k) => { const from = new Date(x.date + "T12:00:00") - 6 * 864e5, win = w.slice(0, k + 1).filter(y => new Date(y.date + "T12:00:00") >= from); return win.reduce((a, y) => a + y.kg, 0) / win.length; });
  return `<h2 class="sec" style="margin-top:4px">${tx("Körpergewicht")}</h2>
    ${weightCard()}
    ${w.length >= 2 ? chart(w.map(x => x.kg), w.map(x => shortDate(x.date + "T12:00:00")), "kg", tx("Körpergewicht"), avg) : `<p class="meta">${tx("Wiege dich ein paar Mal pro Woche, am besten morgens. Nach zwei Einträgen erscheint hier der Verlauf mit Trend.")}</p>`}
    ${w.length >= 8 ? (() => { const d = avg.at(-1) - avg[Math.max(0, avg.length - 8)]; return `<p class="meta">${tx("Trend: {d} kg im Vergleich zu vor etwa einer Woche.", {d: (d > 0 ? "+" : d < 0 ? "−" : "±") + fmt(Math.abs(Math.round(d * 10) / 10))})}</p>`; })() : ""}`;
}
/* ---------- Körpermaße ---------- */
const ML = Object.fromEntries(MEASURES.map(m => [m.id, m]));
const mL = id => tx(ML[id].l), mHow = m => tx(m.how);
// Schematische Figur von vorn mit Messlinien. Die Figur zeigt dich wie im Spiegel: dein rechter Arm ist links im Bild.
function measureFig(on) {
  const line = m => { const r = m.w / 2, cx = m.x + r;
    return `<g class="ml${m.id === on ? " on" : ""}"><ellipse cx="${cx}" cy="${m.y}" rx="${r + 3}" ry="${m.side ? 3 : 4}"/></g>`; };
  return `<svg class="mfig" viewBox="0 0 200 420" role="img" aria-label="${on ? esc(tx("Messstelle {name}", {name: mL(on)})) : tx("Figur mit allen Messstellen")}">
    <g class="limb"><path d="M52 94 L40 150 L35 206"/><path d="M148 94 L160 150 L165 206"/><path d="M83 222 L79 302 L77 396"/><path d="M117 222 L121 302 L123 396"/></g>
    <g class="limb in"><path d="M52 94 L40 150 L35 206"/><path d="M148 94 L160 150 L165 206"/><path d="M83 222 L79 302 L77 396"/><path d="M117 222 L121 302 L123 396"/></g>
    <circle class="sk" cx="100" cy="34" r="20"/>
    <path class="sk" d="M91 50h18v24h-18z"/>
    <path class="sk" d="M70 76 Q100 68 130 76 L144 84 Q152 89 150 100 L142 138 Q137 153 133 164 Q141 184 140 204 L136 230 L64 230 L60 204 Q59 184 67 164 Q63 153 58 138 L50 100 Q48 89 56 84 Z"/>
    ${MEASURES.map(line).join("")}
  </svg>`;
}
function measureSection() {
  const ms = D().measures, last = ms.at(-1);
  const series = id => ms.filter(x => x.m[id] != null).map(x => ({date: x.date, v: x.m[id]}));
  const ids = MEASURES.map(m => m.id).filter(id => series(id).length);
  if (!ui.msel || !ids.includes(ui.msel)) ui.msel = ids.find(id => series(id).length >= 2) || ids[0];
  const card = `<button type="button" class="card wcard" data-act="mopen" aria-haspopup="dialog">
    <span class="wl"><span class="eyebrow">${tx("Letzte Messung")}</span><b>${last ? dl(last.date).replace(/^./, c => c.toUpperCase()) : tx("Noch nicht gemessen")}</b>
      <small>${last ? (St.daysSince(last.date + "T12:00:00") >= 14 ? tx("Zeit für eine neue Messung") : tx("Alle 2–4 Wochen messen reicht")) : tx("Maßband genügt. SATZ zeigt dir, wo du misst.")}</small></span>
    <span class="wbtn">${tx("Messen")}</span></button>`;
  if (!ids.length) return `<h2 class="sec">${tx("Körpermaße")}</h2>${card}`;
  const h = D().profile.height, waist = last && last.m.taille;
  const sel = series(ui.msel);
  return `<h2 class="sec">${tx("Körpermaße")}</h2>${card}
    <ul class="logged">${ids.map(id => { const sr = series(id), a = sr[0], b = sr.at(-1), d = Math.round((b.v - a.v) * 10) / 10;
      return `<li><span>${esc(mL(id))}</span><span class="num">${fmt(b.v)} cm${sr.length > 1 ? ` <small class="meta chg">${tx("{d} seit {date}", {d: (d > 0 ? "+" : d < 0 ? "−" : "±") + fmt(Math.abs(d)), date: shortDate(a.date + "T12:00:00")})}</small>` : ""}</span></li>`; }).join("")}</ul>
    ${h && waist ? (() => { const r = waist / h; return `<p class="meta" style="margin-top:6px">${tx("Taille ÷ Größe: {r}. Unter {limit} gilt als günstig für die Gesundheit (Ashwell et al. 2012).", {r: fmt(Math.round(r * 100) / 100), limit: fmt(0.5)})}</p>`; })() : ""}
    ${ids.length > 1 ? `<label class="field" style="margin-top:12px">${tx("Verlauf")} <select data-on="msel">${ids.map(id => `<option value="${id}" ${id === ui.msel ? "selected" : ""}>${esc(mL(id))}</option>`).join("")}</select></label>` : ""}
    ${sel.length >= 2 ? chart(sel.map(x => x.v), sel.map(x => shortDate(x.date + "T12:00:00")), "cm", mL(ui.msel)) : `<p class="meta">${tx("Nach der zweiten Messung erscheint hier der Verlauf.")}</p>`}`;
}
function openMeasures(date) {
  const k = date || dkey(), ms = D().measures, cur = ms.find(x => x.date === k), prev = [...ms].reverse().find(x => x.date !== k);
  ui.mdate = k;
  openDialog(`<h2 id="dlg-h">${tx("Körpermaße")}</h2>
    <div class="mwrap">${measureFig(MEASURES[0].id)}<p class="mhow" id="mhow" aria-live="polite"><b>${esc(mL(MEASURES[0].id))}:</b> ${esc(mHow(MEASURES[0]))}</p></div>
    <details class="mtips"><summary>${tx("So misst du richtig")}</summary><ul>
      <li>${tx("Morgens, vor dem Essen und vor dem Training, immer unter gleichen Bedingungen.")}</li>
      <li>${tx("Weiches Maßband direkt auf der Haut, waagerecht, anliegend, ohne einzuschneiden. Ein Spiegel hilft.")}</li>
      <li>${tx("Jede Stelle zweimal messen. Weichen die Werte um mehr als 0,5 cm ab, ein drittes Mal und den Mittelwert nehmen.")}</li>
      <li>${tx("Du musst nicht alles messen. Taille allein sagt schon viel.")}</li></ul></details>
    <p class="err" role="alert" hidden></p>
    <label class="field">${tx("Datum")} <input id="mDate" type="date" value="${k}" max="${dkey()}" min="2000-01-01"></label>
    <div class="mgrid">${MEASURES.map(m => `<label class="field">${esc(mL(m.id))}${m.side ? " " + tx("(rechts)") : ""}
      <input name="mval" data-m="${m.id}" inputmode="decimal" autocomplete="off" aria-describedby="mh-${m.id}" value="${cur && cur.m[m.id] != null ? fmt(cur.m[m.id]) : ""}" placeholder="${prev && prev.m[m.id] != null ? fmt(prev.m[m.id]) : "cm"}">
      <span class="sr" id="mh-${m.id}">${esc(mHow(m))}</span></label>`).join("")}</div>
    <p class="foot">${tx("Felder in cm. Grau steht dein letzter Wert, leere Felder bleiben leer. Die Figur schaut dich an: Dein rechter Arm und dein rechtes Bein sind links im Bild.")}</p>
    <div class="dlg-actions"><button class="btn" data-act="close">${tx("Abbrechen")}</button><button class="btn primary" data-act="msave">${tx("Speichern")}</button></div>
    ${ms.length ? `<h3 class="meta" style="margin:16px 0 6px">${tx("Frühere Messungen")}</h3><ul class="logged">${ms.slice(-6).reverse().map(x => `<li><span>${esc(dayLabel(x.date))}</span><span class="num">${txn(Object.keys(x.m).length, "{n} Maß", "{n} Maße")} <button type="button" class="linkbtn" data-act="mdel" data-d="${x.date}" aria-label="${esc(tx("Messung {day} löschen", {day: dayLabel(x.date)}))}">${tx("Löschen")}</button></span></li>`).join("")}</ul>` : ""}`, '[name="mval"]');
}
function saveMeasures() {
  const k = $("#mDate").value || dkey();
  if (k > dkey()) return dlgError(tx("Das Datum liegt in der Zukunft."));
  const vals = {};
  for (const inp of dlg.querySelectorAll('input[name="mval"]')) {
    if (!inp.value.trim()) continue;
    const v = Math.round(num(inp.value) * 10) / 10;
    if (!(v >= 10 && v <= 250)) { inp.focus(); return dlgError(tx("{name}: bitte einen Wert zwischen 10 und 250 cm eintragen.", {name: mL(inp.dataset.m)})); }
    vals[inp.dataset.m] = v;
  }
  if (!Object.keys(vals).length) return dlgError(tx("Trag mindestens ein Maß ein."));
  const ms = D().measures, cur = ms.find(x => x.date === k), snap = St.snapshot();
  if (cur) cur.m = vals; else ms.push({date: k, m: vals});
  ms.sort((a, b) => a.date.localeCompare(b.date));
  persist(); opener = null; closeDialog(); rerender();
  toast(txn(Object.keys(vals).length, "{n} Maß {when} gespeichert.", "{n} Maße {when} gespeichert.", {when: dl(k)}), () => { St.restore(snap); rerender(); });
  const b = view.querySelector('[data-act="mopen"]'); if (b) b.focus();
}
// Fokus auf ein Feld zeigt die passende Messstelle in der Figur
document.addEventListener("focusin", ev => {
  const inp = ev.target.closest && ev.target.closest('input[name="mval"]'); if (!inp) return;
  const m = ML[inp.dataset.m], fig = dlg.querySelector(".mfig"), how = $("#mhow"); if (!fig || !how) return;
  fig.outerHTML = measureFig(m.id); how.innerHTML = `<b>${esc(mL(m.id))}:</b> ${esc(mHow(m))}`;
});

function openSessionEdit(id) {
  const x = D().sessions.find(y => y.id === id); if (!x) return;
  ui.sedit = id;
  openDialog(`<h2 id="dlg-h">${tx("Training korrigieren")}</h2><p class="meta" style="text-align:center;margin-top:-10px">${dateDe(x.date)} · ${esc(lib(x.dayName))}</p>
    <p class="err" role="alert" hidden></p>
    <ol class="edlist">${x.sets.map((y, k) => `<li><div class="edrow"><span class="t">${esc(exName(St.ex(y.exId)))}${y.type === "warm" ? " · " + tx("Aufwärmen") : y.type === "drop" ? " · " + tx("Drop") : ""}</span>
      <label class="check" style="min-height:44px"><input type="checkbox" name="sdel" value="${k}">${tx("löschen")}</label></div>
      <div class="pair"><label class="field">kg <input name="skg" data-k="${k}" inputmode="decimal" value="${fmt(y.kg)}"></label><label class="field">${tx("Wdh.")} <input name="sreps" data-k="${k}" inputmode="numeric" value="${y.reps}"></label></div></li>`).join("")}</ol>
    <div class="dlg-actions" style="margin-top:12px"><button class="btn" data-act="close">${tx("Abbrechen")}</button><button class="btn primary" data-act="sesssave">${tx("Speichern")}</button></div>`, "h2");
}
function saveSessionEdit() {
  const x = D().sessions.find(y => y.id === ui.sedit), snap = St.snapshot();
  const del = new Set([...dlg.querySelectorAll('input[name="sdel"]:checked')].map(c => +c.value));
  for (const inp of dlg.querySelectorAll('input[name="skg"],input[name="sreps"]')) {
    const v = parseFloat(inp.value.replace(",", ".")), k = +inp.dataset.k;
    if (!isFinite(v) || v < 0 || (inp.name === "skg" ? v > 1000 : v > 100)) { inp.focus(); return dlgError(tx("Bitte prüfe die markierten Werte: Gewicht 0–1000 kg, Wiederholungen 0–100.")); }
    x.sets[k][inp.name === "skg" ? "kg" : "reps"] = inp.name === "skg" ? Math.round(v * 100) / 100 : Math.round(v);
  }
  x.sets = x.sets.filter((y, k) => !del.has(k));
  if (!x.sets.length) D().sessions = D().sessions.filter(y => y.id !== x.id);
  persist(); closeDialog(); rerender(); toast(tx("Training korrigiert. Die Vorschläge nutzen die neuen Werte."), () => { St.restore(snap); rerender(); });
}

/* ============ Mehr ============ */
// Mehr (ab 0.9.12): kurze Liste wie in den iPhone-Einstellungen, jede Gruppe hat eine eigene Unterseite (#/mehr/<sub>).
// Die Sprache hat eine eigene Zeile ganz oben.
const MORE_PAGES = [
  // Der Untertitel nennt immer auch das Wort in einer zweiten Sprache, damit man die Zeile findet, wenn man die eingestellte nicht lesen kann
  ["sprache", "Sprache", () => { const l = I.LANGS.find(x => x.id === I.lang()); return `${l ? l.name : ""} · ${I.lang() === "en" ? "Sprache" : "Language"}`; }],
  ["profil", "Persönliche Daten", () => { const pr = D().profile, y = N.age(pr.birth), kg = St.currentWeight(); return [y != null ? tx("{n} Jahre", {n: y}) : "", pr.height ? `${pr.height} cm` : "", kg ? `${fmt(kg)} kg` : ""].filter(Boolean).join(" · ") || tx("Für deinen Bedarf unter Ernährung"); }],
  ["anzeige", "Darstellung", () => { const s = D().settings, a = ACCENTS.find(x => x[0] === s.accent); return [a ? tx(a[1]) : "", tx({auto: "Automatisch", light: "Hell", dark: "Dunkel"}[s.theme] || "")].filter(Boolean).join(" · "); }],
  ["training", "Training", () => { const s = D().settings; return [s.sound ? tx("Glocke an") : tx("Glocke aus"), s.rir ? tx("RIR an") : tx("RIR aus"), s.rest ? tx("Pause {n} s", {n: s.rest}) : tx("Pause automatisch")].join(" · "); }],
  ["erinnerung", "Erinnerung im Kalender", () => tx("Trainingstage als Termin")],
  ["daten", "Deine Daten", () => { const s = D().settings; return s.lastBackup ? txn(St.daysSince(s.lastBackup), "Letzte Sicherung vor {n} Tag", "Letzte Sicherung vor {n} Tagen") : tx("Noch keine Sicherung"); }],
  ["ueber", "Über SATZ", () => tx("Version {v} · Quellen", {v: APP_VERSION})],
]; // Titel stehen im Prüfskript unter DYNAMIC
const dropH2 = html => html.replace(/^\s*<h2 class="sec"[^>]*>[^<]*<\/h2>/, "");
function viewMore(sub) {
  const s = D().settings;
  const seg = (key, opts) => `<div class="seg" role="group">${opts.map(([v, l, aria]) => `<button type="button" data-act="set" data-k="${key}" data-v="${v}" aria-pressed="${String(s[key]) === String(v)}" ${aria ? `aria-label="${aria}"` : ""}>${l}</button>`).join("")}</div>`;
  const since = s.lastBackup ? St.daysSince(s.lastBackup) : 0;
  const page = MORE_PAGES.find(x => x[0] === sub);
  if (!page) {
    view.innerHTML = `<h1 class="big">${tx("Mehr")}</h1>
    <ul class="group morelist">${MORE_PAGES.map(([id, l, sum]) => `<li><a class="row morerow" href="#/mehr/${id}"><span>${tx(l)}<small>${esc(sum())}</small></span>${id === "daten" && backupDue() ? `<span class="dotbadge"><span class="sr">${tx("Sicherung empfohlen")}</span></span>` : ""}<span class="chev" aria-hidden="true">›</span></a></li>`).join("")}</ul>
    <div style="height:24px"></div>`;
    return;
  }
  const body = {
    sprache: () => langPage(),
    profil: () => dropH2(profileSection()),
    anzeige: () => `
    <div class="group">
      ${accentRow()}
      <div class="row stack"><span id="l-scale">${tx("Textgröße")}</span>${seg("scale", [[1, "iPhone", tx("Wie in den iPhone-Einstellungen")], [1.15, "A+", tx("Groß")], [1.3, "A++", tx("Sehr groß")], [1.5, "A+++", tx("Riesig")]]).replace('role="group"', 'role="group" aria-labelledby="l-scale"')}</div>
      <div class="row stack"><span id="l-theme">${tx("Erscheinungsbild")}</span>${seg("theme", [["auto", tx("Automatisch")], ["light", tx("Hell")], ["dark", tx("Dunkel")]]).replace('role="group"', 'role="group" aria-labelledby="l-theme"')}</div>
      <label class="row" for="s-contrast"><span>${tx("Kontrast erhöhen")}</span><input id="s-contrast" class="switch" type="checkbox" role="switch" data-on="contrast" ${s.contrast ? "checked" : ""}></label>
    </div>
    ${iL(tx("Textgröße „iPhone“"), tx("„iPhone“ übernimmt die Textgröße aus Einstellungen → Anzeige &amp; Helligkeit."))}
`,
    training: () => `
    <div class="group">
      <label class="row" for="s-rir"><span>${tx("„Wdh. in Reserve“ abfragen")}</span><input id="s-rir" class="switch" type="checkbox" role="switch" data-on="rir" ${s.rir ? "checked" : ""}></label>
      <label class="row" for="s-sound"><span>${tx("Ringglocke am Pausenende")}</span><input id="s-sound" class="switch" type="checkbox" role="switch" data-on="sound" ${s.sound ? "checked" : ""}></label>
      <label class="row" for="s-voice"><span>${tx("Ansage „Next Round“")}</span><input id="s-voice" class="switch" type="checkbox" role="switch" data-on="voice" ${s.voice !== false ? "checked" : ""} ${s.sound ? "" : "disabled"}></label>
      <label class="row" for="s-bg"><span>${tx("Auch im Hintergrund läuten")}<small class="meta" style="display:block">${tx("Pausiert Spotify und andere Musik in jeder Pause")}</small></span><input id="s-bg" class="switch" type="checkbox" role="switch" data-on="bgbell" ${s.bgBell ? "checked" : ""} ${s.sound ? "" : "disabled"}></label>
      <div class="row"><span>${tx("Probe hören")}<small class="meta" style="display:block">${BELL.canMix() ? tx("Mischt sich mit Musik") : tx("Dieses iOS kann Töne nicht mit Musik mischen")}</small></span><button type="button" class="btn small" data-act="bellpreview" style="width:auto">${tx("Abspielen")}</button></div>
      <label class="row" for="s-fig"><span>${tx("Ausführung im Training zeigen")}</span><input id="s-fig" class="switch" type="checkbox" role="switch" data-on="showfig" ${s.showFig !== false ? "checked" : ""}></label>
    </div>
    ${iL(tx("Glocke, Ansage und Hintergrund"), tx("Die Glocke mischt sich mit deiner Musik und kommt nur, wenn der Stummschalter nicht auf lautlos steht. Die Ansage spricht eine englische Stimme deines Geräts, nur solange SATZ offen ist. „Auch im Hintergrund läuten“ spielt die Pause wie Musik ab: Die Glocke kommt dann auch bei gesperrtem Bildschirm oder in einer anderen App, aber iOS pausiert dafür deine Musik, und du musst sie danach selbst wieder starten. Wer Musik hört, lässt es aus. Während des Trainings bleibt der Bildschirm an."))}
    <label class="field" style="margin-top:16px">${tx("Standardpause")} <select data-on="rest">
      <option value="0" ${!s.rest ? "selected" : ""}>${tx("Automatisch (schwere Grundübungen 180 s, andere 120 s, Isolation 90 s)")}</option>
      ${[60, 90, 120, 180].map(r => `<option value="${r}" ${s.rest === r ? "selected" : ""}>${tx("{n} s für alle", {n: r})}</option>`).join("")}</select></label>
`,
    erinnerung: () => dropH2(remindSection()),
    daten: () => `
    ${recoveredNote()}
    <p>${tx("Alles bleibt auf diesem Gerät. Es gibt kein Konto und keinen Server. Sichere deine Daten ab und zu als Datei, besonders vor einem Handywechsel.")}</p>
    <p class="meta">${s.lastBackup ? txn(since, "Letzte Sicherung: {date} (vor {n} Tag).", "Letzte Sicherung: {date} (vor {n} Tagen).", {date: new Date(s.lastBackup).toLocaleDateString(L())}) : tx("Noch keine Sicherung erstellt.")}</p>
    <button class="btn" data-act="export">${tx("Daten als Datei sichern")}</button>
    <button class="btn" data-act="import">${tx("Sicherung laden")}</button>
    <input type="file" id="importFile" accept="application/json,.json" hidden>
    <p class="err" id="importErr" role="alert" hidden></p>
    ${updateBackupRow()}
    <button class="btn destructive" data-act="reset">${tx("Alle Daten löschen")}</button>
`,
    ueber: () => `
    <p class="meta">${tx("Ernährung: Grundumsatz nach Mifflin-St Jeor (Mifflin et al. 1990), Aktivitätsfaktoren nach FAO/WHO/UNU 2004, Protein 1,6–2,0 g/kg (Morton et al. 2018; Helms et al. 2014). Alle Schritte und Quellen siehst du unter Ernährung → Ziel. Barcode-Erkennung mit ZXing (Apache-2.0), Produktdaten von Open Food Facts (ODbL).")}</p>
    <p class="meta">${tx("3D-Körperkarte mit three.js (MIT). Figur und Bewegungsabläufe sind selbst gezeichnete Schemata: ähnliche Übungen teilen sich eine Bewegungsvorlage, eigene Übungen bekommen die Vorlage ihres Hauptmuskels.")}</p>
    <p class="meta">${tx("Die Regeln hinter der App: Doppelte Progression (Plotkin et al. 2022), etwa 10–20 Sätze pro Muskel und Woche (Schoenfeld et al. 2017; Pelland et al. 2026, mitarbeitende Muskeln als halber Satz), Pausen nach Übungsart: 180 s bei schweren Grundübungen bis 8 Wdh., sonst 120 s bzw. 90 s (Schoenfeld et al. 2016; Grgic et al. 2018; Singer et al. 2024), Entlastung bei Plateau (Bell et al. 2023), nach über 14 Tagen Pause 90 % als vorsichtige Faustregel (Bosquet et al. 2013), optionale RIR-Angabe (Zourdos et al. 2016). Keine Tagesserien, kein Zwang: gezählt werden Wochen mit erreichtem Wochenziel, Pausenwochen unterbrechen nichts. Gewohnheiten brauchen Zeit, ein verpasster Tag schadet nicht (Lally et al. 2010). Dehnen 30–45 s pro Position (ACSM 2021), zählt nicht zum Volumen.")}</p>
    <p class="meta">${tx("Abgleich mit dem ACSM Position Stand 2026 zum Krafttraining (137 Übersichtsarbeiten): Kraft wächst am besten mit schweren Lasten um 80 % des 1RM und 2–3 Sätzen pro Übung, Muskelaufbau mit etwa 10 oder mehr Sätzen pro Muskel und Woche, Schnellkraft mit 30–70 % des 1RM und schneller Bewegung. Regelmäßigkeit zählt mehr als Training bis zum Versagen, Gerätewahl oder ausgefeilte Periodisierung. Darum fragt SATZ nach Wdh. in Reserve statt nach Versagen, und die Entlastungswoche ist eine Option, kein Muss.")}</p>
    <p class="meta">${tx("Version {v} · Daten-Version {d}", {v: APP_VERSION, d: St.VERSION})}</p>`,
  }[sub]();
  view.innerHTML = `<h1 class="big">${tx(page[1])}</h1>${body}<div style="height:24px"></div>`;
}
// Sprache: Liste wie bei der ersten Auswahl, jede Sprache in ihrem eigenen Namen. Antippen stellt sofort um.
function langPage() {
  const cur = I.lang();
  const nameIn = id => { try { const n = new Intl.DisplayNames([cur], {type: "language"}).of(id); return n && n.toLowerCase() !== I.LANGS.find(l => l.id === id).name.toLowerCase() ? n[0].toUpperCase() + n.slice(1) : ""; } catch (e) { return ""; } };
  return `<ul class="langlist" role="radiogroup" aria-label="${tx("Sprache")}" style="margin-top:8px">${I.LANGS.map(l => `<li><button type="button" role="radio" lang="${l.id}" data-act="setlang" data-v="${l.id}" aria-checked="${l.id === cur}">
      <span>${esc(l.name)}${l.id !== cur && nameIn(l.id) ? `<small lang="${cur}">${esc(nameIn(l.id))}</small>` : ""}</span><svg class="chk" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></li>`).join("")}</ul>
    <p class="foot">${tx("Gilt für Menüs, Hinweise und die mitgelieferten Übungen. Namen, die du selbst vergeben hast, bleiben, wie du sie geschrieben hast.")}</p>`;
}

// Erinnerung über den Kalender: SATZ erzeugt einen wiederkehrenden Termin (.ics). Kein Server, keine Push-Nachrichten nötig.
function remindCfg() {
  const r = D().settings.remind;
  return r ? {...r, days: [...r.days]} : {days: St.trainDays(), time: "18:00", before: 15};
}
function remindSection() {
  const r = remindCfg();
  return `<h2 class="sec">${tx("Erinnerung im Kalender")}</h2>
    <p>${tx("Lege deine Trainingstage als wiederkehrenden Termin in deinen Kalender. Der Kalender erinnert dich, auch wenn SATZ geschlossen ist.")}</p>
    <fieldset><legend>${tx("Tage")}</legend><div class="chips" role="group">${WD().map((w, i) => `<button type="button" class="chip daychip" data-act="icsday" data-d="${i}" aria-pressed="${r.days.includes(i)}" aria-label="${WDL()[i]}">${w}</button>`).join("")}</div></fieldset>
    <div class="pair"><label class="field">${tx("Uhrzeit")} <input type="time" data-on="icstime" value="${r.time}"></label>
      <label class="field">${tx("Erinnerung")} <select data-on="icsbefore">${[[0, "Zur Startzeit"], [15, "15 Min. vorher"], [30, "30 Min. vorher"], [60, "1 Std. vorher"]].map(([v, l]) => `<option value="${v}" ${r.before === v ? "selected" : ""}>${tx(l)}</option>`).join("")}</select></label></div>
    <button class="btn" data-act="icsdl" ${r.days.length ? "" : "disabled"}>${tx("Kalenderdatei laden")}</button>
    ${iL(tx("So kommt der Termin in den Kalender"), tx("Auf dem iPhone die Datei öffnen und „Alle hinzufügen“ tippen. Ändern oder löschen kannst du den Termin später direkt im Kalender. Eine neue Datei legt einen zweiten Termin an."))}`;
}
function downloadIcs() {
  const r = remindCfg(); if (!r.days.length) return toast(tx("Wähle mindestens einen Tag."));
  const p = St.activePlan(), d = p && p.days[St.nextDayIndex(p)];
  const minutes = d ? d.slots.reduce((a, sl) => a + sl.sets * (St.restFor(sl) + 45), 0) / 60 : 60;
  const txt = St.icsFor({days: r.days, time: r.time, before: r.before, minutes, title: p ? tx("Training: {name}", {name: lib(p.name)}) : tx("Training"), url: location.origin + location.pathname});
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], {type: "text/calendar"}));
  a.download = "satz-training.ics"; document.body.append(a); a.click(); a.remove();
  D().settings.remind = r; persist();
  say(tx("Kalenderdatei erstellt."));
}

// Vor jedem App-Update legt SATZ den alten Stand automatisch beiseite (die letzten 3).
function updateBackupRow() {
  const keys = St.updateBackups(); if (!keys.length) return "";
  const k = keys[0]; let b = {}; try { b = JSON.parse(localStorage.getItem(k)); } catch (e) {}
  let n = 0; try { n = JSON.parse(b.raw).sessions.length; } catch (e) {}
  return `<p class="meta">${txn(n, "Automatisch gesichert vor dem Update auf {v}: {n} Training vom {date}. Falls nach einem Update etwas fehlt, holst du hier den alten Stand zurück.", "Automatisch gesichert vor dem Update auf {v}: {n} Trainings vom {date}. Falls nach einem Update etwas fehlt, holst du hier den alten Stand zurück.", {v: esc(b.to || ""), date: new Date(k.slice(-19)).toLocaleDateString(L())})}</p>
    <button class="btn" data-act="updrestore" data-k="${esc(k)}">${tx("Stand vor dem Update wiederherstellen")}</button>`;
}
function recoveredNote() {
  const keys = St.corruptKeys();
  if (!keys.length && !St.recovered) return "";
  return `<div class="note" role="alert"><b>${tx("Alte Daten beiseitegelegt.")}</b> ${tx("Beim Start ließen sich gespeicherte Daten nicht lesen ({reason}). Sie wurden nicht überschrieben. Lade sie als Datei herunter und schick sie mir, dann rette ich sie.", {reason: esc(tx(St.recovered ? St.recovered.reason : "früherer Start"))})}
    <div class="row-btns"><button class="btn small" data-act="dlcorrupt">${tx("Gesicherte Daten herunterladen")}</button>${keys.length ? `<button class="btn small destructive" data-act="delcorrupt">${tx("Verwerfen")}</button>` : ""}</div></div>`;
}
function backupDue() {
  const s = D().settings;
  return D().sessions.length >= 3 && (!s.lastBackup || St.daysSince(s.lastBackup) >= 14) && !(s.backupSnooze && St.daysSince(s.backupSnooze) < 7);
}

/* ============ Aktionen ============ */
const A = {
  exmore: () => openExMore(),
  exm: t => { const f = A[t.dataset.a]; opener = null; dlg.close(); if (f) f(t); },
  info: t => { const h = INFOS[t.dataset.t]; if (h == null) return;
    openDialog(`<h2 id="dlg-h">${esc(t.dataset.t)}</h2><div class="infotext">${/^\s*</.test(h) ? h : `<p>${h}</p>`}</div><div class="dlg-actions"><button class="btn" data-act="close">${tx("Fertig")}</button></div>`, "#dlg-h"); },
  close: () => closeDialog(),
  setlang: t => { const id = t.dataset.v; if (id === I.lang()) return; D().settings.lang = id; persist(); applyLang(); route(); const b = view.querySelector(`[data-act="setlang"][data-v="${id}"]`); if (b) b.focus(); say(tx("Sprache: {name}.", {name: I.LANGS.find(l => l.id === id).name})); },
  pickday: t => { ui.day = +t.dataset.i; rerender(`[data-act="pickday"][data-i="${ui.day}"]`); },
  start: t => { if (D().active) return go("#/training"); const p = St.activePlan(); St.startSession(p, +t.dataset.i); ui.summary = false; ui.key = ""; ui.day = null; go("#/training"); say(tx("Training gestartet: {name}.", {name: lib(p.days[+t.dataset.i].name)})); },
  adopt: t => {
    const tpl = TEMPLATES.find(x => x.id === t.dataset.id), p = St.instantiate(tpl);
    D().plans.push(p); D().activePlanId = p.id; persist(); ui.day = null;
    go("#/heute"); toast(tx("„{name}“ übernommen und aktiviert.", {name: lib(p.name)}));
  },
  newplan: () => {
    const p = {id: St.uid(), name: tx("Mein Plan"), perWeek: 3, cycle: {weeks: St.DEFAULT_CYCLE, start: dkey()}, days: [{id: St.uid(), name: tx("Tag {n}", {n: 1}), slots: []}]};
    D().plans.push(p); if (!D().activePlanId) D().activePlanId = p.id; persist(); ui.eday = 0; go(`#/plan/${p.id}`);
  },
  activate: t => { D().activePlanId = t.dataset.id; ui.day = null; persist(); rerender(); say(tx("{name} ist jetzt aktiv.", {name: lib(St.plan(t.dataset.id).name)})); view.querySelector("h1").focus(); },
  copyplan: t => {
    const c = JSON.parse(JSON.stringify(St.plan(t.dataset.id)));
    c.id = St.uid(); c.name = lib(c.name) + " " + tx("(Kopie)"); c.days.forEach(d => { d.id = St.uid(); d.slots.forEach(s => s.id = St.uid()); });
    D().plans.push(c); persist(); rerender(); toast(tx("Kopie „{name}“ angelegt.", {name: c.name}));
  },
  delplan: t => {
    const snap = St.snapshot(), p = St.plan(t.dataset.id);
    D().plans = D().plans.filter(x => x.id !== p.id);
    if (D().activePlanId === p.id) D().activePlanId = D().plans[0]?.id || null;
    persist(); rerender(); view.querySelector("h1").focus();
    toast(tx("„{name}“ gelöscht. Deine Trainings bleiben im Verlauf.", {name: lib(p.name)}), () => { St.restore(snap); rerender(); });
  },
  cyclerestart: () => { const p = curPlan(); p.cycle = {weeks: p.cycle.weeks, start: dkey()}; persist(); rerender('[data-on="cycleweeks"]'); say(tx("Rhythmus neu gestartet: Woche 1, Aufbau.")); },
  deloadnow: () => { const p = curPlan(); p.cycle = {weeks: p.cycle.weeks, start: shiftDay(dkey(), -(p.cycle.weeks - 1) * 7)}; persist(); rerender('[data-act="cyclerestart"]'); say(tx("Diese Woche ist jetzt Entlastungswoche.")); },
  perweek: t => { const p = curPlan(); p.perWeek = Math.min(7, Math.max(1, p.perWeek + +t.dataset.d)); persist(); rerender(`[data-act="perweek"][data-d="${t.dataset.d}"]`); },
  eday: t => { ui.eday = +t.dataset.i; rerender(`[data-act="eday"][data-i="${ui.eday}"]`); },
  addday: () => { const p = curPlan(); p.days.push({id: St.uid(), name: tx("Tag {n}", {n: p.days.length + 1}), slots: []}); ui.eday = p.days.length - 1; persist(); rerender('[data-on="dname"]'); view.querySelector('[data-on="dname"]').select(); say(tx("Tag {n} hinzugefügt. Gib ihm einen Namen.", {n: ui.eday + 1})); },
  delday: () => {
    const p = curPlan(), snap = St.snapshot(), name = p.days[ui.eday].name;
    p.days.splice(ui.eday, 1); ui.eday = Math.max(0, ui.eday - 1); persist(); rerender(); view.querySelector("h1").focus();
    toast(tx("Tag „{name}“ gelöscht.", {name}), () => { St.restore(snap); rerender(); });
  },
  mv: t => {
    const d = curPlan().days[ui.eday], i = +t.dataset.i, j = i + +t.dataset.d;
    [d.slots[i], d.slots[j]] = [d.slots[j], d.slots[i]]; persist();
    rerender(); const same = view.querySelector(`[data-act="mv"][data-i="${j}"][data-d="${t.dataset.d}"]`);
    (same && !same.disabled ? same : view.querySelector(`[data-act="mv"][data-i="${j}"]:not(:disabled)`)).focus();
    say(tx("{name}: Position {n} von {m}.", {name: exName(St.ex(d.slots[j].exId)), n: j + 1, m: d.slots.length}));
  },
  delslot: t => {
    const d = curPlan().days[ui.eday], snap = St.snapshot(), sl = d.slots.splice(+t.dataset.i, 1)[0];
    persist(); rerender("#addslot");
    toast(tx("{name} entfernt.", {name: exName(St.ex(sl.exId))}), () => { St.restore(snap); rerender(); });
  },
  slot: t => { ui.draft = {...curPlan().days[ui.eday].slots[+t.dataset.i]}; ui.draftNew = false; openSlot(); },
  slotsave: () => saveSlot(),
  addslot: () => openPicker(exId => { ui.draft = {id: St.uid(), exId, ...slotDefault(St.ex(exId))}; ui.draftNew = true; openSlot(); }),
  // Beim Tausch in eine andere Einheit (z. B. Wdh. → Sekunden) passt das Satzschema nicht mehr: dann das Standardschema der neuen Übung
  swap: () => { const keep = ui.draft, from = St.ex(keep.exId); openPicker(exId => { ui.draft = {...keep, exId, ...swapScheme(keep, from, St.ex(exId))}; openSlot(); }, keep.exId); },
  // Direkt aus der Liste im Plan-Editor tauschen (dauerhaft im Plan). Gespeicherte Trainings bleiben unberührt.
  swapslot: t => { const d = curPlan().days[ui.eday], i = +t.dataset.i, sl = d.slots[i], from = St.ex(sl.exId);
    openPicker(exId => { opener = null; closeDialog(); if (exId === sl.exId) return rerender(`[data-act="swapslot"][data-i="${i}"]`);
      const snap = St.snapshot(), to = St.ex(exId);
      d.slots[i] = {...sl, exId, ...swapScheme(sl, from, to)}; persist(); rerender(`[data-act="swapslot"][data-i="${i}"]`);
      toast(tx("{from} durch {to} ersetzt.", {from: exName(from), to: exName(to)}) + (sameScheme(from, to) ? "" : " " + tx("Satzschema angepasst.")), () => { St.restore(snap); rerender(); });
    }, sl.exId); },
  // Im Training nur für heute tauschen. Schon eingetragene Sätze bleiben bei der alten Übung,
  // die restlichen Sätze laufen als eigene Zeile mit der neuen Übung weiter.
  swapex: () => { const a = D().active, i = a.idx, it = a.queue[i], from = St.ex(it.exId);
    openPicker(exId => { opener = null; closeDialog(); if (exId !== it.exId) swapToday(a, i, exId); view.querySelector("h1").focus(); }, it.exId); },
  pick: t => { const cb = pickCb; pickCb = null; cb(t.dataset.id); },
  newex: () => { const cb = pickCb; openExForm(null, ui.pq.trim(), id => { pickCb = null; cb(id); }); },
  newexlist: () => openExForm(null, ""),
  editex: t => openExForm(t.dataset.id),
  exsave: () => saveEx(),
  exdel: () => {
    const e = D().exercises[ui.exEdit], snap = St.snapshot();
    e.archived = true; persist(); closeDialog(); rerender();
    toast(tx("{name} archiviert. Der Verlauf bleibt erhalten.", {name: exName(e)}), () => { St.restore(snap); rerender(); });
  },
  /* Training */
  kg: t => { readSetInputs(); const a = D().active, e = St.ex(a.queue[a.idx].exId); ui.kg = Math.max(0, Math.round((ui.kg + e.step * +t.dataset.d) * 100) / 100); $("#kgIn").value = fmt(ui.kg); syncCur(); sayLater(tx("{n} Kilo", {n: fmt(ui.kg)})); },
  reps: t => { readSetInputs(); const e = St.ex(D().active.queue[D().active.idx].exId), d = e.unit === "s" ? 5 : 1;
    ui.reps = Math.max(0, Math.min(100, ui.reps + d * +t.dataset.d)); $("#repsIn").value = ui.reps; syncCur(); sayLater(`${ui.reps} ${St.repWord(e)}`); },
  stype: t => { readSetInputs(); ui.stype = t.dataset.v; rerender(`[data-act="stype"][data-v="${t.dataset.v}"]`); },
  note: () => {
    const a = D().active, exId = a.queue[a.idx].exId, cur = (a.notes || {})[exId] || "";
    openDialog(`<h2 id="dlg-h">${tx("Notiz:")} ${esc(exName(St.ex(exId)))}</h2>
      <label class="field">${tx("Zum Beispiel Sitzhöhe, Griff oder wie es lief")} <textarea id="noteIn" rows="4" maxlength="500">${esc(cur)}</textarea></label>
      <div class="dlg-actions"><button class="btn" data-act="close">${tx("Abbrechen")}</button><button class="btn primary" data-act="notesave">${tx("Speichern")}</button></div>`, "#noteIn");
  },
  notesave: () => {
    const a = D().active, exId = a.queue[a.idx].exId, v = $("#noteIn").value.trim();
    a.notes = a.notes || {}; if (v) a.notes[exId] = v; else delete a.notes[exId];
    persist(); closeDialog(); readSetInputs(); rerender(); say(v ? tx("Notiz gespeichert.") : tx("Notiz gelöscht."));
  },
  rir: t => { const v = +t.dataset.v; ui.rir = ui.rir === v ? null : v; rerenderKeep(t); },
  saveset: () => saveSet(),
  undoset: () => {
    const a = D().active, i = a.idx, k = a.sets.map(s => s.q).lastIndexOf(i);
    if (k < 0) return;
    const s = a.sets.splice(k, 1)[0]; a.restEnd = 0; persist();
    ui.key = `${a.id}:${i}:${St.workFor(a, i).length}`; ui.rir = s.rir; ui.kg = s.kg; ui.reps = s.reps; rerender("#saveset"); say(tx("Letzter Satz gelöscht. Werte zum Korrigieren übernommen."));
  },
  rampgo: t => { readSetInputs(); ui.mode = "ramp"; ui.rampKg = +t.dataset.kg; ui.stype = "warm"; ui.key = ui.key.replace(/:\d+:\d+$/, ":x:x"); rerender("#saveset"); say(tx("Aufwärmrampe übernommen. Speichern trägt jeweils den nächsten Aufwärmsatz ein.")); },
  rampskip: () => { const a = D().active; ui.mode = null; ui.stype = "work"; ui.kg = ui.rampKg; ui.reps = St.suggest(a.queue[a.idx]).reps; rerender("#saveset"); },
  findskip: () => { readSetInputs(); ui.mode = null; ui.stype = "work"; ui.found = ui.kg; rerender("#saveset"); say(tx("Arbeitssätze mit {w}.", {w: St.fmtW(St.ex(D().active.queue[D().active.idx].exId), ui.kg)})); },
  warmset: () => { readSetInputs(); ui.stype = "warm"; rerender("#saveset"); say(tx("Aufwärmsatz. Gewicht und Wiederholungen einstellen, dann speichern.")); },
  dropset: () => { readSetInputs(); ui.stype = "drop"; rerender("#saveset"); say(tx("Drop-Satz. Gewicht und Wiederholungen einstellen, dann speichern.")); },
  exfig: () => { const e = St.ex(D().active.queue[D().active.idx].exId); openDialog(`<h2 id="dlg-h">${esc(exName(e))}</h2>${exFigure(e)}<div class="dlg-actions"><button class="btn" data-act="close">${tx("Fertig")}</button></div>`, "#dlg-h"); },
  adddrop: () => { const a = D().active; ui.pin = a.idx; ui.addAfter = true; ui.stype = "drop"; rerender("#saveset"); say(tx("Drop-Satz anhängen. Gewicht und Wiederholungen einstellen, dann speichern.")); },
  extraless: () => { const a = D().active, it = a.queue[a.idx]; if (it.extra < 1 || St.workFor(a, a.idx).length >= St.targetSets(it)) return; it.extra--; persist(); rerender("#saveset"); say(tx("Extra-Satz entfernt. Jetzt {n} Sätze.", {n: St.targetSets(it)})); },
  extraset: () => { const a = D().active; a.queue[a.idx].extra++; persist(); rerender("#saveset"); say(tx("Extra-Satz hinzugefügt. Jetzt {n} Sätze.", {n: St.targetSets(a.queue[a.idx])})); },
  skipex: () => {
    const a = D().active, i = a.idx, name = exName(St.ex(a.queue[i].exId));
    a.queue[i].skipped = true; a.restEnd = 0;
    const n = St.firstOpen(a, i); if (n < 0) ui.summary = true; else a.idx = n;
    ui.key = ""; persist(); rerender(); view.querySelector("h1").focus();
    toast(tx("{name} ausgelassen.", {name}), () => { a.queue[i].skipped = false; a.idx = i; ui.summary = false; ui.key = ""; persist(); rerender(); view.querySelector("h1").focus(); });
  },
  rest30: () => { const a = D().active; a.restEnd += 30000; a.restTotal = (a.restTotal || 0) + 30; scheduleBeep((a.restEnd - Date.now()) / 1000); persist(); const el = $("#rt"); if (el) el.textContent = restLeft(); say(tx("Pause verlängert, noch {t} Sekunden.", {t: restLeft().replace(":", " " + tx("Minuten") + " ")})); },
  skiprest: () => { D().active.restEnd = 0; lastRestState = false; cancelBeep(); readSetInputs(); persist(); rerender("#saveset"); },
  overview: () => openOverview(),
  mini: () => minimize(),
  maxi: () => go("#/training"),
  exprev: () => moveEx(-1),
  exnext: () => moveEx(1),
  exgo: () => { const a = D().active, n = St.firstOpen(a, a.idx); ui.pin = null; ui.key = ""; if (n < 0) ui.summary = true; else a.idx = n; persist(); rerender(); view.scrollTop = 0; view.querySelector("h1").focus(); },
  setype: t => { dlg.querySelectorAll('[data-act="setype"]').forEach(b => b.setAttribute("aria-pressed", String(b === t))); },
  editset: t => openSetEdit(+t.dataset.k),
  setsave: () => saveSetEdit(),
  setdel: () => {
    const a = D().active, k = ui.setEdit, snap = St.snapshot(); a.sets.splice(k, 1); persist(); opener = null; closeDialog(); ui.pin = a.idx; ui.key = ""; rerender(); view.querySelector("h1").focus();
    toast(tx("Satz gelöscht."), () => { St.restore(snap); rerender(); });
  },
  jump: t => { const a = D().active; a.idx = +t.dataset.i; ui.pin = a.idx; ui.key = ""; ui.summary = false; persist(); opener = null; closeDialog(); rerender(); view.querySelector("h1").focus(); },
  unskip: t => { const a = D().active; a.queue[+t.dataset.i].skipped = false; a.idx = +t.dataset.i; ui.pin = null; ui.key = ""; ui.summary = false; persist(); opener = null; closeDialog(); rerender(); view.querySelector("h1").focus(); },
  end: () => { ui.summary = true; rerender(); view.querySelector("h1").focus(); },
  resume: () => { ui.summary = false; ui.pin = null; const a = D().active; a.idx = St.firstOpen(a, a.idx); persist(); rerender(); view.querySelector("h1").focus(); },
  finish: () => {
    const a = D().active, p = St.plan(a.planId), checked = [...view.querySelectorAll('input[name="dev"]:checked')].map(c => ui.devs[+c.value]);
    const day = p && p.days.find(d => d.id === a.dayId);
    checked.forEach(dv => {
      const q = a.queue[dv.k], idx = day.slots.findIndex(s => s.id === q.slotId);
      if (idx < 0) return;
      if (dv.kind === "swap") { const sl = day.slots[idx]; day.slots[idx] = {...sl, exId: q.exId, ...swapScheme(sl, St.ex(sl.exId), St.ex(q.exId))}; }
      else if (dv.kind === "remove") day.slots.splice(idx, 1); else day.slots[idx].sets = q.sets + q.extra;
    });
    const n = a.sets.length; St.finishSession(); ui.summary = false; ui.key = ""; cancelBeep();
    go("#/heute"); toast(n ? tx("Training gespeichert: {n} Sätze.", {n}) + (checked.length ? " " + tx("Plan angepasst.") : "") : tx("Training beendet."));
  },
  obpick: t => { const q = OB.QUESTIONS[ui.ob.step], o = q.opts.find(x => String(x[0]) === t.dataset.v); ui.ob.a[q.id] = o[0]; ui.ob.step++; rerender(); view.scrollTop = 0; const h = view.querySelector("h1"); if (h) h.focus(); },
  obback: () => { ui.ob.step = Math.max(0, ui.ob.step - 1); rerender(); const h = view.querySelector("h1"); if (h) h.focus(); },
  obrestart: () => { ui.ob = {step: 0, a: {}}; rerender(); const h = view.querySelector("h1"); if (h) h.focus(); },
  obskip: () => { D().settings.onboarded = true; ui.ob = null; persist(); rerender(); view.scrollTop = 0; const h = view.querySelector("h1"); if (h) h.focus(); },
  obadopt: () => {
    const p = ui.ob.plan; D().plans.push(p); D().activePlanId = p.id; D().settings.onboarded = true; ui.ob = null; ui.day = null; persist();
    rerender(); view.scrollTop = 0; toast(tx("„{name}“ übernommen. Alles lässt sich unter Pläne ändern.", {name: lib(p.name)}));
  },
  mprev: () => { ui.mOff = (ui.mOff || 0) + 1; rerender('[data-act="mprev"]'); },
  mnext: () => { ui.mOff = Math.max(0, (ui.mOff || 0) - 1); rerender(ui.mOff ? '[data-act="mnext"]' : '[data-act="mprev"]'); },
  icsdl: () => downloadIcs(),
  icsday: t => { const r = remindCfg(), d = +t.dataset.d; r.days = r.days.includes(d) ? r.days.filter(x => x !== d) : [...r.days, d]; D().settings.remind = r; persist(); rerender(`[data-act="icsday"][data-d="${d}"]`); },
  planweek: () => openPlanWeek(),
  calday: t => openCalDay(t.dataset.k),
  calset: t => { const k = t.dataset.k; St.setDay(k, t.dataset.v || null); rerender(); openCalDay(k); say(t.dataset.v ? tx("Als {x} markiert.", {x: tx(CALNAME[t.dataset.v])}) : tx("Folgt wieder dem Wochenmuster.")); },
  calmove: t => { St.moveTraining(t.dataset.from, t.dataset.to); dlg.close(); rerender(`[data-k="${t.dataset.to}"]`);
    say(tx("Training auf {d} verschoben.", {d: new Date(t.dataset.to + "T12:00:00").toLocaleDateString(L(), {weekday: "long"})})); },
  calrange: () => openCalRange(),
  crset: () => calRangeApply(true),
  crclear: () => calRangeApply(false),
  cprev: () => { ui.cOff = (ui.cOff || 0) - 1; rerender('[data-act="cprev"]'); },
  cnext: () => { ui.cOff = (ui.cOff || 0) + 1; rerender('[data-act="cnext"]'); },
  ctoday: () => { ui.cOff = 0; rerender('[data-act="cnext"]'); },
  pwday: t => { const d = +t.dataset.d, cur = St.trainDays(); D().settings.trainDays = (cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d]).sort(); persist();
    const on = D().settings.trainDays.includes(d), st = t.querySelector(".pwstate");
    t.setAttribute("aria-pressed", on); st.className = `pwstate d-${on ? "plan" : "rest"}`; st.innerHTML = `<span class="dot" aria-hidden="true">${on ? DAYSYM.plan : DAYSYM.rest}</span>${on ? tx("Training") : tx("Ruhetag")}`;
    $("#pw-note").textContent = pwNote(D().settings.trainDays, St.weekGoal()); rerender(); },
  pauseweek: () => { const was = St.isPaused(St.weekStart()); St.togglePause(); rerender('[data-act="pauseweek"]'); say(was ? tx("Pause aufgehoben.") : tx("Diese Woche ist als Pause markiert. Deine Serie bleibt erhalten.")); },
  discard: () => {
    const snap = St.snapshot(); D().active = null; persist(); ui.summary = false; cancelBeep(); go("#/heute");
    toast(tx("Training verworfen."), () => { St.restore(snap); go("#/training"); });
  },
  sessedit: t => openSessionEdit(t.dataset.id),
  sesssave: () => saveSessionEdit(),
  wopen: () => openWeight(),
  bellpreview: () => BELL.preview(D().settings.voice !== false),
  wsave: () => saveWeight(),
  wstep: t => { const i = $("#wIn"), v = Math.round((num(i.value) + 0.1 * +t.dataset.d) * 10) / 10; i.value = fmt(Math.max(30, Math.min(300, v))); sayLater(tx("{kg} Kilo", {kg: fmt(v)})); },
  wdel: t => {
    const k = t.dataset.d, snap = St.snapshot(); D().weights = D().weights.filter(x => x.date !== k); persist(); opener = null; closeDialog(); rerender();
    toast(tx("Gewicht vom {day} gelöscht.", {day: dayLabel(k)}), () => { St.restore(snap); rerender(); });
  },
  weightsave: () => { const el = view.querySelector('[data-on="pweight"]'); el.dispatchEvent(new Event("change", {bubbles: true})); rerender(); },
  delsession: t => {
    const snap = St.snapshot(); D().sessions = D().sessions.filter(x => x.id !== t.dataset.id); persist(); rerender(); view.querySelector("h1").focus();
    toast(tx("Training gelöscht."), () => { St.restore(snap); rerender(); });
  },
  /* Körperkarte & Ziele */
  tgoal: t => { ui.tgoal = t.dataset.v; rerender(`[data-act="tgoal"][data-v="${t.dataset.v}"]`); },
  bm: t => pickMuscle(t.dataset.m, false),
  b3go: () => { const h = $("#bx-h"); if (h) { h.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"}); h.focus({preventScroll: true}); } },
  bside: t => { setSide(t.dataset.v); if (body3d) t.dataset.v === "back" ? body3d.back() : body3d.front(); say(t.dataset.v === "back" ? tx("Rückansicht.") : tx("Vorderansicht.")); },
  bmadd: t => {
    const p = St.activePlan(), e = St.ex(t.dataset.id);
    if (!p) return toast(tx("Übernimm zuerst einen Plan oder leg einen leeren an. Dann kannst du Übungen hinzufügen."));
    if (!p.days.length) return toast(tx("„{name}“ hat noch keinen Trainingstag. Leg zuerst einen an.", {name: lib(p.name)}));
    const [sets, min, max] = schemeFor(e, p.goal);
    openDialog(`<h2 id="dlg-h">${tx("{name} hinzufügen", {name: esc(exName(e))})}</h2>
      <p class="meta" style="text-align:center;margin-top:-10px">${tx("Zu welchem Tag in „{plan}“? Startet mit {s}, im Plan änderbar.", {plan: esc(lib(p.name)), s: `${sets}×${min}–${max}`})}</p>
      <ul class="plist" style="max-height:none">${p.days.map((d, i) => `<li><button data-act="bmaddday" data-i="${i}" data-id="${e.id}"><b>${esc(lib(d.name))}</b><small>${txn(d.slots.length, "{n} Übung", "{n} Übungen")}${d.slots.some(s => s.exId === e.id) ? " · " + tx("schon enthalten") : ""}</small></button></li>`).join("")}</ul>
      <button class="btn" data-act="close">${tx("Abbrechen")}</button>`);
  },
  bmaddday: t => {
    const p = St.activePlan(), d = p.days[+t.dataset.i], e = St.ex(t.dataset.id), [sets, min, max, rest] = schemeFor(e, p.goal);
    const sl = {id: St.uid(), exId: e.id, sets, min, max, rest};
    d.slots.push(sl); persist(); closeDialog();
    toast(tx("{name} zu „{day}“ hinzugefügt.", {name: exName(e), day: lib(d.name)}), () => { d.slots = d.slots.filter(x => x !== sl); persist(); });
  },
  /* Einstellungen */
  set: t => { const k = t.dataset.k, v = t.dataset.v; D().settings[k] = k === "scale" ? +v : v; persist(); applySettings(); rerender(`[data-k="${k}"][data-v="${v}"]`); },
  export: () => {
    D().settings.lastBackup = new Date().toISOString(); persist();
    const blob = new Blob([JSON.stringify(D(), null, 1)], {type: "application/json"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${tx("satz-sicherung")}-${new Date().toISOString().slice(0, 10)}.json`; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast(tx("Sicherung erstellt.")); if (location.hash.startsWith("#/mehr") || location.hash.startsWith("#/heute")) rerender();
  },
  import: () => $("#importFile").click(),
  dlcorrupt: () => {
    const keys = St.corruptKeys(), raw = keys.length ? keys.map(k => localStorage.getItem(k)).join("\n") : (St.recovered && St.recovered.raw) || "";
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([raw], {type: "text/plain"}));
    a.download = tx("satz-gerettete-daten") + ".txt"; document.body.append(a); a.click(); a.remove();
  },
  delcorrupt: () => { St.corruptKeys().forEach(k => localStorage.removeItem(k)); rerender(); toast(tx("Gesicherte Altdaten verworfen.")); },
  snoozebackup: () => { D().settings.backupSnooze = new Date().toISOString(); persist(); rerender(); },
  reset: () => openDialog(`<h2 id="dlg-h">${tx("Alle Daten löschen?")}</h2>
    <p>${tx("Pläne, {n} Trainings, Ernährungstagebuch und Profil werden von diesem Gerät gelöscht. Das lässt sich nur kurz rückgängig machen.", {n: D().sessions.length})}</p>
    <button class="btn" data-act="export">${tx("Vorher als Datei sichern")}</button>
    <label class="field" style="margin-top:16px">${tx("Zum Bestätigen {word} eintippen", {word: tx("LÖSCHEN")})} <input id="resetIn" autocomplete="off" autocapitalize="characters"></label>
    <p class="err" role="alert" hidden></p>
    <div class="dlg-actions"><button class="btn" data-act="close">${tx("Abbrechen")}</button><button class="btn destructive" data-act="resetgo">${tx("Endgültig löschen")}</button></div>`, "h2"),
  updrestore: t => {
    const snap = St.snapshot();
    try { St.restoreUpdateBackup(t.dataset.k); } catch (e) { return toast(tx("Diese Sicherung ließ sich nicht lesen. Deine aktuellen Daten sind unverändert.")); }
    applyLang(); applySettings(); rerender();
    toast(tx("Stand vor dem Update geladen: {n} Trainings.", {n: D().sessions.length}), () => { St.restore(snap); applySettings(); rerender(); });
  },
  mopen: () => openMeasures(),
  msave: () => saveMeasures(),
  mdel: t => {
    const snap = St.snapshot(), k = t.dataset.d;
    D().measures = D().measures.filter(x => x.date !== k); persist(); openMeasures(); rerender();
    toast(tx("Messung vom {day} gelöscht.", {day: dayLabel(k)}), () => { St.restore(snap); rerender(); });
  },
  resetgo: () => {
    // Das deutsche Wort gilt in jeder Sprache, damit eine Anleitung auf Deutsch immer funktioniert
    const w = $("#resetIn").value.trim().toUpperCase();
    if (w !== "LÖSCHEN" && w !== tx("LÖSCHEN").toUpperCase()) return dlgError(tx("Bitte {word} eintippen.", {word: tx("LÖSCHEN")}));
    closeDialog();
    const snap = St.snapshot(); const keep = D().settings;
    localStorage.removeItem("satz-data"); St.load(); D().settings = keep; persist(); ui.day = null; go("#/heute");
    toast(tx("Alle Daten gelöscht."), () => { St.restore(snap); go("#/mehr/daten"); });
  },
};
function rerenderKeep(t) {
  const sel = `[data-act="${t.dataset.act}"]` + (t.dataset.d ? `[data-d="${t.dataset.d}"]` : "") + (t.dataset.v ? `[data-v="${t.dataset.v}"]` : "");
  rerender(sel);
}

document.addEventListener("click", ev => {
  const t = ev.target.closest("[data-act]");
  if (!t || t.disabled) return;
  ev.preventDefault();
  A[t.dataset.act]?.(t, ev);
});
document.addEventListener("input", ev => {
  const k = ev.target.dataset.on;
  if (k === "pq") { ui.pq = ev.target.value; renderPickList(); }
  if (k === "exq") { ui.exq = ev.target.value; const pos = ev.target.selectionStart; rerender('[data-on="exq"]'); const f = view.querySelector('[data-on="exq"]'); f.setSelectionRange(pos, pos); }
});
document.addEventListener("change", ev => {
  const el = ev.target, k = el.dataset.on;
  if (k === "pm") { ui.pm = el.value; renderPickList(); }
  if (k === "kitp") { ui.kit = el.value; renderPickList(); }
  if (k === "kitx") { ui.kit = el.value; rerender('[data-on="kitx"]'); }
  if (k === "pname") { curPlan().name = el.value.trim() || "Mein Plan"; persist(); rerender('[data-on="pname"]'); }
  if (k === "dname") { const p = curPlan(); p.days[ui.eday].name = el.value.trim() || tx("Tag {n}", {n: ui.eday + 1}); persist(); rerender('[data-on="dname"]'); }
  if (k === "cycleweeks") { const p = curPlan(), n = +el.value; p.cycle = n ? {weeks: n, start: p.cycle && p.cycle.weeks ? p.cycle.start : dkey()} : {weeks: 0, start: dkey()}; persist(); rerender('[data-on="cycleweeks"]'); }
  if (k === "msel") { ui.msel = el.value; rerender('[data-on="msel"]'); }
  if (k === "histex") { ui.histEx = el.value; rerender('[data-on="histex"]'); }
  if (k === "icstime" || k === "icsbefore") { const r = remindCfg(); if (k === "icstime") { if (/^\d{2}:\d{2}$/.test(el.value)) r.time = el.value; } else r.before = +el.value; D().settings.remind = r; persist(); }
  if (k === "contrast" || k === "rir") { D().settings[k] = el.checked; persist(); applySettings(); }
  if (k === "rest") { D().settings.rest = +el.value; persist(); }
  if (k === "kgin" || k === "repsin") { readSetInputs(); el.value = k === "kgin" ? fmt(ui.kg) : ui.reps; }
  if (k === "sound") { D().settings.sound = el.checked; persist(); ["#s-voice", "#s-bg"].forEach(q => { const v = $(q); if (v) v.disabled = !el.checked; }); }
  if (k === "bgbell") { D().settings.bgBell = el.checked; persist(); }
  if (k === "voice") { D().settings.voice = el.checked; persist(); }
  if (k === "showfig") { D().settings.showFig = el.checked; persist(); }
  if (el.id === "importFile" && el.files[0]) {
    const r = new FileReader();
    r.onload = () => {
      const err = $("#importErr");
      let data;
      try { data = St.sanitizeImport(JSON.parse(r.result)); } catch (e) { err.textContent = `${tx("Diese Datei ist keine gültige SATZ-Sicherung.")} ${e instanceof SyntaxError ? "" : tx(e.message)}`; err.hidden = false; return; }
      const snap = St.snapshot(); St.replaceAll(data); applyLang(); applySettings(); ui.day = null;
      go("#/heute"); toast(tx("Sicherung geladen: {n} Trainings.", {n: data.sessions.length}), () => { St.restore(snap); applyLang(); applySettings(); go("#/mehr/daten"); });
    };
    r.readAsText(el.files[0]); el.value = "";
  }
});
// Enter in Dialog-Feldern speichert
dlg.addEventListener("keydown", ev => {
  if (ev.key === "Enter" && ev.target.id === "fq") { ev.preventDefault(); const b = dlg.querySelector('[data-act="offsearch"]'); if (b) b.click(); return; }
  if (ev.key !== "Enter" || ev.target.tagName !== "INPUT" || ev.target.type === "search" || ev.target.type === "checkbox") return;
  ev.preventDefault(); const b = dlg.querySelector('[data-act="slotsave"],[data-act="exsave"],[data-act="amountsave"],[data-act="foodsave"],[data-act="goalsave"],[data-act="bclookup"],[data-act="quicksave"],[data-act="wsave"],[data-act="setsave"]'); if (b) b.click();
});

/* ============ Tab-Bar: Pille ziehen ============ */
const TAB_ORDER = ["heute", "plaene", "verlauf", "ernaehrung", "mehr"];
function placePill(name) {
  const i = TAB_ORDER.indexOf(name);
  tabs.classList.toggle("nopill", i < 0);
  if (i >= 0) tabs.querySelector(".pill").style.transform = `translateX(${i * 100}%)`;
}
(() => {
  const pill = tabs.querySelector(".pill"), links = [...tabs.querySelectorAll("a")];
  let startX = 0, id = null, dragging = false, swallow = false;
  const geo = () => { const r = tabs.getBoundingClientRect(), w = (r.width - 8) / links.length; return {r, w}; };
  const idxAt = x => { const {r, w} = geo(); return Math.max(0, Math.min(links.length - 1, Math.floor((x - r.left - 4) / w))); };
  tabs.addEventListener("pointerdown", ev => { if (ev.button) return; id = ev.pointerId; startX = ev.clientX; dragging = false; });
  tabs.addEventListener("pointermove", ev => {
    if (ev.pointerId !== id) return;
    if (!dragging && Math.abs(ev.clientX - startX) < 8) return;
    if (!dragging) { dragging = true; tabs.classList.add("dragging"); tabs.classList.remove("nopill"); try { tabs.setPointerCapture(id); } catch (e) {} }
    const {r, w} = geo(), x = Math.max(0, Math.min(w * (links.length - 1), ev.clientX - r.left - 4 - w / 2));
    pill.style.transform = `translateX(${x}px)`;
    const i = idxAt(ev.clientX); links.forEach((a, k) => a.classList.toggle("over", k === i));
  });
  const end = ev => {
    if (ev.pointerId !== id) return;
    id = null;
    if (!dragging) return;
    dragging = false; swallow = true; setTimeout(() => swallow = false, 400);
    tabs.classList.remove("dragging");
    links.forEach(a => a.classList.remove("over"));
    const a = links[idxAt(ev.clientX)];
    placePill(a.dataset.tab);
    if (ev.type === "pointerup") go(a.getAttribute("href")); else route();
  };
  tabs.addEventListener("pointerup", end);
  tabs.addEventListener("pointercancel", end);
  tabs.addEventListener("click", ev => { if (swallow) { ev.preventDefault(); swallow = false; } }, true);
  tabs.addEventListener("dragstart", ev => ev.preventDefault());
})();

/* ============ Ernährung: Hilfen ============ */
const num = v => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : 0; };
const r0 = n => Math.round(n).toLocaleString(L());
const r1 = n => (Math.round(n * 10) / 10).toLocaleString(L());
const dkey = (d = new Date()) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const shiftDay = (k, n) => { const d = new Date(k + "T12:00:00"); d.setDate(d.getDate() + n); return dkey(d); };
function dayLabel(k) {
  const t = dkey();
  if (k === t) return tx("Heute");
  if (k === shiftDay(t, -1)) return tx("Gestern");
  return new Date(k + "T12:00:00").toLocaleDateString(L(), {weekday: "long", day: "numeric", month: "long"});
}
const ACCENTS = [["gruen", "Grün", "#00703A", "#00C46A"], ["petrol", "Petrol", "#0B6E7F", "#4CD3E3"], ["kobalt", "Kobalt", "#1D4ED8", "#7AA2FF"], ["violett", "Violett", "#6D28D9", "#B9A0FF"], ["beere", "Beere", "#B0185F", "#FF8CC0"], ["signal", "Signal", "#C8102E", "#FF8585"], ["kupfer", "Kupfer", "#B23C00", "#FF9A5C"], ["ocker", "Ocker", "#865600", "#F2C14E"], ["graphit", "Graphit", "#1C1C1E", "#F2F2F7"]];
const isDark = () => { const s = D().settings; return s.theme === "dark" || (s.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches); };
const targets = () => N.activeTargets(D().profile, St.currentWeight());
const mealName = id => tx((N.MEALS.find(m => m[0] === id) || ["", ""])[1]);
const foodLine = f => [f.brand, `${r0(f.per100.kcal)} kcal / 100 g`].filter(Boolean).join(" · ");

/* ============ Ernährung: Ansicht ============ */
const prevMeal = id => D().food.filter(e => e.date === shiftDay(ui.fday || dkey(), -1) && e.meal === id).length;
function viewNutrition() {
  if (!ui.fday) ui.fday = dkey();
  const k = ui.fday, today = dkey(), t = targets();
  const entries = D().food.filter(e => e.date === k), sum = N.sumEntries(entries);
  const bar = (v, max) => { const pct = max ? Math.min(100, v / max * 100) : 0; return `<div class="bar ${max && v > max * 1.05 ? "over" : ""}" aria-hidden="true"><i style="width:${pct}%"></i></div>`; };
  const mac = (name, v, max) => `<div><span class="n">${name}</span><div class="g">${r0(v)}${max ? ` / ${r0(max)}` : ""} g</div>${bar(v, max)}</div>`;
  const left = t ? t.kcal - sum.kcal : 0, prevN = D().food.filter(e => e.date === shiftDay(k, -1)).length;
  view.innerHTML = `<h1 class="big">${tx("Ernährung")}</h1>
    <div class="daynav"><button type="button" data-act="fday" data-d="-1" aria-label="${tx("Vorheriger Tag")}">‹</button>
      <span class="t" aria-live="polite">${esc(dayLabel(k))}</span>
      <button type="button" data-act="fday" data-d="1" aria-label="${tx("Nächster Tag")}" ${k >= today ? "disabled" : ""}>›</button></div>
    <section class="card" aria-labelledby="sum-h">
      <h2 id="sum-h" class="sr">${tx("Tagesbilanz")}</h2>
      <div class="kcal"><span class="v">${r0(sum.kcal)}<span class="meta" style="font-size:1rem;font-weight:500"> kcal</span></span>
        <span class="r">${t ? (left >= 0 ? tx("noch {n} von {m}", {n: r0(left), m: r0(t.kcal)}) : tx("{n} über {m}", {n: r0(-left), m: r0(t.kcal)})) : tx("kein Ziel gesetzt")}</span></div>
      ${t ? bar(sum.kcal, t.kcal) : ""}
      <div class="macros">${mac(tx("Protein"), sum.p, t && t.p)}${mac(tx("Kohlenhydrate"), sum.c, t && t.c)}${mac(tx("Fett"), sum.f, t && t.f)}</div>
      <div class="row-btns"><button class="btn small" data-act="goals" aria-haspopup="dialog">${t ? (t.manual ? tx("Ziel: manuell") : tx("Ziel: berechnet")) + " · " + tx("Quellen") : tx("Ziel festlegen")}</button></div>
    </section>
    ${t ? "" : N.computeTargets(D().profile, St.currentWeight())?.blocked ? `<p class="hint">${tx("SATZ berechnet Ernährungsziele erst ab {n} Jahren. Du kannst trotzdem mitschreiben, was du isst.", {n: N.MIN_AGE})}</p>`
      : `<section class="card" aria-labelledby="ob-h"><h2 id="ob-h" style="font-size:1.1rem;margin:0 0 4px">${tx("Bedarf berechnen")}</h2><p class="meta">${tx("Mit diesen Angaben berechnet SATZ deinen Bedarf nach anerkannten Formeln. Noch fehlt: {list}. Oder leg die Werte über „Ziel festlegen“ selbst fest.", {list: esc(N.missing(D().profile, St.currentWeight()).join(", "))})}</p>${dropH2(profileSection())}</section>`}
    ${t && k === today ? weightCard() : ""}
    ${t && k === today ? adaptCard() : ""}
    ${!entries.length && prevN ? `<button class="btn" data-act="fcopyprev">${txn(prevN, "Vortag übernehmen ({n} Eintrag)", "Vortag übernehmen ({n} Einträge)")}</button>` : ""}
    ${N.MEALS.map(([id]) => { const name = mealName(id), es = entries.filter(e => e.meal === id), ms = N.sumEntries(es); return `
      <div class="mealh"><h2 class="sec" id="m-${id}">${name}</h2>${es.length ? `<span>${r0(ms.kcal)} kcal</span>` : entries.length && prevMeal(id) ? `<button type="button" class="linkbtn" data-act="fcopymeal" data-m="${id}">${tx("Wie gestern")}<span class="sr"> (${name})</span></button>` : ""}</div>
      <ul class="group" aria-labelledby="m-${id}">
        ${es.map(e => { const m = N.macrosFor(e.per100, e.grams); return `<li><button class="fbtn" data-act="fedit" data-id="${e.id}" aria-haspopup="dialog"><span><b>${esc(e.name)}</b><small>${e.quick ? tx("Schnell-Eintrag") : `${r0(e.grams)} g`} · ${tx("P")} ${r0(m.p)} · ${tx("K")} ${r0(m.c)} · ${tx("F")} ${r0(m.f)}</small></span><span class="k">${r0(m.kcal)} kcal</span></button></li>`; }).join("")}
        <li><button class="fbtn add" data-act="fadd" data-m="${id}" aria-haspopup="dialog">+ ${tx("Hinzufügen")}<span class="sr"> ${tx("zu {meal}", {meal: name})}</span></button></li>
      </ul>`; }).join("")}
    ${iL(tx("Woher die Produktdaten kommen"), tx("Produktdaten aus dem Netz kommen von Open Food Facts, einer freien Datenbank, die von Freiwilligen gepflegt wird. Prüfe die Werte auf der Verpackung. An Open Food Facts geht nur der Barcode oder Suchbegriff, nichts über dich."))}
    <div style="height:24px"></div>`;
}

/* ---------- Adaptiver Bedarf ---------- */
function adaptCard() {
  const pr = D().profile, a = N.adaptiveTdee(D().food, D().weights, dkey()), adj = pr.tdeeAdj;
  if (!a.ok) {
    const pct = Math.min(100, Math.round(Math.min(a.span, N.ADAPT.minDays) / N.ADAPT.minDays * 100));
    return `<section class="card adapt" aria-labelledby="ad-h"><h2 id="ad-h" class="eyebrow" style="margin:0 0 4px">${tx("Dein echter Verbrauch")}</h2>
      ${adj ? `<p class="meta">${tx("Dein Ziel nutzt den gemessenen Verbrauch von {n} kcal (Stand {date}).", {n: r0(adj.tdee), date: shortDate(adj.date + "T12:00:00")})}</p>` : `<p class="meta">${tx("Aus Gewicht und Essen errechnet SATZ nach 2 Wochen, was du wirklich verbrauchst.")}</p>`}
      <div class="bar" role="progressbar" aria-label="${tx("Fortschritt bis zur Berechnung")}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
      <p class="meta" style="margin:6px 0 0">${esc(a.need)}</p></section>`;
  }
  const kg = St.currentWeight(), formula = N.computeTargets({...pr, tdeeAdj: null}, kg), next = N.computeTargets({...pr, tdeeAdj: {tdee: a.tdee}}, kg);
  if (!formula || formula.blocked || !next) return "";
  const cur = adj ? adj.tdee : formula.steps.tdee, diff = a.tdee - cur;
  const odd = a.tdee < formula.steps.bmr || a.tdee > formula.steps.bmr * 2.6;
  const trend = tx("{d} kg pro Woche", {d: `${a.slopeWeek > 0 ? "+" : a.slopeWeek < 0 ? "−" : "±"}${fmt(Math.abs(a.slopeWeek))}`});
  return `<section class="card adapt" aria-labelledby="ad-h"><h2 id="ad-h" class="eyebrow" style="margin:0 0 4px">${tx("Dein echter Verbrauch")} ${iB(tx("Dein echter Verbrauch"), tx("Aus {n} eingetragenen Tagen: im Schnitt {kcal} kcal gegessen, Gewichtstrend {trend}. Daraus errechnet SATZ, was du wirklich verbrauchst.", {n: a.logged, kcal: r0(a.intake), trend}))}</h2>
    <p class="kcal" style="margin:0"><span class="v">${tx("ca.")} ${r0(a.tdee)}<span class="meta" style="font-size:1rem;font-weight:500"> kcal</span></span><span class="r">${tx("Formel: {n}", {n: r0(formula.steps.tdee)})}</span></p>
    ${odd ? `<p class="note">${a.tdee < formula.steps.bmr ? tx("Der Wert liegt unter deinem Grundumsatz.") : tx("Der Wert liegt ungewöhnlich hoch.")} ${tx("Meist fehlen Einträge oder das Gewicht schwankt stark. SATZ schlägt deshalb nichts vor.")}</p>`
      : Math.abs(diff) < 100 ? `<p class="meta">${adj ? tx("Dein Ziel nutzt diesen Wert bereits.") : tx("Passt zur Formel. Kein Anpassen nötig.")}</p>`
      : `<p>${tx("Neues Tagesziel: <b>{n} kcal</b> statt {m} ({d} kcal Verbrauch).", {n: r0(next.kcal), m: r0(targets().kcal), d: (diff > 0 ? "+" : "−") + r0(Math.abs(diff))})}</p>
        <div class="row-btns"><button class="btn small primary" data-act="adapt" data-v="${a.tdee}" data-n="${a.logged}">${tx("Übernehmen")}</button><button class="btn small" data-act="goals" aria-haspopup="dialog">${tx("Rechnung ansehen")}</button></div>`}
  </section>`;
}

/* ---------- Hinzufügen ---------- */
function openFoodAdd(meal) {
  ui.fmeal = meal; ui.fq = ""; ui.foff = null; ui.foffState = "";
  openDialog(`<h2 id="dlg-h">${esc(tx("{meal}: hinzufügen", {meal: mealName(meal)}))}</h2>
    <div class="row-btns" style="margin:0 0 16px"><button class="btn small primary" data-act="scan">${tx("Barcode scannen")}</button><button class="btn small" data-act="newfood">${tx("Neues Lebensmittel")}</button><button class="btn small" data-act="fquick" aria-haspopup="dialog">${tx("Nur kcal")}</button></div>
    <label class="field">${tx("Suchen")} <input id="fq" type="search" data-on="fq" autocomplete="off" enterkeyhint="search"></label>
    <div id="fres"></div>
    <button class="btn" data-act="close">${tx("Abbrechen")}</button>`, "#fq");
  renderFoodResults();
}
function localFoods(q) {
  const used = {}; D().food.forEach((e, i) => { if (e.foodId) used[e.foodId] = i; });
  return Object.values(D().foods).filter(f => !q || (f.name + " " + (f.brand || "")).toLowerCase().includes(q))
    .sort((a, b) => (used[b.id] ?? -1) - (used[a.id] ?? -1) || a.name.localeCompare(b.name, L()));
}
function renderFoodResults() {
  const box = $("#fres"); if (!box) return;
  const q = ui.fq.trim().toLowerCase(), all = localFoods(q);
  const favs = q ? [] : all.filter(f => f.fav), list = all.filter(f => !favs.includes(f)).slice(0, 30);
  ui.fcands = [...favs, ...list];
  const item = (f, i) => `<li><button data-act="pickfood" data-i="${i}"><b>${f.fav ? `<span aria-hidden="true">★ </span>` : ""}${esc(f.name)}${f.fav && q ? `<span class="sr"> (${tx("Favorit")})</span>` : ""}</b><small>${esc(foodLine(f))}</small></button></li>`;
  let off = "";
  if (ui.foffState === "loading") off = `<p class="meta" role="status">${tx("Suche bei Open Food Facts …")}</p>`;
  else if (ui.foffState === "error") off = `<p class="err" role="alert">${tx("Open Food Facts antwortet gerade nicht. Die Online-Suche erlaubt nur wenige Anfragen pro Minute. Versuch es gleich nochmal, scanne den Barcode oder leg das Lebensmittel selbst an.")}</p>`;
  else if (ui.foff) {
    const base = ui.fcands.length;
    ui.fcands.push(...ui.foff);
    off = `<h3 class="meta" style="margin:12px 0 6px">${txn(ui.foff.length, "Open Food Facts: {n} Treffer", "Open Food Facts: {n} Treffer")}</h3>${ui.foff.length ? `<ul class="plist">${ui.foff.map((f, i) => item(f, base + i)).join("")}</ul>` : ""}`;
  }
  box.innerHTML = `
    ${favs.length ? `<h3 class="meta" style="margin:0 0 6px">${tx("Favoriten")}</h3><ul class="plist">${favs.map(item).join("")}</ul>` : ""}
    ${list.length ? `<h3 class="meta" style="margin:${favs.length ? "12px" : "0"} 0 6px">${q ? tx("Deine Lebensmittel") : tx("Zuletzt verwendet")}</h3><ul class="plist">${list.map((f, i) => item(f, favs.length + i)).join("")}</ul>`
      : favs.length ? "" : `<p class="meta">${q ? tx("Keine eigenen Treffer.") : tx("Noch keine eigenen Lebensmittel. Scanne einen Barcode, suche online oder leg eins an.")}</p>`}
    ${q.length >= 3 && !ui.foff && ui.foffState !== "loading" ? `<button class="btn" data-act="offsearch" style="margin-bottom:12px">${tx("„{q}“ online suchen", {q: esc(ui.fq.trim())})}</button>` : ""}
    ${off}`;
}

/* ---------- Menge ---------- */
function openAmount(food, entry) {
  ui.famount = {food, entry};
  const grams = entry ? entry.grams : food.serving || 100;
  const mealSel = entry ? entry.meal : ui.fmeal || "snack", fav = !!(food.id && D().foods[food.id] && D().foods[food.id].fav);
  openDialog(`<h2 id="dlg-h">${esc(food.name)}</h2>
    <p class="meta" style="text-align:center;margin-top:-10px">${esc(foodLine(food))}</p>
    <div class="favrow"><button type="button" class="btn small favbtn" data-act="ffav" aria-pressed="${fav}"><span aria-hidden="true">${fav ? "★" : "☆"}</span> ${fav ? tx("Favorit") : tx("Als Favorit merken")}</button></div>
    <p class="err" role="alert" hidden></p>
    ${food.serving ? `<div class="pair"><label class="field">${tx("Portionen à {n} g", {n: fmt(food.serving)})} <input id="fport" data-on="fport" inputmode="decimal" autocomplete="off" value="${fmt(Math.round(grams / food.serving * 100) / 100)}"></label>
      <label class="field">${tx("Gramm")} <input id="fgrams" data-on="fgrams" inputmode="decimal" autocomplete="off" value="${fmt(grams)}"></label></div>
      <div class="quick"><button class="btn small" data-act="fgset" data-g="${food.serving / 2}">${tx("½ Portion")}</button><button class="btn small" data-act="fgset" data-g="${food.serving}">${tx("1 Portion")}</button><button class="btn small" data-act="fgset" data-g="${food.serving * 2}">${tx("2 Portionen")}</button><button class="btn small" data-act="fgset" data-g="100">100 g</button></div>`
      : `<label class="field">${tx("Menge in Gramm")} <input id="fgrams" data-on="fgrams" inputmode="decimal" autocomplete="off" value="${fmt(grams)}"></label>`}
    <div class="preview" id="fprev" aria-live="polite"></div>
    <label class="field">${tx("Mahlzeit")} <select id="fmealsel">${N.MEALS.map(([id]) => `<option value="${id}" ${id === mealSel ? "selected" : ""}>${mealName(id)}</option>`).join("")}</select></label>
    <div class="dlg-actions"><button class="btn" data-act="close">${tx("Abbrechen")}</button><button class="btn primary" data-act="amountsave">${entry ? tx("Speichern") : tx("Hinzufügen")}</button></div>
    ${entry ? `<button class="btn destructive" data-act="fdel" style="margin-top:10px">${tx("Eintrag löschen")}</button>` : ""}
    ${food.id && D().foods[food.id] ? `<button class="btn" data-act="foodedit" style="margin-top:10px">${tx("Lebensmittel bearbeiten")}</button>` : ""}`, "#fgrams");
  updatePreview();
}
function updatePreview() {
  const el = $("#fprev"); if (!el || !ui.famount) return;
  const m = N.macrosFor(ui.famount.food.per100, num($("#fgrams").value));
  el.innerHTML = `<div><b>${r0(m.kcal)}</b><small>kcal</small></div><div><b>${r1(m.p)}</b><small>${tx("Protein g")}</small></div><div><b>${r1(m.c)}</b><small>${tx("Kohlenh. g")}</small></div><div><b>${r1(m.f)}</b><small>${tx("Fett g")}</small></div>`;
}
function syncPort() { const f = ui.famount && ui.famount.food, p = $("#fport"); if (f && f.serving && p) { const g = num($("#fgrams").value); p.value = g ? fmt(Math.round(g / f.serving * 100) / 100) : ""; } }
/* ---------- Schnell-Eintrag: nur Kalorien (z. B. Restaurant) ---------- */
// Gespeichert als 1000 g mit Werten pro 100 g = Gesamtwert ÷ 10, damit die normale Rechnung und Import-Prüfung gelten.
function openQuick(entry) {
  ui.fquickEdit = entry || null;
  const v = k => entry ? fmt(Math.round(entry.per100[k] * 10)) : "";
  const mealSel = entry ? entry.meal : ui.fmeal || "snack";
  const fld = (id, label, val) => `<label class="field">${label} <input id="${id}" inputmode="decimal" autocomplete="off" value="${val}"></label>`;
  openDialog(`<h2 id="dlg-h">${entry ? tx("Schnell-Eintrag ändern") : tx("Nur Kalorien eintragen")}</h2>
    <p class="meta" style="text-align:center;margin-top:-10px">${tx("Für Essen ohne Verpackung, etwa im Restaurant. Schätzen ist besser als weglassen.")}</p>
    <p class="err" role="alert" hidden></p>
    <label class="field">${tx("Bezeichnung")} <small style="display:inline">${tx("(optional)")}</small><input id="q-name" autocomplete="off" value="${esc(entry ? entry.name : "")}" placeholder="${tx("z. B. Pizza beim Italiener")}"></label>
    ${fld("q-kcal", tx("Energie (kcal)"), v("kcal"))}
    <p class="meta" style="margin:-4px 0 10px">${tx("Optional, falls bekannt:")}</p>
    <div class="pair">${fld("q-p", tx("Protein (g)"), v("p"))}${fld("q-c", tx("Kohlenh. (g)"), v("c"))}</div>${fld("q-f", tx("Fett (g)"), v("f"))}
    <label class="field">${tx("Mahlzeit")} <select id="q-meal">${N.MEALS.map(([id]) => `<option value="${id}" ${id === mealSel ? "selected" : ""}>${mealName(id)}</option>`).join("")}</select></label>
    <div class="dlg-actions"><button class="btn" data-act="close">${tx("Abbrechen")}</button><button class="btn primary" data-act="quicksave">${entry ? tx("Speichern") : tx("Hinzufügen")}</button></div>
    ${entry ? `<button class="btn destructive" data-act="qdel" style="margin-top:10px">${tx("Eintrag löschen")}</button>` : ""}`, "#q-kcal");
}
function saveQuick() {
  const kcal = num($("#q-kcal").value), p = num($("#q-p").value), c = num($("#q-c").value), f = num($("#q-f").value);
  if (kcal <= 0 || kcal > 9000) return dlgError(tx("Bitte gib eine Energiemenge zwischen 1 und 9000 kcal ein."));
  if (p < 0 || c < 0 || f < 0 || p > 1000 || c > 1000 || f > 1000) return dlgError(tx("Bitte prüfe Protein, Kohlenhydrate und Fett."));
  const name = $("#q-name").value.trim().slice(0, 120) || tx("Schnell-Eintrag"), meal = $("#q-meal").value;
  const per100 = {kcal: kcal / 10, p: p / 10, c: c / 10, f: f / 10};
  if (ui.fquickEdit) Object.assign(ui.fquickEdit, {name, meal, per100});
  else D().food.push({id: St.uid(), date: ui.fday || dkey(), meal, foodId: null, name, brand: "", per100, grams: 1000, quick: true});
  persist(); ui.fmeal = meal; opener = null; closeDialog(); if (location.hash.startsWith("#/ernaehrung")) rerender(); else go("#/ernaehrung");
  say(tx("{name}, {n} kcal eingetragen.", {name, n: r0(kcal)}));
}
function saveAmount() {
  const g = num($("#fgrams").value);
  if (g <= 0 || g > 5000) return dlgError(tx("Bitte gib eine Menge zwischen 1 und 5000 g ein."));
  const {food, entry} = ui.famount, meal = $("#fmealsel").value;
  if (!food.id) { food.id = "f_" + St.uid(); }
  if (!D().foods[food.id]) D().foods[food.id] = {...food};          // Online-Treffer lokal merken, damit sie offline wieder auftauchen
  if (entry) Object.assign(entry, {grams: g, meal, name: food.name, brand: food.brand || "", per100: {...food.per100}});
  else D().food.push({id: St.uid(), date: ui.fday || dkey(), meal, foodId: food.id, name: food.name, brand: food.brand || "", per100: {...food.per100}, grams: g});
  persist(); ui.fmeal = meal; closeDialog(); if (location.hash.startsWith("#/ernaehrung")) rerender(); else go("#/ernaehrung");
  say(entry ? tx("{name}, {n} g geändert.", {name: food.name, n: r0(g)}) : tx("{name}, {n} g eingetragen.", {name: food.name, n: r0(g)}));
}

/* ---------- Eigenes Lebensmittel ---------- */
function openFoodForm(pre = {}, note = "") {
  ui.fentry = null;
  ui.fedit = pre.id && D().foods[pre.id] ? pre.id : null; ui.fwarned = false; ui.fbarcode = pre.barcode || "";
  const v = k => pre.per100 && pre.per100[k] != null ? fmt(Math.round(pre.per100[k] * 10) / 10) : "";
  const fld = (id, label, val) => `<label class="field">${label} <input id="${id}" inputmode="decimal" autocomplete="off" value="${val}"></label>`;
  openDialog(`<h2 id="dlg-h">${ui.fedit ? tx("Lebensmittel bearbeiten") : tx("Neues Lebensmittel")}</h2>
    ${note ? `<p class="note">${esc(note)}</p>` : ""}
    <p class="err" role="alert" hidden></p>
    <label class="field">${tx("Name")} <input id="fn-name" autocomplete="off" value="${esc(pre.name || "")}"></label>
    <label class="field">${tx("Marke")} <small style="display:inline">${tx("(optional)")}</small><input id="fn-brand" autocomplete="off" value="${esc(pre.brand || "")}"></label>
    <p class="meta" style="margin:-4px 0 10px">${tx("Nährwerte pro 100 g, wie auf der Verpackung")}</p>
    <div class="pair">${fld("fn-kcal", tx("Energie (kcal)"), v("kcal"))}${fld("fn-p", tx("Protein (g)"), v("p"))}</div>
    <div class="pair">${fld("fn-c", tx("Kohlenhydrate (g)"), v("c"))}${fld("fn-f", tx("Fett (g)"), v("f"))}</div>
    ${fld("fn-serv", tx("Portion in g (optional)"), pre.serving ? fmt(pre.serving) : "")}
    ${ui.fbarcode ? `<p class="meta">${tx("Barcode: {code}", {code: esc(ui.fbarcode)})}</p>` : ""}
    <div class="dlg-actions"><button class="btn" data-act="close">${tx("Abbrechen")}</button><button class="btn primary" data-act="foodsave">${tx("Speichern")}</button></div>
    ${ui.fedit ? `<button class="btn destructive" data-act="fooddel" style="margin-top:10px">${tx("Lebensmittel löschen")}</button>` : ""}`, "#fn-name");
}
function saveFood() {
  const name = $("#fn-name").value.trim();
  if (!name) return dlgError(tx("Bitte gib dem Lebensmittel einen Namen."));
  const per100 = {kcal: num($("#fn-kcal").value), p: num($("#fn-p").value), c: num($("#fn-c").value), f: num($("#fn-f").value)};
  if (per100.kcal <= 0 || per100.kcal > 900) return dlgError(tx("Energie pro 100 g muss zwischen 1 und 900 kcal liegen (reines Fett hat etwa 900)."));
  if (per100.p + per100.c + per100.f > 100) return dlgError(tx("Protein, Kohlenhydrate und Fett ergeben zusammen mehr als 100 g pro 100 g. Bitte prüfen."));
  // Plausibilität nach Atwater (4/4/9 kcal pro g). Ballaststoffe und Alkohol erklären kleine Abweichungen.
  const calc = N.atwater(per100);
  if (!ui.fwarned && Math.abs(calc - per100.kcal) > Math.max(25, per100.kcal * 0.2)) {
    ui.fwarned = true;
    return dlgError(tx("Aus den Makros ergeben sich etwa {n} kcal, eingetragen sind {m}. Tippfehler? Zum Speichern trotzdem nochmal tippen.", {n: r0(calc), m: r0(per100.kcal)}));
  }
  const food = {id: ui.fedit || "f_" + St.uid(), name, brand: $("#fn-brand").value.trim(), barcode: ui.fbarcode, per100, serving: num($("#fn-serv").value), source: "own"};
  D().foods[food.id] = food; persist(); say(tx("{name} gespeichert.", {name}));
  // Kam die Bearbeitung aus einem Tagebuch-Eintrag, wird genau dieser Eintrag korrigiert statt ein zweiter angelegt.
  openAmount(food, ui.fentry || undefined); ui.fentry = null;
}

/* ---------- Ziele & Quellen ---------- */
function openGoals() {
  const pr = D().profile, kg = St.currentWeight(), miss = N.missing(pr, kg), t = N.computeTargets(pr, kg);
  const seg = `<div class="seg" role="group" aria-label="${tx("Art des Ziels")}" style="margin-bottom:16px">
    <button type="button" data-act="gmode" data-v="0" aria-pressed="${!pr.manual}">${tx("Nach Literatur")}</button>
    <button type="button" data-act="gmode" data-v="1" aria-pressed="${!!pr.manual}">${tx("Selbst festlegen")}</button></div>`;
  const goalSeg = `<div class="seg" role="group" aria-label="${tx("Ziel")}" style="margin-bottom:12px">${Object.entries(N.GOALS).map(([id, g]) => `<button type="button" data-act="pgoal" data-v="${id}" aria-pressed="${pr.goal === id}">${tx(g.l)}</button>`).join("")}</div>`;
  let body;
  if (pr.manual) {
    const fld = (id, label, val) => `<label class="field">${label} <input id="${id}" inputmode="decimal" autocomplete="off" value="${val || ""}"></label>`;
    body = `<p class="err" role="alert" hidden></p>
      ${fld("g-kcal", tx("Energie (kcal pro Tag)"), pr.kcal)}
      <div class="pair">${fld("g-p", tx("Protein (g)"), pr.p)}${fld("g-c", tx("Kohlenhydrate (g)"), pr.c)}</div>${fld("g-f", tx("Fett (g)"), pr.f)}
      ${t && !t.blocked ? `<p class="meta">${tx("Zum Vergleich, nach Literatur berechnet: {kcal} kcal, {p} g Protein, {c} g Kohlenhydrate, {f} g Fett.", {kcal: r0(t.kcal), p: t.p, c: t.c, f: t.f})}</p>` : ""}
      <div class="dlg-actions"><button class="btn" data-act="close">${tx("Abbrechen")}</button><button class="btn primary" data-act="goalsave">${tx("Speichern")}</button></div>`;
  } else if (t && t.blocked) {
    body = `<p class="note">${tx("SATZ berechnet Ziele erst ab {n} Jahren. Die Formel ist für Erwachsene entwickelt, und im Wachstum ist ein Defizit riskant. Sprich mit deiner Ärztin, deinem Arzt oder einer Ernährungsberatung.", {n: N.MIN_AGE})}</p>
      <button class="btn" data-act="close">${tx("Schließen")}</button>`;
  } else if (!t) {
    body = `<p>${tx("Für die Berechnung fehlt noch: <b>{list}</b>.", {list: esc(miss.join(", "))})}</p>
      <a class="btn primary" href="#/mehr/profil">${tx("Persönliche Daten eintragen")}</a>`;
  } else {
    const s = t.steps, g = s.goal, sexTxt = pr.sex === "m" ? tx("+ 5 (Männer)") : pr.sex === "w" ? tx("− 161 (Frauen)") : tx("− 78 (Mittelwert, keine Angabe)");
    body = `${goalSeg}${t.warnings.map(w => `<p class="note">${esc(w)}</p>`).join("")}<p class="meta">${esc(tx(g.why))}</p>
      <ol class="steps">
        <li>${tx("Grundumsatz nach Mifflin-St Jeor: 10 × {kg} kg + {f} × {cm} cm − 5 × {y} Jahre {sex} = <b>{bmr} kcal</b>", {kg: fmt(s.kg), f: fmt(6.25), cm: fmt(pr.height), y: s.years, sex: sexTxt, bmr: r0(s.bmr)})}</li>
        ${s.adj ? `<li>${tx("Gesamtbedarf aus deinen eigenen Daten (Essen und Gewichtstrend, Stand {date}): <b>{n} kcal</b>. Die Formel ergäbe {m} kcal.", {date: shortDate(s.adj.date + "T12:00:00"), n: r0(s.tdee), m: r0(Math.round(s.bmr * s.pal / 10) * 10)})} <button type="button" class="linkbtn" data-act="adaptoff">${tx("Wieder die Formel nutzen")}</button></li>`
          : `<li>${tx("× Aktivitätsfaktor (PAL) {pal} = <b>{n} kcal</b> Gesamtbedarf", {pal: fmt(s.pal), n: r0(s.tdee)})}</li>`}
        <li>${tx("Ziel „{goal}“:", {goal: tx(g.l)})} ${g.rate ? tx("{rate} % Körpergewicht pro Woche × 7700 kcal/kg ÷ 7 = <b>{d} kcal</b> pro Tag", {rate: (g.rate > 0 ? "+" : "−") + fmt(Math.abs(g.rate) * 100), d: (s.delta > 0 ? "+" : "−") + r0(Math.abs(s.delta))}) : "<b>± 0 kcal</b>"}</li>
        <li>${tx("Tagesziel (gerundet): <b>{n} kcal</b>", {n: r0(t.kcal)})}</li>
        <li>${tx("Protein: {g} g × {kg} kg = <b>{n} g</b>", {g: fmt(g.protein), kg: fmt(s.kg), n: t.p})}</li>
        <li>${tx("Fett: 25 % der Energie ÷ 9 kcal/g, mindestens {min} g/kg = <b>{n} g</b>", {min: fmt(0.6), n: t.f})}</li>
        <li>${tx("Kohlenhydrate: der Rest ÷ 4 kcal/g = <b>{n} g</b>", {n: t.c})}</li>
      </ol>
      <p class="meta">${tx("Das sind Schätzwerte für gesunde Erwachsene. Die Formel liegt bei den meisten Menschen innerhalb von ±10 % (Frankenfield et al. 2005). Beobachte dein Gewicht 2–3 Wochen und passe dann an. Kein Ersatz für ärztliche oder ernährungsberaterische Beratung, etwa bei Schwangerschaft oder Essstörungen.")}</p>
      <button class="btn" data-act="close">${tx("Fertig")}</button>`;
  }
  openDialog(`<h2 id="dlg-h">${tx("Ziele &amp; Quellen")}</h2>${seg}${body}
    <h3 style="margin:20px 0 8px">${tx("Quellen")}</h3>
    <ol class="sources">${N.SOURCES.map(([a, t2, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(a)}</a>: ${esc(tx(t2))}</li>`).join("")}</ol>`, pr.manual ? "#g-kcal" : null);
}
function saveGoals() {
  const v = {kcal: Math.round(num($("#g-kcal").value)), p: Math.round(num($("#g-p").value)), c: Math.round(num($("#g-c").value)), f: Math.round(num($("#g-f").value))};
  if (v.kcal < 800 || v.kcal > 8000) return dlgError(tx("Bitte gib eine Energiemenge zwischen 800 und 8000 kcal ein."));
  const kg = St.currentWeight();
  if (!ui.gwarned2 && (v.kcal < N.MIN_KCAL || (kg && v.f && v.f < kg * N.MIN_FAT_PER_KG))) { ui.gwarned2 = true; return dlgError(tx("Unter {kcal} kcal oder unter {fat} g Fett pro kg ist für die meisten Erwachsenen zu wenig und sollte ärztlich begleitet sein. Zum Speichern trotzdem nochmal tippen.", {kcal: N.MIN_KCAL, fat: fmt(N.MIN_FAT_PER_KG)})); }
  const macro = v.p * 4 + v.c * 4 + v.f * 9;
  if (macro && Math.abs(macro - v.kcal) > v.kcal * 0.1 && !ui.gwarned) { ui.gwarned = true; return dlgError(tx("Die Makros ergeben {n} kcal, das Ziel sind {m} kcal. Zum Speichern trotzdem nochmal tippen.", {n: r0(macro), m: r0(v.kcal)})); }
  Object.assign(D().profile, v, {manual: true}); persist(); closeDialog(); rerender(); toast(tx("Eigenes Ziel gespeichert."));
}

/* ---------- Barcode-Scanner ---------- */
const scan = {stream: null, timer: 0, reader: null, busy: false};
function stopScanner() {
  clearTimeout(scan.timer); scan.timer = 0;
  if (scan.reader) { try { scan.reader.reset(); } catch (e) {} scan.reader = null; }
  if (scan.stream) { scan.stream.getTracks().forEach(t => t.stop()); scan.stream = null; }
}
const scanStatus = t => { const el = $("#scanst"); if (el) el.textContent = t; };
function loadZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  return new Promise((ok, fail) => { const s = document.createElement("script"); s.src = "js/vendor/zxing.min.js"; s.onload = () => ok(window.ZXing); s.onerror = fail; document.head.append(s); });
}
async function openScanner() {
  scan.busy = false;
  openDialog(`<h2 id="dlg-h">${tx("Barcode scannen")}</h2>
    <div class="scanbox"><video id="scanv" playsinline muted autoplay aria-label="${tx("Kamerabild")}"></video></div>
    <p class="meta" id="scanst" role="status">${tx("Kamera wird gestartet …")}</p>
    <div class="inline"><label class="field">${tx("Oder Nummer eingeben")} <input id="bc" inputmode="numeric" autocomplete="off" pattern="[0-9]*"></label><button class="btn" data-act="bclookup">${tx("Suchen")}</button></div>
    <button class="btn" data-act="close">${tx("Abbrechen")}</button>`, "h2");
  const video = $("#scanv");
  if (!navigator.mediaDevices?.getUserMedia) { scanStatus(tx("Dieses Gerät erlaubt hier keinen Kamerazugriff. Gib die Nummer unter dem Barcode ein.")); return; }
  const constraints = {video: {facingMode: {ideal: "environment"}, width: {ideal: 1280}, height: {ideal: 720}}, audio: false};
  try {
    let native = false;
    if ("BarcodeDetector" in window) { try { native = (await BarcodeDetector.getSupportedFormats()).includes("ean_13"); } catch (e) {} }
    if (native) {
      scan.stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!dlg.open) return stopScanner();
      video.srcObject = scan.stream; await video.play().catch(() => {});
      const det = new BarcodeDetector({formats: ["ean_13", "ean_8", "upc_a", "upc_e"]});
      scanStatus(tx("Halte den Barcode in den Rahmen."));
      const tick = async () => {
        if (!scan.stream) return;
        try { const r = await det.detect(video); if (r.length) return found(r[0].rawValue); } catch (e) {}
        scan.timer = setTimeout(tick, 200);
      };
      tick();
    } else {
      const Z = await loadZXing();
      if (!dlg.open) return;
      const hints = new Map([[Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]]]);
      scan.reader = new Z.BrowserMultiFormatReader(hints, 250);
      scanStatus(tx("Halte den Barcode in den Rahmen."));
      await scan.reader.decodeFromConstraints(constraints, video, res => { if (res && scan.reader) found(res.getText()); });
      scan.stream = video.srcObject;
    }
  } catch (e) {
    stopScanner();
    scanStatus(e && e.name === "NotAllowedError"
      ? tx("Kein Kamerazugriff erlaubt. Du kannst ihn in den iPhone-Einstellungen erlauben oder die Nummer unter dem Barcode eingeben.")
      : tx("Die Kamera ließ sich nicht starten. Gib die Nummer unter dem Barcode ein."));
  }
}
function found(code) {
  if (scan.busy) return; scan.busy = true;
  if (navigator.vibrate) navigator.vibrate(30);
  stopScanner(); lookupBarcode(code);
}
async function lookupBarcode(code) {
  code = String(code).replace(/\D/g, "");
  if (code.length < 8) { scan.busy = false; return scanStatus(tx("Ein Barcode hat 8 bis 13 Ziffern.")); }
  const local = Object.values(D().foods).find(f => f.barcode === code);
  if (local) return openAmount(local);
  scanStatus(tx("Barcode {code}: suche bei Open Food Facts …", {code}));
  try {
    const p = await N.offProduct(code);
    if (!dlg.open) return;
    if (p) openAmount(p);
    else openFoodForm({barcode: code}, tx("Barcode {code} ist bei Open Food Facts nicht eingetragen. Leg das Lebensmittel mit den Werten von der Verpackung an. Beim nächsten Scan findet SATZ es dann.", {code}));
  } catch (e) {
    openFoodForm({barcode: code}, tx("Open Food Facts ist gerade nicht erreichbar. Trag die Werte von der Verpackung ein."));
  }
}

/* ---------- Persönliche Daten (Mehr) ---------- */
function profileSection() {
  const pr = D().profile, kg = St.currentWeight(), years = N.age(pr.birth), lastW = D().weights[D().weights.length - 1];
  return `<h2 class="sec" style="margin-top:4px">${tx("Persönliche Daten")}</h2>
    <div class="pair">
      <label class="field">${tx("Geburtsdatum")} <input type="date" data-on="pbirth" value="${esc(pr.birth)}" max="${dkey()}" min="1900-01-01"></label>
      <div class="field">${tx("Alter")} <span class="exsel" style="min-height:48px" id="p-age" aria-live="polite">${ageText(years)}</span></div>
    </div>
    <div class="pair">
      <label class="field">${tx("Größe (cm)")} <input data-on="pheight" inputmode="decimal" autocomplete="off" value="${pr.height || ""}"></label>
      <label class="field">${tx("Gewicht (kg)")} <input data-on="pweight" inputmode="decimal" autocomplete="off" value="${kg ? fmt(kg) : ""}"></label>
    </div>
    <label class="field">${tx("Geschlecht")} <small style="display:inline">${tx("(für die Grundumsatz-Formel)")}</small><select data-on="psex">
      ${[["", "Bitte wählen"], ["m", "Männlich"], ["w", "Weiblich"], ["x", "Keine Angabe (Mittelwert)"]].map(([v, l]) => `<option value="${v}" ${pr.sex === v ? "selected" : ""}>${tx(l)}</option>`).join("")}</select></label>
    <label class="field">${tx("Aktivität im Alltag")} <select data-on="ppal" aria-describedby="p-pal">${N.PAL.map(a => `<option value="${a.v}" ${pr.pal === a.v ? "selected" : ""}>${tx(a.l)}</option>`).join("")}</select><small id="p-pal">${tx((N.PAL.find(a => a.v === pr.pal) || {d: ""}).d)}</small></label>
    <div class="field" style="margin-bottom:8px"><span id="l-goal">${tx("Ziel")}</span>
      <div class="seg" role="group" aria-labelledby="l-goal" style="margin-top:6px">${Object.entries(N.GOALS).map(([id, g]) => `<button type="button" data-act="pgoal" data-v="${id}" aria-pressed="${pr.goal === id}">${tx(g.l)}</button>`).join("")}</div></div>
    ${iL(tx("Wofür SATZ diese Angaben nutzt"), `${lastW ? tx("Gewicht zuletzt eingetragen am {date}.", {date: new Date(lastW.date + "T12:00:00").toLocaleDateString(L())}) + " " : ""}${tx("Das Alter rechnet sich an deinem Geburtstag automatisch hoch. Die Angaben bleiben auf diesem Gerät und dienen nur der Berechnung deines Bedarfs unter Ernährung.")}`)}`;
}
const ageText = y => y != null ? txn(y, "{n} Jahr", "{n} Jahre") : "–";
function accentRow() {
  const s = D().settings, dark = isDark();
  return `<div class="row stack"><span id="l-acc">${tx("Akzentfarbe")}</span>
    <div class="swatches" role="group" aria-labelledby="l-acc">${ACCENTS.map(([id, l, c1, c2]) => `<button type="button" data-act="set" data-k="accent" data-v="${id}" aria-pressed="${s.accent === id}"><i style="background:${dark ? c2 : c1}"></i>${tx(l)}</button>`).join("")}</div></div>`;
}

Object.assign(A, {
  fday: t => { ui.fday = shiftDay(ui.fday || dkey(), +t.dataset.d); if (ui.fday > dkey()) ui.fday = dkey(); rerender(`[data-act="fday"][data-d="${t.dataset.d}"]:not(:disabled)`); },
  fadd: t => openFoodAdd(t.dataset.m),
  fedit: t => { const e = D().food.find(x => x.id === t.dataset.id); if (e && e.quick) return openQuick(e); if (e) openAmount(D().foods[e.foodId] ? {...D().foods[e.foodId], per100: e.per100} : {name: e.name, brand: e.brand, per100: e.per100}, e); },
  qdel: () => {
    const e = ui.fquickEdit, snap = St.snapshot();
    D().food = D().food.filter(x => x.id !== e.id); persist(); opener = null; closeDialog(); rerender(); view.querySelector("h1").focus();
    toast(tx("{name} gelöscht.", {name: e.name}), () => { St.restore(snap); rerender(); });
  },
  fdel: () => {
    const e = ui.famount.entry, snap = St.snapshot();
    D().food = D().food.filter(x => x.id !== e.id); persist(); opener = null; closeDialog(); rerender(); view.querySelector("h1").focus();
    toast(tx("{name} gelöscht.", {name: e.name}), () => { St.restore(snap); rerender(); });
  },
  pickfood: t => openAmount(ui.fcands[+t.dataset.i]),
  fgset: t => { $("#fgrams").value = fmt(+t.dataset.g); syncPort(); updatePreview(); },
  ffav: t => {
    const food = ui.famount.food;
    if (!food.id) food.id = "f_" + St.uid();
    if (!D().foods[food.id]) D().foods[food.id] = {...food};
    const f = D().foods[food.id]; if (f.fav) delete f.fav; else f.fav = true; persist();
    t.setAttribute("aria-pressed", String(!!f.fav)); t.innerHTML = `<span aria-hidden="true">${f.fav ? "★" : "☆"}</span> ${f.fav ? tx("Favorit") : tx("Als Favorit merken")}`;
    say(f.fav ? tx("{name} ist jetzt Favorit.", {name: f.name}) : tx("{name} ist kein Favorit mehr.", {name: f.name}));
  },
  fcopyprev: t => {
    const k = ui.fday || dkey(), m = t.dataset.m, prev = D().food.filter(e => e.date === shiftDay(k, -1) && (!m || e.meal === m)), snap = St.snapshot();
    prev.forEach(e => D().food.push({...e, per100: {...e.per100}, id: St.uid(), date: k}));
    persist(); rerender(); view.querySelector("h1").focus();
    toast(txn(prev.length, "{n} Eintrag vom Vortag übernommen.", "{n} Einträge vom Vortag übernommen."), () => { St.restore(snap); rerender(); });
  },
  fcopymeal: t => A.fcopyprev(t),
  fquick: () => openQuick(),
  quicksave: () => saveQuick(),
  amountsave: () => saveAmount(),
  newfood: () => openFoodForm({name: (ui.fq || "").trim()}),
  foodedit: () => { const en = ui.famount.entry; openFoodForm(D().foods[ui.famount.food.id]); ui.fentry = en || null; },
  foodsave: () => saveFood(),
  fooddel: () => {
    const f = D().foods[ui.fedit], snap = St.snapshot();
    delete D().foods[ui.fedit]; persist(); opener = null; closeDialog(); rerender();
    toast(tx("{name} gelöscht. Einträge im Tagebuch bleiben.", {name: f.name}), () => { St.restore(snap); rerender(); });
  },
  offsearch: async () => {
    const q = ui.fq.trim(); ui.foffState = "loading"; renderFoodResults();
    try { ui.foff = (await N.offSearch(q)).slice(0, 20); ui.foffState = ""; } catch (e) { ui.foff = null; ui.foffState = "error"; }
    if (ui.fq.trim() === q) { renderFoodResults(); say(ui.foff ? txn(ui.foff.length, "{n} Treffer bei Open Food Facts.", "{n} Treffer bei Open Food Facts.") : tx("Suche fehlgeschlagen.")); }
  },
  scan: () => openScanner(),
  bclookup: () => { stopScanner(); scan.busy = true; lookupBarcode($("#bc").value); },
  adapt: t => {
    const pr = D().profile, snap = St.snapshot();
    pr.tdeeAdj = {tdee: +t.dataset.v, date: dkey(), days: +t.dataset.n}; pr.manual = false;
    persist(); rerender(); toast(tx("Neues Ziel: {n} kcal pro Tag.", {n: r0(targets().kcal)}), () => { St.restore(snap); rerender(); });
  },
  adaptoff: () => { const snap = St.snapshot(); delete D().profile.tdeeAdj; persist(); openGoals(); rerender(); toast(tx("Ziel wieder nach Formel."), () => { St.restore(snap); rerender(); }); },
  goals: () => { ui.gwarned = false; ui.gwarned2 = false; openGoals(); },
  gmode: t => { D().profile.manual = t.dataset.v === "1"; persist(); openGoals(); rerender(); const b = dlg.querySelector(`[data-act="gmode"][data-v="${t.dataset.v}"]`); if (b) b.focus(); },
  goalsave: () => saveGoals(),
  pgoal: t => {
    D().profile.goal = t.dataset.v; persist();
    if (dlg.open) { openGoals(); const b = dlg.querySelector(`[data-act="pgoal"][data-v="${t.dataset.v}"]`); if (b) b.focus(); rerender(); }
    else rerender(`[data-act="pgoal"][data-v="${t.dataset.v}"]`);
  },
});
document.addEventListener("input", ev => {
  const k = ev.target.dataset.on;
  if (k === "fq") { ui.fq = ev.target.value; ui.foff = null; ui.foffState = ""; renderFoodResults(); }
  if (k === "fgrams") { syncPort(); updatePreview(); }
  if (k === "fport") { const f = ui.famount && ui.famount.food, n = num(ev.target.value); if (f && f.serving) $("#fgrams").value = n ? fmt(Math.round(n * f.serving * 10) / 10) : ""; updatePreview(); }
});
document.addEventListener("change", ev => {
  const el = ev.target, k = el.dataset.on, pr = D().profile;
  if (!k || !k.startsWith("p") || k === "pm" || k === "pq" || k === "pname") return;
  const hadT = !!targets();
  queueMicrotask(() => { if (!hadT && targets() && location.hash.startsWith("#/ernaehrung")) { rerender(); say(tx("Dein Bedarf ist jetzt berechnet.")); } });
  if (k === "pbirth") { pr.birth = el.value; const y = N.age(pr.birth); $("#p-age").textContent = ageText(y); }
  if (k === "psex") pr.sex = el.value;
  if (k === "ppal") { pr.pal = +el.value; const a = N.PAL.find(x => x.v === pr.pal); if ($("#p-pal")) $("#p-pal").textContent = a ? tx(a.d) : ""; }
  if (k === "pheight") { const v = num(el.value); if (v && (v < 100 || v > 250)) { toast(tx("Größe bitte in Zentimetern, zwischen 100 und 250.")); el.value = pr.height || ""; return; } pr.height = v; }
  if (k === "pweight") {
    const v = Math.round(num(el.value) * 10) / 10;
    if (v && (v < 30 || v > 300)) { toast(tx("Gewicht bitte in Kilogramm, zwischen 30 und 300.")); el.value = St.currentWeight() ? fmt(St.currentWeight()) : ""; return; }
    if (v) { const w = D().weights, today = dkey(), last = w[w.length - 1]; if (last && last.date === today) last.kg = v; else w.push({date: today, kg: v}); }
  }
  persist();
});
dlg.addEventListener("close", stopScanner);

let sayT;
function sayLater(t) { clearTimeout(sayT); sayT = setTimeout(() => say(t), 350); }
// Gedrückt halten auf ± wiederholt den Schritt (erst nach 400 ms, dann immer schneller)
(() => {
  let timer = 0, fired = false;
  const stop = () => { clearTimeout(timer); timer = 0; };
  document.addEventListener("pointerdown", ev => {
    const t = ev.target.closest('[data-act="kg"],[data-act="reps"]'); if (!t) return;
    fired = false; let delay = 400;
    const step = () => { fired = true; A[t.dataset.act](t); delay = Math.max(60, delay * 0.8); timer = setTimeout(step, delay); };
    timer = setTimeout(step, delay);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(n => document.addEventListener(n, stop, true));
  document.addEventListener("click", ev => { if (fired && ev.target.closest('[data-act="kg"],[data-act="reps"]')) { ev.stopPropagation(); ev.preventDefault(); fired = false; } }, true);
  document.addEventListener("contextmenu", ev => { if (ev.target.closest('[data-act="kg"],[data-act="reps"]')) ev.preventDefault(); });
})();

/* ============ Start ============ */
// Sprache: gespeicherte Wahl, beim allerersten Start bis zur Auswahl die Gerätesprache
function applyLang() { I.setLang(D().settings.lang || I.guess()); I.applyStatic(); }
St.load(APP_VERSION);
applyLang();
applySettings();
// Ladebildschirm: 2 s mit Balken und Version, nur beim ersten Start nach dem Schließen der App.
// Zurückkehren aus dem Hintergrund lädt die Seite nicht neu; Neuladen in derselben Sitzung (Update) merkt sich sessionStorage.
// Ganz neuer Start (noch keine Sprache gespeichert): Der Ladebildschirm bleibt stehen und zeigt die Sprachauswahl.
(() => {
  const sp = $("#splash"); if (!sp) return;
  const pick = !D().settings.lang;
  let seen = false; try { seen = sessionStorage.getItem("satz-splash") === "1"; sessionStorage.setItem("satz-splash", "1"); } catch (e) {}
  if (seen && !pick) { sp.remove(); return; }
  $("#splashVer").textContent = tx("Version {v}", {v: APP_VERSION});
  sp.setAttribute("aria-label", tx("SATZ wird geladen, Version {v}", {v: APP_VERSION}));
  const hide = () => { if (sp.classList.contains("out")) return; sp.classList.add("out"); setTimeout(() => sp.remove(), 350); };
  if (D().active) { sp.remove(); return; }
  if (pick) { setTimeout(() => langPicker(sp, hide), seen ? 0 : 900); return; }
  sp.addEventListener("click", hide);
  setTimeout(hide, 2000);
})();
// Sprachauswahl im Ladebildschirm. Vorbelegt mit der Gerätesprache; Überschrift und Knopf wechseln beim Antippen
// sofort in die gewählte Sprache. Erst „Weiter“ speichert, vorher bleibt nichts auf dem Gerät.
function langPicker(sp, hide) {
  let sel = I.lang();
  const box = $("#splashLang"), tIn = (s, v) => I.tIn(sel, s, v);
  // Name der Sprache in der gerade gewählten Sprache („Englisch“ unter „English“), damit man sich zurechtfindet
  const nameIn = id => { try { const n = new Intl.DisplayNames([sel], {type: "language"}).of(id); return n && n.toLowerCase() !== I.LANGS.find(l => l.id === id).name.toLowerCase() ? n[0].toUpperCase() + n.slice(1) : ""; } catch (e) { return ""; } };
  sp.classList.add("pick"); sp.setAttribute("role", "dialog"); sp.setAttribute("aria-modal", "true"); sp.setAttribute("aria-labelledby", "lang-h"); sp.removeAttribute("aria-label");
  document.querySelector(".app").inert = true;
  const draw = focusId => {
    box.innerHTML = `<h2 id="lang-h">${tIn("Sprache wählen")}</h2><p>${tIn("Lässt sich jederzeit unter Mehr ändern.")}</p>
      <ul class="langlist" role="radiogroup" aria-labelledby="lang-h">${I.LANGS.map(l => `<li><button type="button" role="radio" lang="${l.id}" data-lang="${l.id}" aria-checked="${l.id === sel}" tabindex="${l.id === sel ? 0 : -1}">
        <span>${esc(l.name)}${l.id !== sel && nameIn(l.id) ? `<small lang="${sel}">${esc(nameIn(l.id))}</small>` : ""}</span><svg class="chk" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></li>`).join("")}</ul>
      <button type="button" class="btn primary" id="langGo" lang="${sel}">${tIn("Weiter")}</button>`;
    box.hidden = false;
    const f = focusId ? box.querySelector(`[data-lang="${focusId}"]`) : box.querySelector("#langGo");
    if (f) f.focus();
  };
  const choose = id => { sel = id; I.setLang(id); draw(id); };
  box.addEventListener("click", ev => {
    const b = ev.target.closest("[data-lang]"); if (b) return choose(b.dataset.lang);
    if (ev.target.closest("#langGo")) {
      D().settings.lang = sel; persist(); applyLang(); route();
      document.querySelector(".app").inert = false; hide();
    }
  });
  // Pfeiltasten wie bei Radio-Buttons
  box.addEventListener("keydown", ev => {
    const b = ev.target.closest("[data-lang]"); if (!b) return;
    const ids = I.LANG_IDS, i = ids.indexOf(b.dataset.lang), d = {ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1}[ev.key];
    if (d) { ev.preventDefault(); choose(ids[(i + d + ids.length) % ids.length]); }
  });
  draw();
}
// Speicher dauerhaft anfordern, damit Safari ihn nicht nach Wochen ohne Nutzung räumt
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applySettings);
window.addEventListener("hashchange", route);
route();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  // Neue Version übernommen: einmal neu laden, damit das Update sofort sichtbar ist (nicht mitten im Training).
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController && !D().active) location.reload(); });
  navigator.serviceWorker.register("sw.js", {updateViaCache: "none"}).then(r => {
    r.update();
    // iOS lässt eine installierte App im Hintergrund weiterlaufen; "Schließen" lädt sie oft nicht neu.
    // Deshalb beim Zurückkehren nach Updates schauen (höchstens alle 30 s). Ein neuer Service Worker
    // übernimmt dann und löst oben den einmaligen Neustart aus (nie während eines Trainings).
    let last = Date.now();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && Date.now() - last > 30000) { last = Date.now(); r.update().catch(() => {}); }
    });
  }).catch(() => {});
}
