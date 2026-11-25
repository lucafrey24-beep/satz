import * as St from "./store.js";
import {MUSCLES, MUSCLE_NAME, TEMPLATES, INFO, PATTERN_BY_MUSCLE, GOALS as TGOALS, MEASURES, KIT, KIT_LABEL, KIT_FILTERS, kitMatch, noLoad, isMobility} from "./data.js";
import * as AN from "./anim.js";
import * as BELL from "./bell.js";
import * as N from "./nutrition.js";

/* ============ Hilfen ============ */
const $ = s => document.querySelector(s);
const view = $("#view"), dlg = $("#dlg"), tabs = $("#tabs"), bar = $("#appbar");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
const D = () => St.S;
export const APP_VERSION = "0.9.8";
const ui = {day: null, eday: 0, summary: false, key: "", kg: 0, reps: 8, rir: null, draft: null, draftNew: false, pq: "", pm: "", kit: "", exq: "", histEx: ""};
const fmt = St.fmt;
const scheme = sl => `${sl.sets}×${sl.min}–${sl.max}${St.ex(sl.exId).unit === "s" ? " s" : ""}`;
const schemeSr = sl => `${sl.sets} ${sl.sets === 1 ? "Satz" : "Sätze"}, ${sl.min} bis ${sl.max} ${St.repWord(St.ex(sl.exId))}`;
const dateDe = iso => new Date(iso).toLocaleDateString("de-DE", {weekday: "short", day: "numeric", month: "numeric"});
const muscleList = e => [...e.primary.map(m => MUSCLE_NAME[m]), ...e.secondary.map(m => MUSCLE_NAME[m] + " (mit)")].join(", ");
// Gerät der Übung (nur Bibliothek) und Auswahlfeld für den Gerätefilter. Der Filter gilt für Auswahl und Übungsliste gemeinsam.
const kitOf = e => !e.custom && KIT_LABEL[KIT[e.id]] ? KIT_LABEL[KIT[e.id]] : "";
const exMeta = e => [muscleList(e), kitOf(e)].filter(Boolean).join(" · ");
const kitSelect = on => `<label class="field">Gerät <select data-on="${on}">${KIT_FILTERS.map(f => `<option value="${f.id}" ${ui.kit === f.id ? "selected" : ""}>${f.l}</option>`).join("")}</select></label>`;

function say(t) { const a = $("#announcer"); a.textContent = ""; setTimeout(() => a.textContent = t, 60); }

let toastTimer;
function toast(msg, undo) {
  const t = $("#toast");
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? `<button type="button" id="toastUndo">Rückgängig</button>` : ""}`;
  t.hidden = false;
  if (undo) $("#toastUndo").onclick = () => { undo(); hideToast(); say("Rückgängig gemacht."); };
  clearTimeout(toastTimer);
  const hide = () => { if (t.contains(document.activeElement)) toastTimer = setTimeout(hide, 4000); else hideToast(); };
  // Mit „Rückgängig“ bleibt der Hinweis 30 s (WCAG 2.2.1: genug Zeit), sonst 6 s
  toastTimer = setTimeout(hide, undo ? 30000 : 6000);
}
function hideToast() { $("#toast").hidden = true; }

function persist() { if (!St.save()) toast("Speichern fehlgeschlagen. Ist der Speicher voll?"); }

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
const ROUTES = {koerper: viewBody, heute: viewToday, plaene: viewPlans, vorlage: viewTemplate, plan: viewEditor, uebungen: viewExercises, verlauf: viewHistory, ernaehrung: viewNutrition, mehr: viewMore, training: viewTraining};
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
  renderBar(training, name);
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
const tabFor = n => ({vorlage: "plaene", plan: "plaene", uebungen: "plaene", koerper: "plaene"})[n] || n;
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
function rerender(focusSel) {
  const top = view.scrollTop;
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  (ROUTES[parts[0]] || viewToday)(parts[1]);
  view.scrollTop = top;
  AN.startAnim();
  if (focusSel) { const f = view.querySelector(focusSel); if (f) f.focus({preventScroll: false}); }
}
const BACK = {vorlage: ["#/plaene", "Pläne"], plan: ["#/plaene", "Pläne"], uebungen: ["#/plaene", "Pläne"], koerper: ["#/plaene", "Pläne"]};
function renderBar(training, name) {
  const a = D().active, back = BACK[name];
  bar.classList.remove("titled");
  bar.innerHTML = training && a
    ? `<span class="navl"><button class="navbtn minbtn" data-act="mini" aria-label="Training verkleinern, Timer läuft weiter"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M5 9l7 7 7-7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="navbtn" data-act="end">Beenden</button></span><span class="ctx">${esc(a.dayName)}</span>
       <button class="navbtn strong" data-act="overview" aria-haspopup="dialog">Übersicht</button>`
    : back
      ? `<a class="navbtn back" href="${back[0]}"><span aria-hidden="true">‹</span> ${back[1]}<span class="sr"> (zurück)</span></a><span class="ctx" id="barTitle" aria-hidden="true"></span><span class="navspace" aria-hidden="true"></span>`
      : `<a class="wordmark" href="#/heute" aria-label="SATZ, zur Startseite">SATZ<span aria-hidden="true">.</span></a><span class="ctx" id="barTitle" aria-hidden="true"></span><span class="navspace" aria-hidden="true"></span>`;
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
    ${p.days.map((d, i) => `<button type="button" aria-pressed="${i === sel}" data-act="${act}" data-i="${i}"><span class="d">Tag ${i + 1}</span><span class="m">${esc(d.name)}</span></button>`).join("")}
    ${add ? `<button type="button" class="add" data-act="addday" aria-label="Tag hinzufügen"><span class="d" aria-hidden="true">+</span><span class="m">Tag</span></button>` : ""}
  </div>`;
}
const stLabel = {low: "unter 10", ok: "10–20", high: "über 20", "": ""};
function volumeTable(v, caption, compare) {
  return `<div class="table-wrap"><table><caption class="sr">${esc(caption)}</caption>
    <thead><tr><th scope="col">Muskel</th>${compare ? `<th scope="col" class="n">Ist</th>` : ""}<th scope="col" class="n">${compare ? "Plan" : "Sätze/Wo."}</th><th scope="col">${compare ? "Plan-Bereich" : "Bereich"}</th></tr></thead>
    <tbody>${MUSCLES.map(m => { const x = compare ? compare[m.id] : v[m.id], st = St.volStatus(m, x); return `<tr><th scope="row" style="font-size:.95rem;letter-spacing:0;text-transform:none;color:inherit">${m.name}</th>
      ${compare ? `<td class="n">${fmt(Math.round(v[m.id] * 10) / 10)}</td>` : ""}<td class="n">${fmt(Math.round(x * 10) / 10)}</td>
      <td class="st-${st || "none"}">${st ? (st === "ok" ? "✓ " : "! ") + stLabel[st] : "–"}</td></tr>`; }).join("")}</tbody></table></div>
    <p class="foot">Mitarbeitende Muskeln zählen als halber Satz. Für Muskelaufbau gelten etwa 10–20 harte Sätze pro Muskel und Woche als guter Bereich.</p>`;
}
function lowMuscles(v) { return MUSCLES.filter(m => St.volStatus(m, v[m.id]) === "low").map(m => m.name); }
function templateCard(t, compact) {
  return `<article class="card" aria-labelledby="t-${t.id}">
    <h3 id="t-${t.id}">${esc(t.name)}</h3>
    <p class="meta">${goalLabel(t.goal)} · ${t.level} · ${t.days.length} ${t.days.length === 1 ? "Tag" : "Tage"} · ${t.perWeek}× pro Woche</p>
    ${compact ? "" : `<p>${esc(t.desc)}</p>`}
    <div class="row-btns"><a class="btn small" href="#/vorlage/${t.id}">Ansehen</a>
      <button class="btn small primary" data-act="adopt" data-id="${t.id}">Übernehmen</button></div>
  </article>`;
}
const goalLabel = g => (TGOALS.find(x => x.id === g) || TGOALS[0]).l;
// Fertige Pläne mit Filter nach Trainingsziel
function templatesBlock(compact) {
  const g = ui.tgoal || "all", list = TEMPLATES.filter(t => g === "all" || (g === "home" ? t.home : t.goal === g)), gd = TGOALS.find(x => x.id === g);
  return `<div class="seg wrap" role="group" aria-label="Trainingsziel" style="margin-bottom:10px">
      ${[["all", "Alle"], ["home", "Zu Hause"], ...TGOALS.map(x => [x.id, x.l])].map(([v, l]) => `<button type="button" data-act="tgoal" data-v="${v}" aria-pressed="${g === v}">${l}</button>`).join("")}</div>
    <p class="meta" aria-live="polite">${gd ? esc(gd.d) + " " : g === "home" ? "Pläne mit Kurzhanteln, Band oder ganz ohne Gerät. " : ""}${list.length} ${list.length === 1 ? "Plan" : "Pläne"}.</p>
    ${list.map(t => templateCard(t, compact)).join("")}`;
}
function bodyCard() {
  return `<a class="card linkcard" href="#/koerper"><span class="lc-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><circle cx="12" cy="4.5" r="2.4" fill="currentColor"/><path d="M12 8v7m0 0-3 6m3-6 3 6M12 9.5 6.5 14M12 9.5l5.5 4.5" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg></span>
    <span><b>Körperkarte</b><small>Muskel antippen, passende Übungen mit Ablauf sehen und zum Plan hinzufügen.</small></span><span class="chev" aria-hidden="true">›</span></a>`;
}
function emptyPlanBtn() { return `<button class="btn" data-act="newplan">Leeren Plan anlegen</button>`; }

/* ============ Heute ============ */
function viewToday() {
  const p = St.activePlan();
  if (!p) {
    view.innerHTML = `<h1 class="big">Willkommen bei SATZ.</h1>
      <p>SATZ ist dein Trainingsheft: Plan wählen, Satz für Satz eintragen, und die App sagt dir, wann du steigern kannst.</p>
      <p>Wähle einen Plan als Startpunkt. Du kannst später alles ändern, Übungen tauschen und eigene anlegen.</p>
      <h2 class="sec">Fertige Pläne</h2>
      ${templatesBlock(false)}
      ${emptyPlanBtn()}<div style="height:24px"></div>`;
    return;
  }
  if (!p.days.length) {
    view.innerHTML = `<p class="eyebrow">Plan: ${esc(p.name)}</p><h1 class="big">Noch leer</h1><p>Leg den ersten Trainingstag an.</p>
      <a class="btn primary" href="#/plan/${p.id}">Plan bearbeiten</a>`;
    return;
  }
  const di = ui.day != null && ui.day < p.days.length ? ui.day : St.nextDayIndex(p);
  const dlw = St.deloadNow(p), dsl = sl => dlw ? {...sl, sets: St.deloadSets(sl.sets)} : sl;
  const d = p.days[di], sets = d.slots.reduce((a, s) => a + dsl(s).sets, 0);
  const mins = Math.round(d.slots.reduce((a, s) => a + dsl(s).sets * (St.restFor(s) + 45), 0) / 60);
  const last = St.lastSession(), gap = last ? St.daysSince(last.date) : null;
  const week = D().sessions.filter(s => St.daysSince(s.date) < 7).length;
  view.innerHTML = `
    <p class="eyebrow">Plan: ${esc(p.name)}</p>
    <h1 class="big">${di === St.nextDayIndex(p) ? "Heute:<br>" : ""}${esc(d.name)}</h1>
    ${gap != null && gap > 14 ? `<p class="note">Willkommen zurück. Dein letztes Training ist ${gap} Tage her. Die Vorschläge starten heute etwas leichter.</p>` : ""}
    <p class="meta">Letzte 7 Tage: ${week} von ${p.perWeek} geplanten Trainings.</p>
    ${cycleNote(p)}
    ${backupDue() ? `<div class="note"><b>Zeit für eine Sicherung.</b> ${D().settings.lastBackup ? `Die letzte ist ${St.daysSince(D().settings.lastBackup)} Tage alt.` : "Du hast noch keine."} Deine Trainings liegen nur auf diesem Gerät.
      <div class="row-btns"><button class="btn small primary" data-act="export">Jetzt sichern</button><button class="btn small" data-act="snoozebackup">Später</button></div></div>` : ""}
    ${p.days.length > 1 ? dayBar(p, di, "pickday", "Trainingstag wählen") : ""}
    <p class="meta">${d.slots.length} Übungen · ${sets} Sätze · ca. ${mins} Min.</p>
    <ol class="exlist" aria-label="Übungen">
      ${d.slots.map(sl => { const e = St.ex(sl.exId), l = St.lastSetsFor(sl.exId);
        return `<li><span class="t">${esc(e.name)}</span><span class="s"><span aria-hidden="true">${scheme(dsl(sl))}</span><span class="sr">${schemeSr(dsl(sl))}</span></span>
        ${l ? `<span class="l">Zuletzt: ${noLoad(e) ? "" : St.fmtW(e, Math.max(...l.sets.map(x => x.kg))) + ", "}${l.sets.map(x => x.reps).join(" + ")} ${St.repShort(e)}</span>` : ""}</li>`; }).join("")}
    </ol>
    ${d.slots.length ? `<div class="actionbar"><button class="btn primary" data-act="start" data-i="${di}">${D().active ? "Training fortsetzen" : "Training starten"}</button></div>`
      : `<p class="meta">Dieser Tag hat noch keine Übungen.</p><a class="btn" href="#/plan/${p.id}">Plan bearbeiten</a>`}`;
}

// Entlastungsrhythmus: Woche x von n, wann die nächste Phase beginnt
const inDaysLabel = n => { const d = new Date(Date.now() + n * 864e5); return n <= 1 ? "morgen" : d.toLocaleDateString("de-DE", {weekday: "long", day: "numeric", month: "numeric"}).replace(",", "").replace(/\.$/, ""); };
function cycleNote(p) {
  const c = St.cycleWeek(p); if (!c) return "";
  const dots = `<span class="cyc" aria-hidden="true">${Array.from({length: c.weeks}, (_, k) => `<i class="${k === c.weeks - 1 ? "dl" : ""}${k === c.week - 1 ? " on" : ""}"></i>`).join("")}</span>`;
  if (c.deload) return `<div class="note cycnote">${dots}<b>Entlastungswoche.</b> Halbe Satzzahl, etwa 90 % Gewicht, 3 oder mehr Wdh. in Reserve. So erholst du dich, bevor es wieder bergauf geht. Aufbau ab ${esc(inDaysLabel(c.inDays))}.</div>`;
  const next = c.inDays + (c.weeks - 1 - c.week) * 7;
  return `<p class="meta cycline">${dots}Woche ${c.week} von ${c.weeks}: Aufbau. Entlastung ab ${esc(inDaysLabel(next))}.</p>`;
}
function cycleEditor(p) {
  const c = St.cycleWeek(p), w = p.cycle ? p.cycle.weeks : 0;
  return `<h2 class="sec">Rhythmus</h2>
    <label class="field">Entlastungswoche <select data-on="cycleweeks">
      ${St.CYCLES.map(n => `<option value="${n}" ${n === w ? "selected" : ""}>${n ? `Alle ${n} Wochen (${n - 1} Aufbau + 1 Entlastung)` : "Aus"}</option>`).join("")}</select></label>
    ${c ? `<p class="meta">Gerade: Woche ${c.week} von ${c.weeks}${c.deload ? ", Entlastung" : ", Aufbau"}.</p>
    <div class="row-btns">${c.deload ? `<button class="btn small" data-act="cyclerestart">Entlastung beenden, Aufbau starten</button>` : `<button class="btn small" data-act="deloadnow">Diese Woche entlasten</button><button class="btn small" data-act="cyclerestart">Mit Woche 1 neu beginnen</button>`}</div>` : ""}
    <p class="foot">In der Entlastungswoche halbiert SATZ die Sätze und schlägt etwa 90 % des Gewichts vor. Danach geht es vom Stand davor weiter. Entlastungen alle 4–8 Wochen sind in der Praxis üblich, vor allem mit weniger Volumen (Bell et al. 2023, Expertenkonsens). Fühlst du dich früher platt, entlaste früher.</p>`;
}

/* ============ Pläne ============ */
function viewPlans() {
  const s = D(), customN = Object.values(s.exercises).filter(e => e.custom).length;
  view.innerHTML = `<h1 class="big">Pläne</h1>
    ${bodyCard()}
    ${s.plans.length ? s.plans.map(p => `<article class="card" aria-labelledby="p-${p.id}">
      <h3 id="p-${p.id}">${esc(p.name)}${p.id === s.activePlanId ? `<span class="badge">aktiv</span>` : ""}</h3>
      <p class="meta">${p.goal ? goalLabel(p.goal) + " · " : ""}${p.days.length} ${p.days.length === 1 ? "Tag" : "Tage"} · ${p.perWeek}× pro Woche${(c => c ? ` · Woche ${c.week}/${c.weeks}${c.deload ? " Entlastung" : ""}` : "")(St.cycleWeek(p))}</p>
      <div class="row-btns">
        ${p.id !== s.activePlanId ? `<button class="btn small primary" data-act="activate" data-id="${p.id}">Aktivieren</button>` : ""}
        <a class="btn small" href="#/plan/${p.id}" aria-label="${esc(p.name)} bearbeiten">Bearbeiten</a>
        <button class="btn small" data-act="copyplan" data-id="${p.id}" aria-label="${esc(p.name)} kopieren">Kopieren</button>
        <button class="btn small destructive" data-act="delplan" data-id="${p.id}" aria-label="${esc(p.name)} löschen">Löschen</button>
      </div></article>`).join("") : `<p>Noch kein eigener Plan.</p>`}
    ${emptyPlanBtn()}
    <h2 class="sec">Fertige Pläne</h2>
    <p class="meta">Nach Trainingswissenschaft zusammengestellt. Übernehmen erstellt eine Kopie, die du frei ändern kannst.</p>
    ${templatesBlock(true)}
    <h2 class="sec">Übungen</h2>
    <p class="meta">${Object.keys(s.exercises).length} Übungen, davon ${customN} eigene.</p>
    <a class="btn" href="#/uebungen">Übungen verwalten</a><div style="height:24px"></div>`;
}

function viewTemplate(id) {
  const t = TEMPLATES.find(x => x.id === id);
  if (!t) return go("#/plaene");
  const p = St.instantiate(t);
  view.innerHTML = `<p class="eyebrow">Fertiger Plan · ${goalLabel(t.goal)} · ${t.level}</p><h1 class="big">${esc(t.name)}</h1>
    <p>${esc(t.desc)}</p><p class="meta">${t.days.length} ${t.days.length === 1 ? "Tag" : "Tage"} · ${t.perWeek}× pro Woche</p>
    ${t.days.map((d, i) => `<h2 class="sec">Tag ${i + 1}: ${esc(d.name)}</h2><ol class="exlist">
      ${p.days[i].slots.map(sl => `<li><span class="t">${esc(St.ex(sl.exId).name)}</span><span class="s"><span aria-hidden="true">${scheme(sl)}</span><span class="sr">${schemeSr(sl)}</span></span></li>`).join("")}</ol>`).join("")}
    <h2 class="sec">Wochenvolumen</h2>${volumeTable(St.planVolume(p), "Sätze pro Muskel und Woche")}
    <div class="actionbar"><button class="btn primary" data-act="adopt" data-id="${t.id}">Plan übernehmen</button></div>`;
}

/* ============ Editor ============ */
function viewEditor(id) {
  const p = St.plan(id);
  if (!p) return go("#/plaene");
  ui.eday = Math.min(ui.eday, Math.max(0, p.days.length - 1));
  const d = p.days[ui.eday], v = St.planVolume(p), low = lowMuscles(v);
  view.innerHTML = `<p class="eyebrow">Plan bearbeiten</p><h1 class="big">${esc(p.name)}</h1>
    <label class="field">Name des Plans <input data-on="pname" value="${esc(p.name)}" autocomplete="off"></label>
    <div class="field" role="group" aria-labelledby="pw-l"><span id="pw-l">Trainings pro Woche</span>
      <div class="stepper sm" style="margin-top:6px">
        <button data-act="perweek" data-d="-1" aria-label="Ein Training weniger pro Woche">−</button>
        <output aria-live="polite"><span class="v num">${p.perWeek}</span><span class="u">pro Woche</span></output>
        <button data-act="perweek" data-d="1" aria-label="Ein Training mehr pro Woche">+</button></div></div>
    ${dayBar(p, ui.eday, "eday", "Tag zum Bearbeiten wählen", true)}
    ${d ? `<label class="field">Name von Tag ${ui.eday + 1} <input data-on="dname" value="${esc(d.name)}" autocomplete="off"></label>
    <h2 class="sec" id="exh" style="margin-top:8px">Übungen an Tag ${ui.eday + 1}</h2>
    ${d.slots.length ? "" : `<p class="meta">Noch keine Übungen.</p>`}
    <ol class="edlist" aria-labelledby="exh">
      ${d.slots.map((sl, i) => { const e = St.ex(sl.exId); return `<li>
        <div class="edrow"><span class="t">${esc(e.name)}${e.custom ? `<span class="badge">eigene</span>` : ""}</span>
          <button class="chip" data-act="slot" data-i="${i}" aria-label="${esc(e.name)}: ${schemeSr(sl)}. Ändern">${scheme(sl)}</button></div>
        <div class="edtools">
          <button data-act="mv" data-i="${i}" data-d="-1" ${i === 0 ? "disabled" : ""} aria-label="${esc(e.name)} nach oben">↑</button>
          <button data-act="mv" data-i="${i}" data-d="1" ${i === d.slots.length - 1 ? "disabled" : ""} aria-label="${esc(e.name)} nach unten">↓</button>
          <button class="push" data-act="delslot" data-i="${i}" aria-label="${esc(e.name)} entfernen">Entfernen</button>
        </div></li>`; }).join("")}
    </ol>
    <button class="btn" data-act="addslot" id="addslot">+ Übung hinzufügen</button>
    ${p.days.length > 1 ? `<button class="btn destructive" data-act="delday">Tag ${ui.eday + 1} löschen</button>` : ""}` : `<p>Dieser Plan hat noch keine Tage.</p>`}
    ${cycleEditor(p)}
    <h2 class="sec">Wochenvolumen</h2>
    <p>${low.length ? `Unter 10 Sätzen pro Woche: <b>${low.join(", ")}</b>. Mehr Sätze, mehr Trainings pro Woche oder eine zusätzliche Übung heben das an.` : "Alle großen Muskelgruppen liegen bei mindestens 10 Sätzen pro Woche."}</p>
    <details><summary>Tabelle: Sätze pro Muskel und Woche</summary>${volumeTable(v, "Sätze pro Muskel und Woche")}</details>
    <div class="actionbar"><a class="btn primary" href="#/plaene">Fertig</a></div>`;
}
const curPlan = () => St.plan(location.hash.split("/")[2]);

/* ---------- Slot-Dialog ---------- */
// Halteübungen bis 100 s (so groß darf ein gespeicherter Satz sein), sonst bis 50 Wdh.
const maxReps = e => e.unit === "s" ? 100 : 50;
// Satzschema, wenn eine Übung neu in den Plan kommt: Halten und Mobility in Sekunden, sonst 3 × 8–12
const slotDefault = e => isMobility(e) ? {sets: 2, min: 30, max: 45, rest: 15} : e.unit === "s" ? {sets: 3, min: 20, max: 45, rest: 60} : {sets: 3, min: 8, max: 12, rest: 0};
function openSlot() {
  const sl = ui.draft, e = St.ex(sl.exId);
  openDialog(`<h2 id="dlg-h">${ui.draftNew ? "Übung hinzufügen" : "Übung im Plan"}</h2>
    <p class="err" role="alert" hidden></p>
    <div class="field"><span id="exsel-l">Übung</span>
      <div class="exsel"><span>${esc(e.name)}</span><button class="btn small" data-act="swap" aria-label="Übung ${esc(e.name)} tauschen">Tauschen</button></div>
      <small>Tauschen behält den Verlauf beider Übungen getrennt.</small></div>
    <div class="pair">
      <label class="field">Sätze <input id="f-sets" type="number" inputmode="numeric" min="1" max="10" value="${sl.sets}"></label>
      <label class="field">Pause <select id="f-rest">
        ${[...new Set([0, 15, 30, 45, 60, 90, 120, 150, 180, 240, sl.rest || 0])].sort((a, b) => a - b).map(r => `<option value="${r}" ${sl.rest === r ? "selected" : ""}>${r ? r + " s" : "Standard"}</option>`).join("")}
      </select></label></div>
    <fieldset><legend>${St.repWord(e)}</legend><div class="pair">
      <label class="field">von <input id="f-min" type="number" inputmode="numeric" min="1" max="${maxReps(e)}" value="${sl.min}"></label>
      <label class="field">bis <input id="f-max" type="number" inputmode="numeric" min="1" max="${maxReps(e)}" value="${sl.max}"></label></div></fieldset>
    <div class="dlg-actions"><button class="btn" data-act="close">Abbrechen</button><button class="btn primary" data-act="slotsave">Speichern</button></div>`,
    ui.draftNew ? "#f-sets" : "#dlg-h");
}
function saveSlot() {
  const sets = +$("#f-sets").value, min = +$("#f-min").value, max = +$("#f-max").value, rest = +$("#f-rest").value;
  if (!(sets >= 1 && sets <= 10)) return dlgError("Sätze: bitte eine Zahl von 1 bis 10.");
  const mx = maxReps(St.ex(ui.draft.exId));
  if (!(min >= 1 && max <= mx && min <= max)) return dlgError(`${St.repWord(St.ex(ui.draft.exId))}: „von“ muss zwischen 1 und „bis“ liegen, „bis“ höchstens ${mx}.`);
  const p = curPlan(), d = p.days[ui.eday];
  Object.assign(ui.draft, {sets, min, max, rest});
  if (ui.draftNew) d.slots.push(ui.draft); else d.slots[d.slots.findIndex(s => s.id === ui.draft.id)] = ui.draft;
  persist();
  const idx = d.slots.findIndex(s => s.id === ui.draft.id), name = St.ex(ui.draft.exId).name;
  opener = null; closeDialog(); rerender(`[data-act="slot"][data-i="${idx}"]`);
  say(`${name} gespeichert: ${schemeSr(ui.draft)}.`);
}

/* ---------- Übungsauswahl ---------- */
let pickCb = null;
function openPicker(cb, swapFrom) {
  pickCb = cb; ui.pq = ""; ui.pm = ""; ui.swapFrom = swapFrom || null;
  openDialog(`<h2 id="dlg-h">Übung wählen</h2>
    <label class="field">Suchen oder eigenen Namen eingeben <input id="pq" type="search" data-on="pq" autocomplete="off" enterkeyhint="search"></label>
    <div class="pair"><label class="field">Muskel <select data-on="pm"><option value="">Alle Muskeln</option>${MUSCLES.map(m => `<option value="${m.id}">${m.name}</option>`).join("")}</select></label>
    ${kitSelect("kitp")}</div>
    <div id="pres"></div>
    <button class="btn" data-act="close">Abbrechen</button>`, "#pq");
  renderPickList();
}
function renderPickList() {
  const q = ui.pq.trim().toLowerCase();
  const list = Object.values(D().exercises)
    .filter(e => !e.archived && (!q || e.name.toLowerCase().includes(q)) && (!ui.pm || e.primary.includes(ui.pm) || e.secondary.includes(ui.pm)) && kitMatch(e, ui.kit))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  const exact = list.some(e => e.name.toLowerCase() === q);
  // Beim Tauschen: Alternativen für denselben Hauptmuskel zuerst, im gewählten Gerätefilter
  const from = ui.swapFrom && St.ex(ui.swapFrom);
  const alts = from && !q && !ui.pm ? Object.values(D().exercises).filter(e => !e.archived && e.id !== from.id && e.primary[0] === from.primary[0] && isMobility(e) === isMobility(from) && kitMatch(e, ui.kit))
    .sort((a, b) => (St.setCount(b.id) - St.setCount(a.id)) || a.name.localeCompare(b.name, "de")).slice(0, 6) : [];
  $("#pres").innerHTML = `
    ${q && !exact ? `<button class="btn primary" data-act="newex" style="margin-bottom:12px">„${esc(ui.pq.trim())}“ als eigene Übung anlegen</button>` : ""}
    ${alts.length ? `<h3 class="sec" id="alt-h">Alternativen für ${esc(from.name)}</h3><ul class="plist" aria-labelledby="alt-h">${alts.map(e => `<li><button data-act="pick" data-id="${e.id}"><b>${esc(e.name)}</b><small>${esc(exMeta(e))}</small></button></li>`).join("")}</ul><h3 class="sec">Alle Übungen</h3>` : ""}
    <p class="meta" aria-live="polite">${list.length} Treffer${ui.kit ? ". Eigene Übungen erscheinen nur bei „Alle Geräte“." : ""}</p>
    <ul class="plist">${list.map(e => `<li><button data-act="pick" data-id="${e.id}"><b>${esc(e.name)}${e.custom ? `<span class="badge">eigene</span>` : ""}</b><small>${esc(exMeta(e))}</small></button></li>`).join("")}</ul>`;
}

/* ---------- Übung anlegen / bearbeiten ---------- */
function openExForm(exId, name, after) {
  const e = exId ? St.ex(exId) : {name: name || "", primary: [ui.pm || "brust"], secondary: [], step: 2.5, unit: "kg", custom: true};
  const lockMuscles = e.primary.length > 1;
  const used = exId && D().plans.some(p => p.days.some(d => d.slots.some(s => s.exId === exId)));
  ui.exAfter = after; ui.exEdit = exId;
  openDialog(`<h2 id="dlg-h">${exId ? "Übung bearbeiten" : "Eigene Übung"}</h2>
    ${exId ? exFigure(e) : ""}
    <p class="err" role="alert" hidden></p>
    <label class="field">Name <input id="x-name" value="${esc(e.name)}" autocomplete="off"></label>
    ${lockMuscles ? `<p class="meta">Muskeln: ${esc(muscleList(e))}. Bei dieser Übung sind sie fest hinterlegt.</p>` : `
    <label class="field">Hauptmuskel <select id="x-prim">${MUSCLES.map(m => `<option value="${m.id}" ${e.primary[0] === m.id ? "selected" : ""}>${m.name}</option>`).join("")}</select></label>
    <fieldset><legend>Mitarbeitende Muskeln (zählen als halber Satz)</legend><div class="checks">
      ${MUSCLES.map(m => `<label class="check"><input type="checkbox" name="x-sec" value="${m.id}" ${e.secondary.includes(m.id) ? "checked" : ""}>${m.name}</label>`).join("")}
    </div></fieldset>`}
    <div class="pair">
      <label class="field">Einheit <select id="x-unit"><option value="kg" ${e.unit === "kg" ? "selected" : ""}>Gewicht</option><option value="bw" ${e.unit === "bw" ? "selected" : ""}>Körpergewicht</option><option value="band" ${e.unit === "band" ? "selected" : ""}>Widerstandsband</option><option value="s" ${e.unit === "s" ? "selected" : ""}>Halten (Sekunden)</option></select></label>
      <label class="field">Steigerung <select id="x-step">${[1, 1.25, 2, 2.5, 5, 10].map(s => `<option value="${s}" ${e.step === s ? "selected" : ""}>${fmt(s)} kg</option>`).join("")}</select></label>
    </div>
    ${exId ? `<p class="meta">Umbenennen ändert nichts am Verlauf: ${St.setCount(exId)} gespeicherte Sätze bleiben dieser Übung zugeordnet.</p>` : ""}
    <div class="dlg-actions"><button class="btn" data-act="close">Abbrechen</button><button class="btn primary" data-act="exsave">Speichern</button></div>
    ${exId && e.custom && !used ? `<button class="btn destructive" data-act="exdel" style="margin-top:10px">Übung archivieren</button>` : ""}`, "#x-name");
}
function saveEx() {
  const name = $("#x-name").value.trim();
  if (!name) return dlgError("Bitte gib der Übung einen Namen.");
  const clash = Object.values(D().exercises).find(e => !e.archived && e.name.toLowerCase() === name.toLowerCase() && e.id !== ui.exEdit);
  if (clash) return dlgError(`„${clash.name}“ gibt es schon. Wähle sie in der Liste oder nimm einen anderen Namen.`);
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
  say(`${name} gespeichert.`);
  const after = ui.exAfter; ui.exAfter = null;
  if (after) after(e.id); else { closeDialog(); rerender(); }
}

/* ============ Übungen ============ */
function viewExercises() {
  const q = ui.exq.trim().toLowerCase();
  const list = Object.values(D().exercises).filter(e => !e.archived && (!q || e.name.toLowerCase().includes(q)) && kitMatch(e, ui.kit)).sort((a, b) => (b.custom - a.custom) || a.name.localeCompare(b.name, "de"));
  view.innerHTML = `<p class="eyebrow"><a href="#/plaene">Pläne</a></p><h1 class="big">Übungen</h1>
    <p class="meta">Umbenennen und Tauschen lassen deinen Verlauf unverändert. Jede Übung behält ihre eigenen Sätze.</p>
    <button class="btn primary" data-act="newexlist">Eigene Übung anlegen</button>
    <div class="pair" style="margin-top:14px"><label class="field">Suchen <input type="search" data-on="exq" value="${esc(ui.exq)}" autocomplete="off"></label>
    ${kitSelect("kitx")}</div>
    <p class="meta" aria-live="polite">${list.length} ${list.length === 1 ? "Übung" : "Übungen"}${ui.kit ? ". Eigene Übungen erscheinen nur bei „Alle Geräte“." : ""}</p>
    <ul class="plist" style="max-height:none">${list.map(e => `<li><button data-act="editex" data-id="${e.id}" aria-label="${esc(e.name)} bearbeiten"><b>${esc(e.name)}${e.custom ? `<span class="badge">eigene</span>` : ""}</b>
      <small>${esc(exMeta(e))} · ${St.setCount(e.id)} Sätze im Verlauf</small></button></li>`).join("")}</ul><div style="height:24px"></div>`;
}

/* ============ Ausführung: Gerät und Bewegungsablauf ============ */
function exInfo(e) {
  const i = INFO[e.id];
  return i ? {pat: i[0], eq: i[1], cue: i[2]} : {pat: PATTERN_BY_MUSCLE[e.primary[0]] || "squat", eq: "", cue: ""};
}
function exFigure(e, small) {
  const x = exInfo(e);
  return `<figure class="exfig${small ? " small" : ""}">${AN.svgFor(x.pat, e.primary, esc(`Bewegungsablauf ${e.name}, schematisch`))}
    <figcaption>${x.eq ? `<b>${esc(x.eq)}.</b> ${esc(x.cue)}` : "Eigene Übung: grober Ablauf nach Hauptmuskel, nicht genau deine Übung."}</figcaption></figure>`;
}

/* ============ Körperkarte ============ */
// Muskeln, die man von hinten sieht: beim Antippen in der Liste dreht sich die Figur um
const BACKSIDE = new Set(["ruecken", "lrs", "trizeps", "hamstrings", "gluteus", "waden"]);
let body3d = null;
function dropBody() { if (body3d) { body3d.destroy(); body3d = null; } }
function viewBody() {
  dropBody();
  const m = ui.bm || null, side = ui.bside || "front";
  view.innerHTML = `<p class="eyebrow"><a href="#/plaene">Pläne</a></p><h1 class="big">Körperkarte</h1>
    <p class="meta">Tippe auf einen Muskel oder wähle ihn unten in der Liste. Zum Drehen seitlich ziehen.</p>
    <div class="b3wrap"><div class="body3d" id="body3d"><p class="meta b3load">Figur wird geladen …</p></div>
      <button type="button" class="b3tag" id="b3tag" data-act="b3go" ${m ? "" : "hidden"}>${m ? `${MUSCLE_NAME[m]} <span aria-hidden="true">↓</span>` : ""}</button></div>
    <div class="seg" role="group" aria-label="Figur drehen" style="margin:10px 0 4px">
      <button type="button" data-act="bside" data-v="front" aria-pressed="${side === "front"}">Vorne</button><button type="button" data-act="bside" data-v="back" aria-pressed="${side === "back"}">Hinten</button></div>
    <h2 class="sec" id="bm-h">Muskelgruppe</h2>
    <div class="chips" role="group" aria-labelledby="bm-h">${MUSCLES.map(x => `<button type="button" class="chip" data-act="bm" data-m="${x.id}" aria-pressed="${x.id === m}">${x.name}</button>`).join("")}</div>
    <div id="bmList">${muscleExList(m)}</div><div style="height:24px"></div>`;
  const host = $("#body3d");
  import("./body3d.js").then(mod => {
    if (!document.contains(host)) return;
    host.innerHTML = "";
    body3d = mod.mountBody(host, {selected: m, onPick: id => pickMuscle(id, true)});
    if (body3d && side === "back") body3d.back();
  }).catch(() => { host.innerHTML = `<p class="meta b3load">Die 3D-Figur ließ sich nicht laden. Nutze die Liste darunter.</p>`; });
}
function muscleExList(m) {
  if (!m) return `<p class="meta" style="margin-top:12px">Noch kein Muskel gewählt.</p>`;
  const all = Object.values(D().exercises).filter(e => !e.archived), byName = (a, b) => a.name.localeCompare(b.name, "de");
  const prim = all.filter(e => e.primary.includes(m)).sort(byName), sec = all.filter(e => !e.primary.includes(m) && e.secondary.includes(m)).sort(byName);
  return `<h2 class="sec" id="bx-h" tabindex="-1">${MUSCLE_NAME[m]}: ${prim.length} ${prim.length === 1 ? "Übung" : "Übungen"}</h2>
    ${prim.map(e => `<article class="card exsug" aria-labelledby="bx-${e.id}"><h3 id="bx-${e.id}">${esc(e.name)}${e.custom ? `<span class="badge">eigene</span>` : ""}</h3>${exFigure(e)}
      <p class="meta">${esc(muscleList(e))}</p>
      <div class="row-btns"><button class="btn small primary" data-act="bmadd" data-id="${e.id}" aria-haspopup="dialog" aria-label="${esc(e.name)} zum Plan hinzufügen">Zum Plan hinzufügen</button></div></article>`).join("")}
    ${sec.length ? `<p class="meta">Arbeitet außerdem mit bei: ${sec.map(e => esc(e.name)).join(", ")}.</p>` : ""}`;
}
function pickMuscle(id, from3d) {
  ui.bm = id;
  view.querySelectorAll('[data-act="bm"]').forEach(b => b.setAttribute("aria-pressed", String(b.dataset.m === id)));
  const box = $("#bmList"); if (box) box.innerHTML = muscleExList(id);
  AN.startAnim();
  if (body3d) { body3d.select(id); if (!from3d) { const back = BACKSIDE.has(id); back ? body3d.back() : body3d.front(); setSide(back ? "back" : "front"); } }
  const n = Object.values(D().exercises).filter(e => !e.archived && e.primary.includes(id)).length;
  say(`${MUSCLE_NAME[id]} gewählt. ${n} passende Übungen.`);
  const tag = $("#b3tag");
  if (tag) { tag.hidden = false; tag.innerHTML = `${MUSCLE_NAME[id]} · ${n} ${n === 1 ? "Übung" : "Übungen"} <span aria-hidden="true">↓</span>`; }
}
function setSide(v) { ui.bside = v; view.querySelectorAll('[data-act="bside"]').forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === v))); }
// Standard-Satzschema nach Ziel des Plans (ACSM 2009)
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
  const sug = St.suggest(it), key = `${a.id}:${i}:${logged.length}`;
  if (ui.key !== key) {
    if (!ui.key.startsWith(`${a.id}:${i}:`)) { ui.stype = "work"; ui.addAfter = false; }
    ui.key = key; ui.rir = null;
    const l = all[all.length - 1];
    if (l) { ui.kg = l.kg; ui.reps = l.reps; } else { ui.kg = sug.kg; ui.reps = sug.reps; }
  }
  // Erledigte Übung: Formular nur, wenn bewusst ein Drop-Satz angehängt wird
  const form = !done || ui.addAfter;
  const bw = e.unit === "bw", resting = a.restEnd > Date.now(), st = ui.stype || "work";
  const next = a.queue.findIndex((q, k) => k > i && !q.skipped && St.workFor(a, k).length < St.targetSets(q));
  const lastNote = [...D().sessions].reverse().find(x => x.notes && x.notes[it.exId]);
  const note = (a.notes || {})[it.exId];
  view.innerHTML = `
    <div class="progress" aria-hidden="true">${a.queue.map((q, k) => `<span class="${q.skipped ? "skip" : k === i ? "now" : St.workFor(a, k).length >= St.targetSets(q) ? "done" : ""}"></span>`).join("")}</div>
    <div class="exnav"><button type="button" class="linkbtn" data-act="exprev" ${i === 0 ? "disabled" : ""}><span aria-hidden="true">‹</span> Vorherige Übung</button>
      <button type="button" class="linkbtn" data-act="exnext" ${i >= a.queue.length - 1 ? "disabled" : ""}>Nächste Übung <span aria-hidden="true">›</span></button></div>
    <p class="eyebrow">Übung ${i + 1} von ${a.queue.length} · ${done ? `erledigt, ${logged.length} von ${target} Sätzen` : `Satz ${logged.length + 1} von ${target}`} · Ziel ${it.min}–${it.max} ${St.repShort(e)}</p>
    <h1 class="big">${esc(e.name)}</h1>
    <p class="hint" ${done ? "hidden" : ""}>${esc(sug.text)}${lastNote && !note ? `<br><b>Notiz vom ${dateDe(lastNote.date)}:</b> ${esc(lastNote.notes[it.exId])}` : ""}${note ? `<br><b>Notiz:</b> ${esc(note)}` : ""}</p>
    ${D().settings.showFig !== false ? exFigure(e, true) : ""}
    <div class="rest ${resting ? "on" : ""}" role="group" aria-label="Pause" ${done && !resting ? "hidden" : ""}>
      <span class="eyebrow">${resting ? "Pause" : "Pause nach dem Satz"}</span>
      <div class="num" id="rt" aria-hidden="true">${resting ? restLeft() : fmtSec(st === "warm" ? 60 : st === "drop" ? 0 : it.rest)}</div>
      <div class="row-btns" ${resting ? "" : `style="visibility:hidden" aria-hidden="true"`}><button class="btn small" data-act="rest30" ${resting ? "" : "tabindex=-1"}>+30 s</button><button class="btn small" data-act="skiprest" ${resting ? "" : "tabindex=-1"}>Pause beenden</button></div></div>
    ${!form ? `<p class="note">${it.skipped ? "Diese Übung hast du ausgelassen." : "Alle Sätze dieser Übung sind eingetragen."} Tippe unten auf einen Satz, um ihn zu korrigieren.</p>
    <div class="actionbar"><button class="btn primary" data-act="exgo" id="saveset">${St.firstOpen(a, 0) >= 0 ? "Weiter zur offenen Übung" : "Zur Zusammenfassung"}</button></div>` : `
    <div class="seg" role="group" aria-label="Satztyp" style="margin-bottom:10px">
      ${[["work", "Arbeitssatz"], ["warm", "Aufwärmen"], ["drop", "Drop-Satz"]].map(([v, l]) => `<button type="button" data-act="stype" data-v="${v}" aria-pressed="${st === v}">${l}</button>`).join("")}</div>
    ${noLoad(e) ? "" : `<div class="stepper" role="group" aria-labelledby="kg-l">
      <button data-act="kg" data-d="-1" aria-label="Gewicht um ${fmt(e.step)} Kilo verringern">−</button>
      <div class="val"><input id="kgIn" class="v num" data-on="kgin" inputmode="decimal" autocomplete="off" enterkeyhint="done" value="${fmt(ui.kg)}" aria-describedby="kg-l"><label id="kg-l" for="kgIn" class="u">${bw ? "kg zusätzlich" : "kg"} · antippen zum Eintippen</label></div>
      <button data-act="kg" data-d="1" aria-label="Gewicht um ${fmt(e.step)} Kilo erhöhen">+</button></div>`}
    ${e.unit === "band" ? `<p class="meta">Bandstärke: schreib sie in die Notiz, dann steht sie beim nächsten Mal hier.</p>` : ""}
    <div class="stepper" role="group" aria-labelledby="reps-l">
      <button data-act="reps" data-d="-1" aria-label="${e.unit === "s" ? "5 Sekunden weniger" : "Eine Wiederholung weniger"}">−</button>
      <div class="val"><input id="repsIn" class="v num" data-on="repsin" inputmode="numeric" pattern="[0-9]*" autocomplete="off" enterkeyhint="done" value="${ui.reps}"><label id="reps-l" for="repsIn" class="u">${St.repWord(e)}</label></div>
      <button data-act="reps" data-d="1" aria-label="${e.unit === "s" ? "5 Sekunden mehr" : "Eine Wiederholung mehr"}">+</button></div>
    ${D().settings.rir && st !== "warm" && !isMobility(e) ? `<fieldset><legend>Wie viele Wdh. wären noch gegangen? <span style="font-weight:500">(optional)</span></legend>
      <div class="rir">${[0, 1, 2, 3, 4].map(r => `<button type="button" data-act="rir" data-v="${r}" aria-pressed="${ui.rir === r}">${r === 4 ? "4+" : r}</button>`).join("")}</div></fieldset>` : ""}
    <div class="actionbar"><button class="btn primary" data-act="saveset" id="saveset">${st === "warm" ? "Aufwärmsatz speichern" : st === "drop" ? "Drop-Satz speichern" : `Satz ${logged.length + 1} speichern`}</button></div>`}
    ${setTable(a, i, it, e, all, logged, target, done, st, sug, form)}
    ${all.length ? `<button class="btn small" data-act="undoset" style="margin-top:8px">Letzten Satz löschen</button>` : ""}
    <div class="row-btns" style="margin-top:16px">${done && !form && !it.skipped ? `<button class="btn small" data-act="adddrop">+ Drop-Satz</button>` : ""}<button class="btn small" data-act="extraset">+ Extra-Satz</button>${it.extra > 0 && logged.length < target ? `<button class="btn small" data-act="extraless">− Extra-Satz</button>` : ""}${it.skipped ? `<button class="btn small" data-act="unskip" data-i="${i}">Wieder aufnehmen</button>` : ""}<button class="btn small" data-act="note" aria-haspopup="dialog">${note ? "Notiz ändern" : "Notiz"}</button>${done ? "" : `<button class="btn small" data-act="skipex">Übung auslassen</button>`}</div>
    <p class="meta" style="margin-top:12px">${next >= 0 ? `Danach: ${esc(St.ex(a.queue[next].exId).name)}` : "Das ist die letzte offene Übung."}</p>
    <div style="height:16px"></div>`;
}
// Satz-Tabelle: alle Sätze der Übung in einer Liste. Eingetragene (bearbeitbar), der aktuelle (hervorgehoben)
// und die noch offenen mit geplanten Werten. Aufwärmsätze stehen oben, Drop-Sätze bleiben unter ihrem Satz.
// Nur Anzeige: Die gespeicherten Sätze selbst werden dafür nicht umsortiert oder verändert.
function setTable(a, i, it, e, all, logged, target, done, st, sug, form) {
  const rir = l => l.rir != null ? (l.rir === 4 ? "4+" : String(l.rir)) : "–";
  const warm = all.filter(l => l.type === "warm"), rest = all.filter(l => l.type !== "warm");
  const rows = [];
  let wn = 0, n = 0;
  for (const l of warm) rows.push({l, lab: warm.length > 1 ? `Aufwärmen ${++wn}` : "Aufwärmen", kind: "warm"});
  const cur = (lab, kind) => ({cur: true, lab, kind});
  if (form && st === "warm") rows.push(cur(warm.length ? `Aufwärmen ${warm.length + 1}` : "Aufwärmen", "warm"));
  for (const l of rest) rows.push({l, lab: l.type === "drop" ? "Drop-Satz" : `Satz ${++n}`, kind: l.type === "drop" ? "drop" : "work"});
  if (form && st === "drop") rows.push(cur("Drop-Satz", "drop"));
  const lastWork = [...rest].reverse().find(l => l.type !== "drop");
  const plan = lastWork ? {kg: lastWork.kg, reps: lastWork.reps} : {kg: sug.kg, reps: sug.reps};
  for (let k = logged.length; k < target; k++) {
    if (k === logged.length && !done && st === "work") rows.push(cur(`Satz ${k + 1}`, "work"));
    else rows.push({open: true, lab: `Satz ${k + 1}`, kind: "work", extra: k >= it.sets});
  }
  if (!rows.length) return "";
  const kgTxt = v => e.unit === "band" ? "Band" : e.unit === "s" ? "–" : e.unit === "bw" ? (v ? `+${fmt(v)}` : "KG") : fmt(v);
  const kgSay = v => e.unit === "band" ? "Band" : e.unit === "s" ? "Halten" : e.unit === "bw" ? (v ? `Körpergewicht plus ${fmt(v)} Kilo` : "Körpergewicht") : `${fmt(v)} Kilo`;
  const showRir = D().settings.rir !== false;
  const rirCell = v => showRir ? `<span class="c-n c-rir">${v}</span>` : "";
  const lab = r => r.kind === "drop" ? `<span aria-hidden="true">↳ </span>${r.lab}` : r.lab;
  const body = rows.map(r => {
    if (r.l) {
      const k = a.sets.indexOf(r.l);
      return `<li class="done ${r.kind}"><button type="button" class="srow" data-act="editset" data-k="${k}" aria-haspopup="dialog" aria-label="${r.lab}, erledigt: ${kgSay(r.l.kg)} mal ${r.l.reps}${r.l.rir != null ? `, RIR ${rir(r.l)}` : ""}. Bearbeiten">
        <span class="c-lab">${lab(r)}</span><span class="c-n">${kgTxt(r.l.kg)}</span><span class="c-n">${r.l.reps}</span>${rirCell(rir(r.l))}<span class="c-st" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button></li>`;
    }
    if (r.cur) return `<li class="now ${r.kind}" aria-current="step"><span class="sr">${r.lab}, jetzt dran, eingestellt sind die Werte oben.</span><div class="srow" aria-hidden="true"><span class="c-lab">${lab(r)}</span><span class="c-n" id="curKg">${kgTxt(ui.kg)}</span><span class="c-n" id="curReps">${ui.reps}</span>${rirCell("–")}<span class="c-st"><span class="nowtag">jetzt</span></span></div></li>`;
    const reps = it.min === it.max ? `${it.max}` : `${it.min}–${it.max}`;
    return `<li class="open"><span class="sr">${r.lab}${r.extra ? ", Extra-Satz" : ""}, offen, geplant ${kgSay(plan.kg)} mal ${reps.replace("–", " bis ")}</span><div class="srow" aria-hidden="true"><span class="c-lab">${r.lab}${r.extra ? `<span class="xtag">extra</span>` : ""}</span><span class="c-n">${kgTxt(plan.kg)}</span><span class="c-n">${reps}</span>${rirCell("–")}<span class="c-st"></span></div></li>`;
  }).join("");
  const wDone = logged.length, summary = done ? `${wDone} von ${target} Sätzen erledigt` : `Satz ${Math.min(wDone + 1, target)} von ${target}${target - wDone - 1 > 0 ? `, danach noch ${target - wDone - 1} offen` : ", der letzte"}`;
  return `<h2 class="sec" id="sets-h" style="margin-top:8px">Sätze <span class="sec-sub">${summary}</span></h2>
    <div class="sethead ${D().settings.rir !== false ? "" : "norir"}" aria-hidden="true"><span class="c-lab"></span><span class="c-n">${noLoad(e) ? "" : e.unit === "bw" ? "+kg" : "kg"}</span><span class="c-n">${St.repShort(e)}</span>${D().settings.rir !== false ? `<span class="c-n c-rir">RIR</span>` : ""}<span class="c-st"></span></div>
    <ol class="setlist ${D().settings.rir !== false ? "" : "norir"}" aria-labelledby="sets-h">${body}</ol>`;
}
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
  if (left > 0) { if (el) el.textContent = restLeft(); lastRestState = true; updateMini(); return; }
  a.restEnd = 0; persist();
  if (lastRestState) {
    say("Pause vorbei."); if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
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
  const name = it ? St.ex(it.exId).name : "Alle Übungen erledigt";
  const sub = resting ? `Pause · noch ${restLeft()}` : it ? `Satz ${Math.min(St.workFor(a, i).length + 1, St.targetSets(it))} von ${St.targetSets(it)} · bereit` : "Zum Speichern öffnen";
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
  mini.setAttribute("aria-label", `Training öffnen. ${t.name}, ${t.sub}`);
}
function minimize() {
  if (!D().active) return;
  ui.mini = true; readSetInputs(); persist();
  go(ui.miniFrom || "#/heute");
  say("Training verkleinert. Der Timer läuft weiter. Unten über der Tab-Leiste kannst du es wieder öffnen.");
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
  if (k) k.textContent = e.unit === "band" ? "Band" : e.unit === "s" ? "–" : e.unit === "bw" ? (ui.kg ? `+${fmt(ui.kg)}` : "KG") : fmt(ui.kg);
  if (r) r.textContent = ui.reps;
}
function saveSet() {
  readSetInputs(); ui.pin = null;
  const a = D().active, i = a.idx, it = a.queue[i], e = St.ex(it.exId), type = ui.stype || "work";
  a.sets.push({q: i, exId: it.exId, kg: ui.kg, reps: ui.reps, rir: type === "warm" ? null : ui.rir, t: Date.now(), ...(type !== "work" ? {type} : {})});
  const n = St.workFor(a, i).length, target = St.targetSets(it);
  let msg = `Gespeichert: ${type === "warm" ? "Aufwärmsatz, " : type === "drop" ? "Drop-Satz, " : ""}${noLoad(e) ? "" : St.fmtW(e, ui.kg) + ", "}${ui.reps} ${St.repWord(e)}.`;
  if (type === "work" && ui.reps < it.min) msg += ` Unter dem Ziel von ${it.min}.`;
  if (type === "drop") { ui.stype = "work"; ui.addAfter = false; }
  const nextIdx = St.firstOpen(a, i);
  if (nextIdx < 0) { a.restEnd = 0; cancelBeep(); persist(); ui.summary = true; say(msg + " Alle Übungen erledigt."); rerender(); view.querySelector("h1").focus(); return; }
  const rest = type === "warm" ? 60 : type === "drop" ? 0 : it.rest;
  a.restEnd = rest ? Date.now() + rest * 1000 : 0; a.restTotal = rest; lastRestState = !!rest; scheduleBeep(rest);
  if (n >= target) { a.idx = nextIdx; msg += ` ${e.name} erledigt. Nächste Übung: ${St.ex(a.queue[nextIdx].exId).name}.`; }
  if (rest) msg += ` Pause ${rest} Sekunden.`;
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
  say(`Übung ${n + 1}: ${St.ex(a.queue[n].exId).name}.`);
}
function openSetEdit(k) {
  const a = D().active, x = a.sets[k]; if (!x) return;
  const e = St.ex(x.exId); ui.setEdit = k;
  openDialog(`<h2 id="dlg-h">Satz korrigieren</h2><p class="meta" style="text-align:center;margin-top:-10px">${esc(e.name)}</p>
    <p class="err" role="alert" hidden></p>
    <div class="seg" role="group" aria-label="Satztyp" style="margin-bottom:12px">${[["work", "Arbeitssatz"], ["warm", "Aufwärmen"], ["drop", "Drop-Satz"]].map(([v, l]) => `<button type="button" data-act="setype" data-v="${v}" aria-pressed="${(x.type || "work") === v}">${l}</button>`).join("")}</div>
    <div class="pair"><label class="field" ${noLoad(e) ? "hidden" : ""}>${e.unit === "bw" ? "kg zusätzlich" : "kg"} <input id="se-kg" inputmode="decimal" autocomplete="off" value="${fmt(x.kg)}"></label>
      <label class="field">${St.repWord(e)} <input id="se-reps" inputmode="numeric" autocomplete="off" value="${x.reps}"></label></div>
    ${D().settings.rir ? `<label class="field">Wdh. in Reserve <select id="se-rir"><option value="">keine Angabe</option>${[0, 1, 2, 3, 4].map(r => `<option value="${r}" ${x.rir === r ? "selected" : ""}>${r === 4 ? "4+" : r}</option>`).join("")}</select></label>` : ""}
    <div class="dlg-actions"><button class="btn" data-act="close">Abbrechen</button><button class="btn primary" data-act="setsave">Speichern</button></div>
    <button class="btn destructive" data-act="setdel" style="margin-top:10px">Satz löschen</button>`, noLoad(e) ? "#se-reps" : "#se-kg");
}
function saveSetEdit() {
  const a = D().active, x = a.sets[ui.setEdit]; if (!x) return closeDialog();
  const kg = num($("#se-kg").value), reps = Math.round(num($("#se-reps").value));
  if (!(kg >= 0 && kg <= 1000) || !$("#se-kg").value.trim()) return dlgError("Bitte ein Gewicht zwischen 0 und 1000 kg eintragen.");
  if (!(reps >= 0 && reps <= 100) || !$("#se-reps").value.trim()) return dlgError("Bitte 0 bis 100 Wiederholungen eintragen.");
  const type = dlg.querySelector('[data-act="setype"][aria-pressed="true"]').dataset.v, r = $("#se-rir");
  x.kg = Math.round(kg * 100) / 100; x.reps = reps;
  if (type === "work") delete x.type; else x.type = type;
  x.rir = type === "warm" ? null : r && r.value !== "" ? +r.value : r ? null : x.rir;
  persist(); opener = null; closeDialog(); ui.pin = a.idx; ui.key = ""; rerender(); say(`Satz geändert: ${fmt(x.kg)} Kilo, ${reps} Wiederholungen.`);
  const b = view.querySelector(`[data-act="editset"][data-k="${ui.setEdit}"]`); if (b) b.focus();
}
function openOverview() {
  const a = D().active;
  openDialog(`<h2 id="dlg-h">Übersicht</h2><ol class="edlist">
    ${a.queue.map((q, k) => { const n = St.workFor(a, k).length, t = St.targetSets(q), name = esc(St.ex(q.exId).name);
      return `<li><div class="edrow"><span class="t">${k + 1}. ${name}</span><span class="num">${q.skipped ? "ausgelassen" : `${n}/${t}`}</span></div>
      <div class="edtools">${q.skipped ? `<button class="push" data-act="unskip" data-i="${k}">Wieder aufnehmen</button>`
        : k === a.idx ? "" : n < t ? `<button class="push" data-act="jump" data-i="${k}">Jetzt machen</button>` : `<button class="push" data-act="jump" data-i="${k}">Ansehen &amp; korrigieren</button>`}</div></li>`; }).join("")}
    </ol><button class="btn" data-act="close">Schließen</button>`);
}

function viewSummary() {
  const a = D().active, p = St.plan(a.planId);
  const open = St.firstOpen(a, 0) >= 0, mins = Math.max(1, Math.round((Date.now() - new Date(a.start)) / 60000));
  const devs = [];
  a.queue.forEach((q, k) => {
    const day = p && p.days.find(d => d.id === a.dayId), slot = day && day.slots.find(s => s.id === q.slotId);
    if (!slot) return;
    const name = St.ex(q.exId).name;
    if (q.skipped) devs.push({k, kind: "remove", label: `${name} aus dem Plan entfernen`});
    else if (q.extra > 0) devs.push({k, kind: "sets", label: `${name}: dauerhaft ${q.sets + q.extra} statt ${q.sets} Sätze`});
  });
  const byEx = a.queue.map((q, k) => ({q, sets: St.loggedFor(a, k)})).filter(x => x.sets.length);
  view.innerHTML = `<p class="eyebrow">${esc(a.dayName)} · ${mins} Min.</p>
    <h1 class="big">${open ? "Training beenden?" : "Geschafft."}</h1>
    <p>${a.sets.length} ${a.sets.length === 1 ? "Satz" : "Sätze"} eingetragen${open ? ", einige Übungen sind noch offen" : ""}.</p>
    ${byEx.length ? `<ul class="logged">${byEx.map(x => { const e = St.ex(x.q.exId); return `<li><span>${esc(e.name)}</span><span class="num">${x.sets.map(s => `${fmt(s.kg)}×${s.reps}`).join(", ")}</span></li>`; }).join("")}</ul>` : ""}
    ${devs.length ? `<fieldset style="margin-top:16px"><legend>Abweichungen für künftige Trainings übernehmen?</legend>
      ${devs.map((d, n) => `<label class="check"><input type="checkbox" name="dev" value="${n}">${esc(d.label)}</label>`).join("")}
      <p class="meta">Ohne Haken bleibt dein Plan, wie er ist.</p></fieldset>` : ""}
    <div class="actionbar">
      <button class="btn primary" data-act="finish">${a.sets.length ? "Training speichern" : "Ohne Speichern beenden"}</button>
      ${open ? `<button class="btn" data-act="resume">Weiter trainieren</button>` : ""}
      ${a.sets.length ? `<button class="btn destructive" data-act="discard">Training verwerfen</button>` : ""}
    </div>`;
  ui.devs = devs;
}

/* ============ Verlauf ============ */
function viewHistory() {
  const s = D(), ses = [...s.sessions].reverse();
  if (!ses.length) {
    view.innerHTML = `<h1 class="big">Verlauf</h1><p>Noch keine Trainings. Nach deinem ersten Training siehst du hier, was sich bei jeder Übung verändert.</p>${weightSection()}${measureSection()}<div style="height:24px"></div>`;
    return;
  }
  const exIds = [...new Set(s.sessions.flatMap(x => x.sets.map(y => y.exId)))];
  const changes = exIds.map(id => {
    const hist = s.sessions.filter(x => x.sets.some(y => y.exId === id));
    if (hist.length < 2) return null;
    const top = x => Math.max(...x.sets.filter(y => y.exId === id && St.isWork(y)).map(y => y.kg), 0);
    return {id, from: top(hist[0]), to: top(hist[hist.length - 1]), since: hist[0].date, last: hist[hist.length - 1].date};
  }).filter(Boolean).sort((a, b) => new Date(b.last) - new Date(a.last)).slice(0, 8);
  if (!ui.histEx || !exIds.includes(ui.histEx)) ui.histEx = exIds[0];
  const p = St.activePlan();
  view.innerHTML = `<h1 class="big">Verlauf</h1>
    ${weightSection()}
    ${measureSection()}
    ${changes.length ? `<h2 class="sec" style="margin-top:4px">Was sich verändert hat</h2><ul class="logged">
      ${changes.map(c => { const e = St.ex(c.id), d = c.to - c.from; return `<li><span>${esc(e.name)}</span><span class="num">${fmt(c.from)} → ${fmt(c.to)} kg <span class="sr">,</span>(${d > 0 ? "+" : d < 0 ? "−" : "±"}${fmt(Math.abs(d))})</span></li>`; }).join("")}
    </ul><p class="meta" style="margin-top:6px">Schwerster Satz im ersten und im letzten Training.</p>` : ""}
    <h2 class="sec">Übung im Detail</h2>
    <label class="field">Übung <select data-on="histex">${exIds.map(id => `<option value="${id}" ${id === ui.histEx ? "selected" : ""}>${esc(St.ex(id).name)}</option>`).join("")}</select></label>
    ${exDetail(ui.histEx)}
    <h2 class="sec">Letzte 7 Tage</h2>
    ${volumeTable(St.recentVolume(7), "Sätze pro Muskel in den letzten 7 Tagen, verglichen mit dem Plan", p ? St.planVolume(p) : null)}
    <h2 class="sec">Trainings</h2>
    ${ses.map(x => `<details><summary>${dateDe(x.date)} · ${esc(x.dayName)} · ${x.sets.length} Sätze</summary>
      <ul class="logged">${groupSets(x.sets).map(g => `<li><span>${esc(St.ex(g.exId).name)}</span><span class="num">${g.sets.map(y => `${y.type === "warm" ? "A " : y.type === "drop" ? "D " : ""}${fmt(y.kg)}×${y.reps}`).join(", ")}</span></li>`).join("")}</ul>
      ${x.notes ? `<p class="meta" style="margin:8px 0 0">${Object.entries(x.notes).map(([k, v]) => `<b>${esc(St.ex(k).name)}:</b> ${esc(v)}`).join("<br>")}</p>` : ""}
      <div class="row-btns" style="margin:10px 0"><button class="btn small" data-act="sessedit" data-id="${esc(x.id)}" aria-haspopup="dialog">Korrigieren</button><button class="btn small destructive" data-act="delsession" data-id="${esc(x.id)}">Training löschen</button></div></details>`).join("")}
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
  return `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(caption)}: von ${fmt(Math.round(vals[0] * 10) / 10)} auf ${fmt(Math.round(vals.at(-1) * 10) / 10)} ${unit}">
    <line x1="${L}" x2="${W - R}" y1="${Y(hi)}" y2="${Y(hi)}" class="grid"/><line x1="${L}" x2="${W - R}" y1="${Y(lo)}" y2="${Y(lo)}" class="grid"/>
    <text x="${L - 6}" y="${Y(hi) + 4}" text-anchor="end">${fmt(ax(hi))}</text><text x="${L - 6}" y="${Y(lo) + 4}" text-anchor="end">${fmt(ax(lo))}</text>
    <text x="${L}" y="${H - 6}">${esc(labels[0])}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${esc(labels.at(-1))}</text>
    <line x1="${L}" x2="${W - R}" y1="${Y((hi + lo) / 2)}" y2="${Y((hi + lo) / 2)}" class="grid mid"/>
    ${trend ? `<path d="${path(trend)}" class="trend"/>` : ""}<path d="${path(vals)}"/>${vals.map((v, k) => `<circle cx="${X(k).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${k === vals.length - 1 ? 4.5 : 3}"${k === vals.length - 1 ? ' class="last"' : ""}/>`).join("")}
    ${(() => { const bi = vals.indexOf(Math.max(...vals)), lx = X(vals.length - 1), ly = Y(vals.at(-1));
      return (ring ? `<circle cx="${X(bi).toFixed(1)}" cy="${Y(vals[bi]).toFixed(1)}" r="6" class="best"/>` : "")
        + `<text x="${(lx - 8).toFixed(1)}" y="${(ly < T + 14 ? ly + 16 : ly - 9).toFixed(1)}" text-anchor="end" class="val">${fmt(Math.round(vals.at(-1) * 10) / 10)} ${esc(unit)}</text>`; })()}
  </svg><figcaption class="meta">${esc(caption)}${trend ? " · gestrichelt: 7-Tage-Mittel" : ring ? " · Ring: bisheriger Bestwert" : ""}</figcaption></figure>`;
}
const shortDate = iso => new Date(iso).toLocaleDateString("de-DE", {day: "numeric", month: "numeric"});
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
    useReps ? `${St.repWord(e)} gesamt pro Training` : "Geschätztes 1RM (Epley) aus dem besten Satz");
  return `${svg}<div class="table-wrap"><table><caption class="sr">Arbeitssätze pro Training</caption><thead><tr><th scope="col">Datum</th><th scope="col">Sätze</th><th scope="col" class="n">${useReps ? rs : "1RM ca."}</th></tr></thead>
    <tbody>${[...pts].reverse().map(h => `<tr><td>${dateDe(h.date)}</td><td class="num">${h.sets.map(y => noLoad(e) ? `${y.reps}` : `${fmt(y.kg)}×${y.reps}`).join(", ")}</td><td class="n">${useReps ? h.reps : fmt(Math.round(h.e1 * 10) / 10) + " kg"}</td></tr>`).join("")}</tbody></table></div>
    <p class="foot">1RM ca. = Gewicht × (1 + Wdh./30), Epley (1985). Steigt auch, wenn du bei gleichem Gewicht mehr Wiederholungen schaffst.</p>`;
}
// Gewicht: eine Karte, die überall gleich aussieht und das Eintragen-Sheet öffnet
const dl = k => { const l = dayLabel(k); return l === "Gestern" || l === "Heute" ? l.toLowerCase() : "am " + l.replace(/^\w+, /, ""); };
function weightCard() {
  const w = D().weights, today = dkey(), last = w.at(-1), done = last && last.date === today;
  const prev = done ? w.at(-2) : last, d = done && prev ? Math.round((last.kg - prev.kg) * 10) / 10 : null;
  return `<button type="button" class="card wcard" data-act="wopen" aria-haspopup="dialog">
    <span class="wl"><span class="eyebrow">Gewicht heute</span><b class="num">${done ? `${fmt(last.kg)} kg` : "Noch nicht eingetragen"}</b>
      <small>${done ? (d != null ? `${d > 0 ? "+" : d < 0 ? "−" : "±"}${fmt(Math.abs(d))} kg seit ${dl(prev.date)}` : "Erster Eintrag") : last ? `Zuletzt ${fmt(last.kg)} kg, ${dl(last.date)}` : "Am besten morgens, vor dem Frühstück"}</small></span>
    <span class="wbtn">${done ? "Ändern" : "Eintragen"}</span></button>`;
}
function openWeight(date) {
  const w = D().weights, k = date || dkey(), cur = w.find(x => x.date === k), base = cur ? cur.kg : St.currentWeight() || 70;
  ui.wkg = base; ui.wdate = k;
  openDialog(`<h2 id="dlg-h">Gewicht eintragen</h2>
    <p class="err" role="alert" hidden></p>
    <div class="stepper" role="group" aria-labelledby="w-l">
      <button type="button" data-act="wstep" data-d="-1" aria-label="100 Gramm weniger">−</button>
      <div class="val"><input id="wIn" class="v num" inputmode="decimal" autocomplete="off" enterkeyhint="done" value="${fmt(base)}"><label id="w-l" for="wIn" class="u">kg · antippen zum Eintippen</label></div>
      <button type="button" data-act="wstep" data-d="1" aria-label="100 Gramm mehr">+</button></div>
    <label class="field">Datum <input id="wDate" type="date" value="${k}" max="${dkey()}" min="2000-01-01"></label>
    <div class="dlg-actions"><button class="btn" data-act="close">Abbrechen</button><button class="btn primary" data-act="wsave">Speichern</button></div>
    ${w.length ? `<h3 class="meta" style="margin:16px 0 6px">Letzte Einträge</h3><ul class="logged">${w.slice(-7).reverse().map(x => `<li><span>${esc(dayLabel(x.date))}</span><span class="num">${fmt(x.kg)} kg <button type="button" class="linkbtn" data-act="wdel" data-d="${x.date}" aria-label="Eintrag ${esc(dayLabel(x.date))} löschen">Löschen</button></span></li>`).join("")}</ul>` : ""}`, "#wIn");
}
function saveWeight() {
  const v = Math.round(num($("#wIn").value) * 10) / 10, k = $("#wDate").value || dkey();
  if (!(v >= 30 && v <= 300)) return dlgError("Bitte ein Gewicht zwischen 30 und 300 kg eintragen.");
  if (k > dkey()) return dlgError("Das Datum liegt in der Zukunft.");
  const w = D().weights, cur = w.find(x => x.date === k);
  if (cur) cur.kg = v; else w.push({date: k, kg: v});
  w.sort((a, b) => a.date.localeCompare(b.date));
  persist(); opener = null; closeDialog(); rerender(); say(`${fmt(v)} Kilo für ${dayLabel(k)} gespeichert.`);
  const b = view.querySelector('[data-act="wopen"]'); if (b) b.focus();
}
function weightSection() {
  const w = D().weights.slice(-60);
  const avg = w.map((x, k) => { const from = new Date(x.date + "T12:00:00") - 6 * 864e5, win = w.slice(0, k + 1).filter(y => new Date(y.date + "T12:00:00") >= from); return win.reduce((a, y) => a + y.kg, 0) / win.length; });
  return `<h2 class="sec" style="margin-top:4px">Körpergewicht</h2>
    ${weightCard()}
    ${w.length >= 2 ? chart(w.map(x => x.kg), w.map(x => shortDate(x.date + "T12:00:00")), "kg", "Körpergewicht", avg) : `<p class="meta">Wiege dich ein paar Mal pro Woche, am besten morgens. Nach zwei Einträgen erscheint hier der Verlauf mit Trend.</p>`}
    ${w.length >= 8 ? (() => { const d = avg.at(-1) - avg[Math.max(0, avg.length - 8)]; return `<p class="meta">Trend: ${d > 0 ? "+" : d < 0 ? "−" : "±"}${fmt(Math.abs(Math.round(d * 10) / 10))} kg im Vergleich zu vor etwa einer Woche.</p>`; })() : ""}`;
}
/* ---------- Körpermaße ---------- */
const ML = Object.fromEntries(MEASURES.map(m => [m.id, m]));
// Schematische Figur von vorn mit Messlinien. Die Figur zeigt dich wie im Spiegel: dein rechter Arm ist links im Bild.
function measureFig(on) {
  const line = m => { const r = m.w / 2, cx = m.x + r;
    return `<g class="ml${m.id === on ? " on" : ""}"><ellipse cx="${cx}" cy="${m.y}" rx="${r + 3}" ry="${m.side ? 3 : 4}"/></g>`; };
  return `<svg class="mfig" viewBox="0 0 200 420" role="img" aria-label="${on ? `Messstelle ${esc(ML[on].l)}` : "Figur mit allen Messstellen"}">
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
    <span class="wl"><span class="eyebrow">Letzte Messung</span><b>${last ? dl(last.date).replace(/^./, c => c.toUpperCase()) : "Noch nicht gemessen"}</b>
      <small>${last ? (St.daysSince(last.date + "T12:00:00") >= 14 ? "Zeit für eine neue Messung" : "Alle 2–4 Wochen messen reicht") : "Maßband genügt. SATZ zeigt dir, wo du misst."}</small></span>
    <span class="wbtn">Messen</span></button>`;
  if (!ids.length) return `<h2 class="sec">Körpermaße</h2>${card}`;
  const h = D().profile.height, waist = last && last.m.taille;
  const sel = series(ui.msel);
  return `<h2 class="sec">Körpermaße</h2>${card}
    <ul class="logged">${ids.map(id => { const sr = series(id), a = sr[0], b = sr.at(-1), d = Math.round((b.v - a.v) * 10) / 10;
      return `<li><span>${esc(ML[id].l)}</span><span class="num">${fmt(b.v)} cm${sr.length > 1 ? ` <small class="meta">(${d > 0 ? "+" : d < 0 ? "−" : "±"}${fmt(Math.abs(d))} seit ${shortDate(a.date + "T12:00:00")})</small>` : ""}</span></li>`; }).join("")}</ul>
    ${h && waist ? (() => { const r = waist / h; return `<p class="meta" style="margin-top:6px">Taille ÷ Größe: ${fmt(Math.round(r * 100) / 100)}. Unter 0,5 gilt als günstig für die Gesundheit (Ashwell et al. 2012).</p>`; })() : ""}
    ${ids.length > 1 ? `<label class="field" style="margin-top:12px">Verlauf <select data-on="msel">${ids.map(id => `<option value="${id}" ${id === ui.msel ? "selected" : ""}>${esc(ML[id].l)}</option>`).join("")}</select></label>` : ""}
    ${sel.length >= 2 ? chart(sel.map(x => x.v), sel.map(x => shortDate(x.date + "T12:00:00")), "cm", ML[ui.msel].l) : `<p class="meta">Nach der zweiten Messung erscheint hier der Verlauf.</p>`}`;
}
function openMeasures(date) {
  const k = date || dkey(), ms = D().measures, cur = ms.find(x => x.date === k), prev = [...ms].reverse().find(x => x.date !== k);
  ui.mdate = k;
  openDialog(`<h2 id="dlg-h">Körpermaße</h2>
    <div class="mwrap">${measureFig(MEASURES[0].id)}<p class="mhow" id="mhow" aria-live="polite"><b>${esc(MEASURES[0].l)}:</b> ${esc(MEASURES[0].how)}</p></div>
    <details class="mtips"><summary>So misst du richtig</summary><ul>
      <li>Morgens, vor dem Essen und vor dem Training, immer unter gleichen Bedingungen.</li>
      <li>Weiches Maßband direkt auf der Haut, waagerecht, anliegend, ohne einzuschneiden. Ein Spiegel hilft.</li>
      <li>Jede Stelle zweimal messen. Weichen die Werte um mehr als 0,5 cm ab, ein drittes Mal und den Mittelwert nehmen.</li>
      <li>Du musst nicht alles messen. Taille allein sagt schon viel.</li></ul></details>
    <p class="err" role="alert" hidden></p>
    <label class="field">Datum <input id="mDate" type="date" value="${k}" max="${dkey()}" min="2000-01-01"></label>
    <div class="mgrid">${MEASURES.map(m => `<label class="field">${esc(m.l)}${m.side ? " (rechts)" : ""}
      <input name="mval" data-m="${m.id}" inputmode="decimal" autocomplete="off" aria-describedby="mh-${m.id}" value="${cur && cur.m[m.id] != null ? fmt(cur.m[m.id]) : ""}" placeholder="${prev && prev.m[m.id] != null ? fmt(prev.m[m.id]) : "cm"}">
      <span class="sr" id="mh-${m.id}">${esc(m.how)}</span></label>`).join("")}</div>
    <p class="foot">Felder in cm. Grau steht dein letzter Wert, leere Felder bleiben leer. Die Figur schaut dich an: Dein rechter Arm und dein rechtes Bein sind links im Bild.</p>
    <div class="dlg-actions"><button class="btn" data-act="close">Abbrechen</button><button class="btn primary" data-act="msave">Speichern</button></div>
    ${ms.length ? `<h3 class="meta" style="margin:16px 0 6px">Frühere Messungen</h3><ul class="logged">${ms.slice(-6).reverse().map(x => `<li><span>${esc(dayLabel(x.date))}</span><span class="num">${Object.keys(x.m).length} Maße <button type="button" class="linkbtn" data-act="mdel" data-d="${x.date}" aria-label="Messung ${esc(dayLabel(x.date))} löschen">Löschen</button></span></li>`).join("")}</ul>` : ""}`, '[name="mval"]');
}
function saveMeasures() {
  const k = $("#mDate").value || dkey();
  if (k > dkey()) return dlgError("Das Datum liegt in der Zukunft.");
  const vals = {};
  for (const inp of dlg.querySelectorAll('input[name="mval"]')) {
    if (!inp.value.trim()) continue;
    const v = Math.round(num(inp.value) * 10) / 10;
    if (!(v >= 10 && v <= 250)) { inp.focus(); return dlgError(`${ML[inp.dataset.m].l}: bitte einen Wert zwischen 10 und 250 cm eintragen.`); }
    vals[inp.dataset.m] = v;
  }
  if (!Object.keys(vals).length) return dlgError("Trag mindestens ein Maß ein.");
  const ms = D().measures, cur = ms.find(x => x.date === k), snap = St.snapshot();
  if (cur) cur.m = vals; else ms.push({date: k, m: vals});
  ms.sort((a, b) => a.date.localeCompare(b.date));
  persist(); opener = null; closeDialog(); rerender();
  toast(`${Object.keys(vals).length} ${Object.keys(vals).length === 1 ? "Maß" : "Maße"} für ${dayLabel(k)} gespeichert.`.replace(` für ${dayLabel(k)}`, ` ${dl(k)}`), () => { St.restore(snap); rerender(); });
  const b = view.querySelector('[data-act="mopen"]'); if (b) b.focus();
}
// Fokus auf ein Feld zeigt die passende Messstelle in der Figur
document.addEventListener("focusin", ev => {
  const inp = ev.target.closest && ev.target.closest('input[name="mval"]'); if (!inp) return;
  const m = ML[inp.dataset.m], fig = dlg.querySelector(".mfig"), how = $("#mhow"); if (!fig || !how) return;
  fig.outerHTML = measureFig(m.id); how.innerHTML = `<b>${esc(m.l)}:</b> ${esc(m.how)}`;
});

function openSessionEdit(id) {
  const x = D().sessions.find(y => y.id === id); if (!x) return;
  ui.sedit = id;
  openDialog(`<h2 id="dlg-h">Training korrigieren</h2><p class="meta" style="text-align:center;margin-top:-10px">${dateDe(x.date)} · ${esc(x.dayName)}</p>
    <p class="err" role="alert" hidden></p>
    <ol class="edlist">${x.sets.map((y, k) => `<li><div class="edrow"><span class="t">${esc(St.ex(y.exId).name)}${y.type === "warm" ? " · Aufwärmen" : y.type === "drop" ? " · Drop" : ""}</span>
      <label class="check" style="min-height:44px"><input type="checkbox" name="sdel" value="${k}">löschen</label></div>
      <div class="pair"><label class="field">kg <input name="skg" data-k="${k}" inputmode="decimal" value="${fmt(y.kg)}"></label><label class="field">Wdh. <input name="sreps" data-k="${k}" inputmode="numeric" value="${y.reps}"></label></div></li>`).join("")}</ol>
    <div class="dlg-actions" style="margin-top:12px"><button class="btn" data-act="close">Abbrechen</button><button class="btn primary" data-act="sesssave">Speichern</button></div>`, "h2");
}
function saveSessionEdit() {
  const x = D().sessions.find(y => y.id === ui.sedit), snap = St.snapshot();
  const del = new Set([...dlg.querySelectorAll('input[name="sdel"]:checked')].map(c => +c.value));
  for (const inp of dlg.querySelectorAll('input[name="skg"],input[name="sreps"]')) {
    const v = parseFloat(inp.value.replace(",", ".")), k = +inp.dataset.k;
    if (!isFinite(v) || v < 0 || (inp.name === "skg" ? v > 1000 : v > 100)) { inp.focus(); return dlgError("Bitte prüfe die markierten Werte: Gewicht 0–1000 kg, Wiederholungen 0–100."); }
    x.sets[k][inp.name === "skg" ? "kg" : "reps"] = inp.name === "skg" ? Math.round(v * 100) / 100 : Math.round(v);
  }
  x.sets = x.sets.filter((y, k) => !del.has(k));
  if (!x.sets.length) D().sessions = D().sessions.filter(y => y.id !== x.id);
  persist(); closeDialog(); rerender(); toast("Training korrigiert. Die Vorschläge nutzen die neuen Werte.", () => { St.restore(snap); rerender(); });
}

/* ============ Mehr ============ */
function viewMore() {
  const s = D().settings;
  const seg = (key, opts) => `<div class="seg" role="group">${opts.map(([v, l, aria]) => `<button type="button" data-act="set" data-k="${key}" data-v="${v}" aria-pressed="${String(s[key]) === String(v)}" ${aria ? `aria-label="${aria}"` : ""}>${l}</button>`).join("")}</div>`;
  view.innerHTML = `<h1 class="big">Mehr</h1>
    ${profileSection()}
    <h2 class="sec">Anzeige</h2>
    <div class="group">
      ${accentRow()}
      <div class="row stack"><span id="l-scale">Textgröße</span>${seg("scale", [[1, "iPhone", "Wie in den iPhone-Einstellungen"], [1.15, "A+", "Groß"], [1.3, "A++", "Sehr groß"], [1.5, "A+++", "Riesig"]]).replace('role="group"', 'role="group" aria-labelledby="l-scale"')}</div>
      <div class="row stack"><span id="l-theme">Erscheinungsbild</span>${seg("theme", [["auto", "Automatisch"], ["light", "Hell"], ["dark", "Dunkel"]]).replace('role="group"', 'role="group" aria-labelledby="l-theme"')}</div>
      <label class="row" for="s-contrast"><span>Kontrast erhöhen</span><input id="s-contrast" class="switch" type="checkbox" role="switch" data-on="contrast" ${s.contrast ? "checked" : ""}></label>
    </div>
    <p class="foot">„iPhone“ übernimmt die Textgröße aus Einstellungen → Anzeige &amp; Helligkeit.</p>
    <h2 class="sec">Training</h2>
    <div class="group">
      <label class="row" for="s-rir"><span>„Wdh. in Reserve“ abfragen</span><input id="s-rir" class="switch" type="checkbox" role="switch" data-on="rir" ${s.rir ? "checked" : ""}></label>
      <label class="row" for="s-sound"><span>Ringglocke am Pausenende</span><input id="s-sound" class="switch" type="checkbox" role="switch" data-on="sound" ${s.sound ? "checked" : ""}></label>
      <label class="row" for="s-voice"><span>Ansage „Next Round“</span><input id="s-voice" class="switch" type="checkbox" role="switch" data-on="voice" ${s.voice !== false ? "checked" : ""} ${s.sound ? "" : "disabled"}></label>
      <label class="row" for="s-bg"><span>Auch im Hintergrund läuten<small class="meta" style="display:block">Pausiert Spotify und andere Musik in jeder Pause</small></span><input id="s-bg" class="switch" type="checkbox" role="switch" data-on="bgbell" ${s.bgBell ? "checked" : ""} ${s.sound ? "" : "disabled"}></label>
      <div class="row"><span>Probe hören<small class="meta" style="display:block">${BELL.canMix() ? "Mischt sich mit Musik" : "Dieses iOS kann Töne nicht mit Musik mischen"}</small></span><button type="button" class="btn small" data-act="bellpreview" style="width:auto">Abspielen</button></div>
      <label class="row" for="s-fig"><span>Ausführung im Training zeigen</span><input id="s-fig" class="switch" type="checkbox" role="switch" data-on="showfig" ${s.showFig !== false ? "checked" : ""}></label>
    </div>
    <p class="foot">Die Glocke mischt sich mit deiner Musik und kommt nur, wenn der Stummschalter nicht auf lautlos steht. Die Ansage spricht eine englische Stimme deines Geräts, nur solange SATZ offen ist. „Auch im Hintergrund läuten“ spielt die Pause wie Musik ab: Die Glocke kommt dann auch bei gesperrtem Bildschirm oder in einer anderen App, aber iOS pausiert dafür deine Musik, und du musst sie danach selbst wieder starten. Wer Musik hört, lässt es aus. Während des Trainings bleibt der Bildschirm an.</p>
    <label class="field" style="margin-top:16px">Standardpause <select data-on="rest">
      <option value="0" ${!s.rest ? "selected" : ""}>Automatisch (schwere Grundübungen 180 s, andere 120 s, Isolation 90 s)</option>
      ${[60, 90, 120, 180].map(r => `<option value="${r}" ${s.rest === r ? "selected" : ""}>${r} s für alle</option>`).join("")}</select></label>
    <h2 class="sec">Deine Daten</h2>
    ${recoveredNote()}
    <p>Alles bleibt auf diesem Gerät. Es gibt kein Konto und keinen Server. Sichere deine Daten ab und zu als Datei, besonders vor einem Handywechsel.</p>
    <p class="meta">${s.lastBackup ? `Letzte Sicherung: ${new Date(s.lastBackup).toLocaleDateString("de-DE")} (vor ${St.daysSince(s.lastBackup)} ${St.daysSince(s.lastBackup) === 1 ? "Tag" : "Tagen"}).` : "Noch keine Sicherung erstellt."}</p>
    <button class="btn" data-act="export">Daten als Datei sichern</button>
    <button class="btn" data-act="import">Sicherung laden</button>
    <input type="file" id="importFile" accept="application/json,.json" hidden>
    <p class="err" id="importErr" role="alert" hidden></p>
    ${updateBackupRow()}
    <button class="btn destructive" data-act="reset">Alle Daten löschen</button>
    <h2 class="sec">Über SATZ</h2>
    <p class="meta">Ernährung: Grundumsatz nach Mifflin-St Jeor (Mifflin et al. 1990), Aktivitätsfaktoren nach FAO/WHO/UNU 2004, Protein 1,6–2,0 g/kg (Morton et al. 2018; Helms et al. 2014). Alle Schritte und Quellen siehst du unter Ernährung → Ziel. Barcode-Erkennung mit ZXing (Apache-2.0), Produktdaten von Open Food Facts (ODbL).</p>
    <p class="meta">3D-Körperkarte mit three.js (MIT). Figur und Bewegungsabläufe sind selbst gezeichnete Schemata: ähnliche Übungen teilen sich eine Bewegungsvorlage, eigene Übungen bekommen die Vorlage ihres Hauptmuskels.</p>
    <p class="meta">Die Regeln hinter der App: Doppelte Progression (Plotkin et al. 2022), etwa 10–20 Sätze pro Muskel und Woche (Schoenfeld et al. 2017; Pelland et al. 2026, mitarbeitende Muskeln als halber Satz), Pausen nach Übungsart: 180 s bei schweren Grundübungen bis 8 Wdh., sonst 120 s bzw. 90 s (Schoenfeld et al. 2016; Grgic et al. 2018; Singer et al. 2024), Entlastung bei Plateau (Bell et al. 2023), nach über 14 Tagen Pause 90 % als vorsichtige Faustregel (Bosquet et al. 2013), optionale RIR-Angabe (Zourdos et al. 2016). Keine Streaks, kein Zwang: Gewohnheiten brauchen Zeit, ein verpasster Tag schadet nicht (Lally et al. 2010).</p>
    <p class="meta">Version ${APP_VERSION} · Daten-Version ${St.VERSION}</p><div style="height:24px"></div>`;
}

// Vor jedem App-Update legt SATZ den alten Stand automatisch beiseite (die letzten 3).
function updateBackupRow() {
  const keys = St.updateBackups(); if (!keys.length) return "";
  const k = keys[0]; let b = {}; try { b = JSON.parse(localStorage.getItem(k)); } catch (e) {}
  let n = 0; try { n = JSON.parse(b.raw).sessions.length; } catch (e) {}
  return `<p class="meta">Automatisch gesichert vor dem Update auf ${esc(b.to || "")}: ${n} ${n === 1 ? "Training" : "Trainings"} vom ${new Date(k.slice(-19)).toLocaleDateString("de-DE")}. Falls nach einem Update etwas fehlt, holst du hier den alten Stand zurück.</p>
    <button class="btn" data-act="updrestore" data-k="${esc(k)}">Stand vor dem Update wiederherstellen</button>`;
}
function recoveredNote() {
  const keys = St.corruptKeys();
  if (!keys.length && !St.recovered) return "";
  return `<div class="note" role="alert"><b>Alte Daten beiseitegelegt.</b> Beim Start ließen sich gespeicherte Daten nicht lesen (${esc(St.recovered ? St.recovered.reason : "früherer Start")}). Sie wurden nicht überschrieben. Lade sie als Datei herunter und schick sie mir, dann rette ich sie.
    <div class="row-btns"><button class="btn small" data-act="dlcorrupt">Gesicherte Daten herunterladen</button>${keys.length ? `<button class="btn small destructive" data-act="delcorrupt">Verwerfen</button>` : ""}</div></div>`;
}
function backupDue() {
  const s = D().settings;
  return D().sessions.length >= 3 && (!s.lastBackup || St.daysSince(s.lastBackup) >= 14) && !(s.backupSnooze && St.daysSince(s.backupSnooze) < 7);
}

/* ============ Aktionen ============ */
const A = {
  close: () => closeDialog(),
  pickday: t => { ui.day = +t.dataset.i; rerender(`[data-act="pickday"][data-i="${ui.day}"]`); },
  start: t => { if (D().active) return go("#/training"); const p = St.activePlan(); St.startSession(p, +t.dataset.i); ui.summary = false; ui.key = ""; ui.day = null; go("#/training"); say(`Training gestartet: ${p.days[+t.dataset.i].name}.`); },
  adopt: t => {
    const tpl = TEMPLATES.find(x => x.id === t.dataset.id), p = St.instantiate(tpl);
    D().plans.push(p); D().activePlanId = p.id; persist(); ui.day = null;
    go("#/heute"); toast(`„${p.name}“ übernommen und aktiviert.`);
  },
  newplan: () => {
    const p = {id: St.uid(), name: "Mein Plan", perWeek: 3, cycle: {weeks: St.DEFAULT_CYCLE, start: dkey()}, days: [{id: St.uid(), name: "Tag 1", slots: []}]};
    D().plans.push(p); if (!D().activePlanId) D().activePlanId = p.id; persist(); ui.eday = 0; go(`#/plan/${p.id}`);
  },
  activate: t => { D().activePlanId = t.dataset.id; ui.day = null; persist(); rerender(); say(`${St.plan(t.dataset.id).name} ist jetzt aktiv.`); view.querySelector("h1").focus(); },
  copyplan: t => {
    const c = JSON.parse(JSON.stringify(St.plan(t.dataset.id)));
    c.id = St.uid(); c.name += " (Kopie)"; c.days.forEach(d => { d.id = St.uid(); d.slots.forEach(s => s.id = St.uid()); });
    D().plans.push(c); persist(); rerender(); toast(`Kopie „${c.name}“ angelegt.`);
  },
  delplan: t => {
    const snap = St.snapshot(), p = St.plan(t.dataset.id);
    D().plans = D().plans.filter(x => x.id !== p.id);
    if (D().activePlanId === p.id) D().activePlanId = D().plans[0]?.id || null;
    persist(); rerender(); view.querySelector("h1").focus();
    toast(`„${p.name}“ gelöscht. Deine Trainings bleiben im Verlauf.`, () => { St.restore(snap); rerender(); });
  },
  cyclerestart: () => { const p = curPlan(); p.cycle = {weeks: p.cycle.weeks, start: dkey()}; persist(); rerender('[data-on="cycleweeks"]'); say("Rhythmus neu gestartet: Woche 1, Aufbau."); },
  deloadnow: () => { const p = curPlan(); p.cycle = {weeks: p.cycle.weeks, start: shiftDay(dkey(), -(p.cycle.weeks - 1) * 7)}; persist(); rerender('[data-act="cyclerestart"]'); say("Diese Woche ist jetzt Entlastungswoche."); },
  perweek: t => { const p = curPlan(); p.perWeek = Math.min(7, Math.max(1, p.perWeek + +t.dataset.d)); persist(); rerender(`[data-act="perweek"][data-d="${t.dataset.d}"]`); },
  eday: t => { ui.eday = +t.dataset.i; rerender(`[data-act="eday"][data-i="${ui.eday}"]`); },
  addday: () => { const p = curPlan(); p.days.push({id: St.uid(), name: `Tag ${p.days.length + 1}`, slots: []}); ui.eday = p.days.length - 1; persist(); rerender('[data-on="dname"]'); view.querySelector('[data-on="dname"]').select(); say(`Tag ${ui.eday + 1} hinzugefügt. Gib ihm einen Namen.`); },
  delday: () => {
    const p = curPlan(), snap = St.snapshot(), name = p.days[ui.eday].name;
    p.days.splice(ui.eday, 1); ui.eday = Math.max(0, ui.eday - 1); persist(); rerender(); view.querySelector("h1").focus();
    toast(`Tag „${name}“ gelöscht.`, () => { St.restore(snap); rerender(); });
  },
  mv: t => {
    const d = curPlan().days[ui.eday], i = +t.dataset.i, j = i + +t.dataset.d;
    [d.slots[i], d.slots[j]] = [d.slots[j], d.slots[i]]; persist();
    rerender(); const same = view.querySelector(`[data-act="mv"][data-i="${j}"][data-d="${t.dataset.d}"]`);
    (same && !same.disabled ? same : view.querySelector(`[data-act="mv"][data-i="${j}"]:not(:disabled)`)).focus();
    say(`${St.ex(d.slots[j].exId).name}: Position ${j + 1} von ${d.slots.length}.`);
  },
  delslot: t => {
    const d = curPlan().days[ui.eday], snap = St.snapshot(), sl = d.slots.splice(+t.dataset.i, 1)[0];
    persist(); rerender("#addslot");
    toast(`${St.ex(sl.exId).name} entfernt.`, () => { St.restore(snap); rerender(); });
  },
  slot: t => { ui.draft = {...curPlan().days[ui.eday].slots[+t.dataset.i]}; ui.draftNew = false; openSlot(); },
  slotsave: () => saveSlot(),
  addslot: () => openPicker(exId => { ui.draft = {id: St.uid(), exId, ...slotDefault(St.ex(exId))}; ui.draftNew = true; openSlot(); }),
  // Beim Tausch in eine andere Einheit (z. B. Wdh. → Sekunden) passt das Satzschema nicht mehr: dann das Standardschema der neuen Übung
  swap: () => { const keep = ui.draft, from = St.ex(keep.exId); openPicker(exId => { const to = St.ex(exId);
    ui.draft = (to.unit === "s") === (from.unit === "s") && isMobility(to) === isMobility(from) ? {...keep, exId} : {...keep, exId, ...slotDefault(to)}; openSlot(); }, keep.exId); },
  pick: t => { const cb = pickCb; pickCb = null; cb(t.dataset.id); },
  newex: () => { const cb = pickCb; openExForm(null, ui.pq.trim(), id => { pickCb = null; cb(id); }); },
  newexlist: () => openExForm(null, ""),
  editex: t => openExForm(t.dataset.id),
  exsave: () => saveEx(),
  exdel: () => {
    const e = D().exercises[ui.exEdit], snap = St.snapshot();
    e.archived = true; persist(); closeDialog(); rerender();
    toast(`${e.name} archiviert. Der Verlauf bleibt erhalten.`, () => { St.restore(snap); rerender(); });
  },
  /* Training */
  kg: t => { readSetInputs(); const a = D().active, e = St.ex(a.queue[a.idx].exId); ui.kg = Math.max(0, Math.round((ui.kg + e.step * +t.dataset.d) * 100) / 100); $("#kgIn").value = fmt(ui.kg); syncCur(); sayLater(`${fmt(ui.kg)} Kilo`); },
  reps: t => { readSetInputs(); const e = St.ex(D().active.queue[D().active.idx].exId), d = e.unit === "s" ? 5 : 1;
    ui.reps = Math.max(0, Math.min(100, ui.reps + d * +t.dataset.d)); $("#repsIn").value = ui.reps; syncCur(); sayLater(`${ui.reps} ${St.repWord(e)}`); },
  stype: t => { readSetInputs(); ui.stype = t.dataset.v; rerender(`[data-act="stype"][data-v="${t.dataset.v}"]`); },
  note: () => {
    const a = D().active, exId = a.queue[a.idx].exId, cur = (a.notes || {})[exId] || "";
    openDialog(`<h2 id="dlg-h">Notiz: ${esc(St.ex(exId).name)}</h2>
      <label class="field">Zum Beispiel Sitzhöhe, Griff oder wie es lief <textarea id="noteIn" rows="4" maxlength="500">${esc(cur)}</textarea></label>
      <div class="dlg-actions"><button class="btn" data-act="close">Abbrechen</button><button class="btn primary" data-act="notesave">Speichern</button></div>`, "#noteIn");
  },
  notesave: () => {
    const a = D().active, exId = a.queue[a.idx].exId, v = $("#noteIn").value.trim();
    a.notes = a.notes || {}; if (v) a.notes[exId] = v; else delete a.notes[exId];
    persist(); closeDialog(); readSetInputs(); rerender(); say(v ? "Notiz gespeichert." : "Notiz gelöscht.");
  },
  rir: t => { const v = +t.dataset.v; ui.rir = ui.rir === v ? null : v; rerenderKeep(t); },
  saveset: () => saveSet(),
  undoset: () => {
    const a = D().active, i = a.idx, k = a.sets.map(s => s.q).lastIndexOf(i);
    if (k < 0) return;
    const s = a.sets.splice(k, 1)[0]; a.restEnd = 0; persist();
    ui.key = `${a.id}:${i}:${St.workFor(a, i).length}`; ui.rir = s.rir; ui.kg = s.kg; ui.reps = s.reps; rerender("#saveset"); say("Letzter Satz gelöscht. Werte zum Korrigieren übernommen.");
  },
  adddrop: () => { const a = D().active; ui.pin = a.idx; ui.addAfter = true; ui.stype = "drop"; rerender("#saveset"); say("Drop-Satz anhängen. Gewicht und Wiederholungen einstellen, dann speichern."); },
  extraless: () => { const a = D().active, it = a.queue[a.idx]; if (it.extra < 1 || St.workFor(a, a.idx).length >= St.targetSets(it)) return; it.extra--; persist(); rerender("#saveset"); say(`Extra-Satz entfernt. Jetzt ${St.targetSets(it)} Sätze.`); },
  extraset: () => { const a = D().active; a.queue[a.idx].extra++; persist(); rerender("#saveset"); say(`Extra-Satz hinzugefügt. Jetzt ${St.targetSets(a.queue[a.idx])} Sätze.`); },
  skipex: () => {
    const a = D().active, i = a.idx, name = St.ex(a.queue[i].exId).name;
    a.queue[i].skipped = true; a.restEnd = 0;
    const n = St.firstOpen(a, i); if (n < 0) ui.summary = true; else a.idx = n;
    ui.key = ""; persist(); rerender(); view.querySelector("h1").focus();
    toast(`${name} ausgelassen.`, () => { a.queue[i].skipped = false; a.idx = i; ui.summary = false; ui.key = ""; persist(); rerender(); view.querySelector("h1").focus(); });
  },
  rest30: () => { const a = D().active; a.restEnd += 30000; a.restTotal = (a.restTotal || 0) + 30; scheduleBeep((a.restEnd - Date.now()) / 1000); persist(); const el = $("#rt"); if (el) el.textContent = restLeft(); say(`Pause verlängert, noch ${restLeft().replace(":", " Minuten ")} Sekunden.`); },
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
    toast("Satz gelöscht.", () => { St.restore(snap); rerender(); });
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
      if (dv.kind === "remove") day.slots.splice(idx, 1); else day.slots[idx].sets = q.sets + q.extra;
    });
    const n = a.sets.length; St.finishSession(); ui.summary = false; ui.key = ""; cancelBeep();
    go("#/heute"); toast(n ? `Training gespeichert: ${n} Sätze.${checked.length ? " Plan angepasst." : ""}` : "Training beendet.");
  },
  discard: () => {
    const snap = St.snapshot(); D().active = null; persist(); ui.summary = false; cancelBeep(); go("#/heute");
    toast("Training verworfen.", () => { St.restore(snap); go("#/training"); });
  },
  sessedit: t => openSessionEdit(t.dataset.id),
  sesssave: () => saveSessionEdit(),
  wopen: () => openWeight(),
  bellpreview: () => BELL.preview(D().settings.voice !== false),
  wsave: () => saveWeight(),
  wstep: t => { const i = $("#wIn"), v = Math.round((num(i.value) + 0.1 * +t.dataset.d) * 10) / 10; i.value = fmt(Math.max(30, Math.min(300, v))); sayLater(`${fmt(v)} Kilo`); },
  wdel: t => {
    const k = t.dataset.d, snap = St.snapshot(); D().weights = D().weights.filter(x => x.date !== k); persist(); opener = null; closeDialog(); rerender();
    toast(`Gewicht vom ${dayLabel(k)} gelöscht.`, () => { St.restore(snap); rerender(); });
  },
  weightsave: () => { const el = view.querySelector('[data-on="pweight"]'); el.dispatchEvent(new Event("change", {bubbles: true})); rerender(); },
  delsession: t => {
    const snap = St.snapshot(); D().sessions = D().sessions.filter(x => x.id !== t.dataset.id); persist(); rerender(); view.querySelector("h1").focus();
    toast("Training gelöscht.", () => { St.restore(snap); rerender(); });
  },
  /* Körperkarte & Ziele */
  tgoal: t => { ui.tgoal = t.dataset.v; rerender(`[data-act="tgoal"][data-v="${t.dataset.v}"]`); },
  bm: t => pickMuscle(t.dataset.m, false),
  b3go: () => { const h = $("#bx-h"); if (h) { h.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"}); h.focus({preventScroll: true}); } },
  bside: t => { setSide(t.dataset.v); if (body3d) t.dataset.v === "back" ? body3d.back() : body3d.front(); say(t.dataset.v === "back" ? "Rückansicht." : "Vorderansicht."); },
  bmadd: t => {
    const p = St.activePlan(), e = St.ex(t.dataset.id);
    if (!p) return toast("Übernimm zuerst einen Plan oder leg einen leeren an. Dann kannst du Übungen hinzufügen.");
    if (!p.days.length) return toast(`„${p.name}“ hat noch keinen Trainingstag. Leg zuerst einen an.`);
    const [sets, min, max] = schemeFor(e, p.goal);
    openDialog(`<h2 id="dlg-h">${esc(e.name)} hinzufügen</h2>
      <p class="meta" style="text-align:center;margin-top:-10px">Zu welchem Tag in „${esc(p.name)}“? Startet mit ${sets}×${min}–${max}, im Plan änderbar.</p>
      <ul class="plist" style="max-height:none">${p.days.map((d, i) => `<li><button data-act="bmaddday" data-i="${i}" data-id="${e.id}"><b>${esc(d.name)}</b><small>${d.slots.length} Übungen${d.slots.some(s => s.exId === e.id) ? " · schon enthalten" : ""}</small></button></li>`).join("")}</ul>
      <button class="btn" data-act="close">Abbrechen</button>`);
  },
  bmaddday: t => {
    const p = St.activePlan(), d = p.days[+t.dataset.i], e = St.ex(t.dataset.id), [sets, min, max, rest] = schemeFor(e, p.goal);
    const sl = {id: St.uid(), exId: e.id, sets, min, max, rest};
    d.slots.push(sl); persist(); closeDialog();
    toast(`${e.name} zu „${d.name}“ hinzugefügt.`, () => { d.slots = d.slots.filter(x => x !== sl); persist(); });
  },
  /* Einstellungen */
  set: t => { const k = t.dataset.k, v = t.dataset.v; D().settings[k] = k === "scale" ? +v : v; persist(); applySettings(); rerender(`[data-k="${k}"][data-v="${v}"]`); },
  export: () => {
    D().settings.lastBackup = new Date().toISOString(); persist();
    const blob = new Blob([JSON.stringify(D(), null, 1)], {type: "application/json"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `satz-sicherung-${new Date().toISOString().slice(0, 10)}.json`; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast("Sicherung erstellt."); if (location.hash.startsWith("#/mehr") || location.hash.startsWith("#/heute")) rerender();
  },
  import: () => $("#importFile").click(),
  dlcorrupt: () => {
    const keys = St.corruptKeys(), raw = keys.length ? keys.map(k => localStorage.getItem(k)).join("\n") : (St.recovered && St.recovered.raw) || "";
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([raw], {type: "text/plain"}));
    a.download = "satz-gerettete-daten.txt"; document.body.append(a); a.click(); a.remove();
  },
  delcorrupt: () => { St.corruptKeys().forEach(k => localStorage.removeItem(k)); rerender(); toast("Gesicherte Altdaten verworfen."); },
  snoozebackup: () => { D().settings.backupSnooze = new Date().toISOString(); persist(); rerender(); },
  reset: () => openDialog(`<h2 id="dlg-h">Alle Daten löschen?</h2>
    <p>Pläne, ${D().sessions.length} Trainings, Ernährungstagebuch und Profil werden von diesem Gerät gelöscht. Das lässt sich nur kurz rückgängig machen.</p>
    <button class="btn" data-act="export">Vorher als Datei sichern</button>
    <label class="field" style="margin-top:16px">Zum Bestätigen LÖSCHEN eintippen <input id="resetIn" autocomplete="off" autocapitalize="characters"></label>
    <p class="err" role="alert" hidden></p>
    <div class="dlg-actions"><button class="btn" data-act="close">Abbrechen</button><button class="btn destructive" data-act="resetgo">Endgültig löschen</button></div>`, "h2"),
  updrestore: t => {
    const snap = St.snapshot();
    try { St.restoreUpdateBackup(t.dataset.k); } catch (e) { return toast("Diese Sicherung ließ sich nicht lesen. Deine aktuellen Daten sind unverändert."); }
    applySettings(); rerender();
    toast(`Stand vor dem Update geladen: ${D().sessions.length} Trainings.`, () => { St.restore(snap); applySettings(); rerender(); });
  },
  mopen: () => openMeasures(),
  msave: () => saveMeasures(),
  mdel: t => {
    const snap = St.snapshot(), k = t.dataset.d;
    D().measures = D().measures.filter(x => x.date !== k); persist(); openMeasures(); rerender();
    toast(`Messung vom ${dayLabel(k)} gelöscht.`, () => { St.restore(snap); rerender(); });
  },
  resetgo: () => {
    if ($("#resetIn").value.trim().toUpperCase() !== "LÖSCHEN") return dlgError("Bitte LÖSCHEN eintippen.");
    closeDialog();
    const snap = St.snapshot(); const keep = D().settings;
    localStorage.removeItem("satz-data"); St.load(); D().settings = keep; persist(); ui.day = null; go("#/heute");
    toast("Alle Daten gelöscht.", () => { St.restore(snap); go("#/mehr"); });
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
  if (k === "dname") { const p = curPlan(); p.days[ui.eday].name = el.value.trim() || `Tag ${ui.eday + 1}`; persist(); rerender('[data-on="dname"]'); }
  if (k === "cycleweeks") { const p = curPlan(), n = +el.value; p.cycle = n ? {weeks: n, start: p.cycle && p.cycle.weeks ? p.cycle.start : dkey()} : {weeks: 0, start: dkey()}; persist(); rerender('[data-on="cycleweeks"]'); }
  if (k === "msel") { ui.msel = el.value; rerender('[data-on="msel"]'); }
  if (k === "histex") { ui.histEx = el.value; rerender('[data-on="histex"]'); }
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
      try { data = St.sanitizeImport(JSON.parse(r.result)); } catch (e) { err.textContent = `Diese Datei ist keine gültige SATZ-Sicherung. ${e instanceof SyntaxError ? "" : e.message}`; err.hidden = false; return; }
      const snap = St.snapshot(); St.replaceAll(data); applySettings(); ui.day = null;
      go("#/heute"); toast(`Sicherung geladen: ${data.sessions.length} Trainings.`, () => { St.restore(snap); applySettings(); go("#/mehr"); });
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
const r0 = n => Math.round(n).toLocaleString("de-DE");
const r1 = n => (Math.round(n * 10) / 10).toLocaleString("de-DE");
const dkey = (d = new Date()) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const shiftDay = (k, n) => { const d = new Date(k + "T12:00:00"); d.setDate(d.getDate() + n); return dkey(d); };
function dayLabel(k) {
  const t = dkey();
  if (k === t) return "Heute";
  if (k === shiftDay(t, -1)) return "Gestern";
  return new Date(k + "T12:00:00").toLocaleDateString("de-DE", {weekday: "long", day: "numeric", month: "long"});
}
const ACCENTS = [["gruen", "Grün", "#00703A", "#00C46A"], ["petrol", "Petrol", "#0B6E7F", "#4CD3E3"], ["kobalt", "Kobalt", "#1D4ED8", "#7AA2FF"], ["violett", "Violett", "#6D28D9", "#B9A0FF"], ["beere", "Beere", "#B0185F", "#FF8CC0"], ["signal", "Signal", "#C8102E", "#FF8585"], ["kupfer", "Kupfer", "#B23C00", "#FF9A5C"], ["ocker", "Ocker", "#865600", "#F2C14E"], ["graphit", "Graphit", "#1C1C1E", "#F2F2F7"]];
const isDark = () => { const s = D().settings; return s.theme === "dark" || (s.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches); };
const targets = () => N.activeTargets(D().profile, St.currentWeight());
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
  view.innerHTML = `<h1 class="big">Ernährung</h1>
    <div class="daynav"><button type="button" data-act="fday" data-d="-1" aria-label="Vorheriger Tag">‹</button>
      <span class="t" aria-live="polite">${esc(dayLabel(k))}</span>
      <button type="button" data-act="fday" data-d="1" aria-label="Nächster Tag" ${k >= today ? "disabled" : ""}>›</button></div>
    <section class="card" aria-labelledby="sum-h">
      <h2 id="sum-h" class="sr">Tagesbilanz</h2>
      <div class="kcal"><span class="v">${r0(sum.kcal)}<span class="meta" style="font-size:1rem;font-weight:500"> kcal</span></span>
        <span class="r">${t ? (left >= 0 ? `noch ${r0(left)} von ${r0(t.kcal)}` : `${r0(-left)} über ${r0(t.kcal)}`) : "kein Ziel gesetzt"}</span></div>
      ${t ? bar(sum.kcal, t.kcal) : ""}
      <div class="macros">${mac("Protein", sum.p, t && t.p)}${mac("Kohlenhydrate", sum.c, t && t.c)}${mac("Fett", sum.f, t && t.f)}</div>
      <div class="row-btns"><button class="btn small" data-act="goals" aria-haspopup="dialog">${t ? (t.manual ? "Ziel: manuell" : "Ziel: berechnet") + " · Quellen" : "Ziel festlegen"}</button></div>
    </section>
    ${t ? "" : N.computeTargets(D().profile, St.currentWeight())?.blocked ? `<p class="hint">SATZ berechnet Ernährungsziele erst ab ${N.MIN_AGE} Jahren. Du kannst trotzdem mitschreiben, was du isst.</p>`
      : `<section class="card" aria-labelledby="ob-h"><h2 id="ob-h" style="font-size:1.1rem;margin:0 0 4px">Bedarf berechnen</h2><p class="meta">Mit diesen Angaben berechnet SATZ deinen Bedarf nach anerkannten Formeln. Noch fehlt: ${esc(N.missing(D().profile, St.currentWeight()).join(", "))}. Oder leg die Werte über „Ziel festlegen“ selbst fest.</p>${profileSection().replace('<h2 class="sec" style="margin-top:4px">Persönliche Daten</h2>', "")}</section>`}
    ${t && k === today ? weightCard() : ""}
    ${t && k === today ? adaptCard() : ""}
    ${!entries.length && prevN ? `<button class="btn" data-act="fcopyprev">Vortag übernehmen (${prevN} ${prevN === 1 ? "Eintrag" : "Einträge"})</button>` : ""}
    ${N.MEALS.map(([id, name]) => { const es = entries.filter(e => e.meal === id), ms = N.sumEntries(es); return `
      <div class="mealh"><h2 class="sec" id="m-${id}">${name}</h2>${es.length ? `<span>${r0(ms.kcal)} kcal</span>` : entries.length && prevMeal(id) ? `<button type="button" class="linkbtn" data-act="fcopymeal" data-m="${id}">Wie gestern<span class="sr"> (${name})</span></button>` : ""}</div>
      <ul class="group" aria-labelledby="m-${id}">
        ${es.map(e => { const m = N.macrosFor(e.per100, e.grams); return `<li><button class="fbtn" data-act="fedit" data-id="${e.id}" aria-haspopup="dialog"><span><b>${esc(e.name)}</b><small>${e.quick ? "Schnell-Eintrag" : `${r0(e.grams)} g`} · P ${r0(m.p)} · K ${r0(m.c)} · F ${r0(m.f)}</small></span><span class="k">${r0(m.kcal)} kcal</span></button></li>`; }).join("")}
        <li><button class="fbtn add" data-act="fadd" data-m="${id}" aria-haspopup="dialog">+ Hinzufügen<span class="sr"> zu ${name}</span></button></li>
      </ul>`; }).join("")}
    <p class="foot" style="margin-top:16px">Produktdaten aus dem Netz kommen von Open Food Facts, einer freien Datenbank, die von Freiwilligen gepflegt wird. Prüfe die Werte auf der Verpackung. An Open Food Facts geht nur der Barcode oder Suchbegriff, nichts über dich.</p>
    <div style="height:24px"></div>`;
}

/* ---------- Adaptiver Bedarf ---------- */
function adaptCard() {
  const pr = D().profile, a = N.adaptiveTdee(D().food, D().weights, dkey()), adj = pr.tdeeAdj;
  if (!a.ok) {
    const pct = Math.min(100, Math.round(Math.min(a.span, N.ADAPT.minDays) / N.ADAPT.minDays * 100));
    return `<section class="card adapt" aria-labelledby="ad-h"><h2 id="ad-h" class="eyebrow" style="margin:0 0 4px">Dein echter Verbrauch</h2>
      ${adj ? `<p class="meta">Dein Ziel nutzt den gemessenen Verbrauch von ${r0(adj.tdee)} kcal (Stand ${shortDate(adj.date + "T12:00:00")}).</p>` : `<p class="meta">Aus Gewicht und Essen errechnet SATZ nach 2 Wochen, was du wirklich verbrauchst.</p>`}
      <div class="bar" role="progressbar" aria-label="Fortschritt bis zur Berechnung" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
      <p class="meta" style="margin:6px 0 0">${esc(a.need)}</p></section>`;
  }
  const kg = St.currentWeight(), formula = N.computeTargets({...pr, tdeeAdj: null}, kg), next = N.computeTargets({...pr, tdeeAdj: {tdee: a.tdee}}, kg);
  if (!formula || formula.blocked || !next) return "";
  const cur = adj ? adj.tdee : formula.steps.tdee, diff = a.tdee - cur;
  const odd = a.tdee < formula.steps.bmr || a.tdee > formula.steps.bmr * 2.6;
  const trend = `${a.slopeWeek > 0 ? "+" : a.slopeWeek < 0 ? "−" : "±"}${fmt(Math.abs(a.slopeWeek))} kg pro Woche`;
  return `<section class="card adapt" aria-labelledby="ad-h"><h2 id="ad-h" class="eyebrow" style="margin:0 0 4px">Dein echter Verbrauch</h2>
    <p class="kcal" style="margin:0"><span class="v">ca. ${r0(a.tdee)}<span class="meta" style="font-size:1rem;font-weight:500"> kcal</span></span><span class="r">Formel: ${r0(formula.steps.tdee)}</span></p>
    <p class="meta">Aus ${a.logged} eingetragenen Tagen: im Schnitt ${r0(a.intake)} kcal gegessen, Gewichtstrend ${trend}.</p>
    ${odd ? `<p class="note">Der Wert liegt ${a.tdee < formula.steps.bmr ? "unter deinem Grundumsatz" : "ungewöhnlich hoch"}. Meist fehlen Einträge oder das Gewicht schwankt stark. SATZ schlägt deshalb nichts vor.</p>`
      : Math.abs(diff) < 100 ? `<p class="meta">${adj ? "Dein Ziel nutzt diesen Wert bereits." : "Passt zur Formel. Kein Anpassen nötig."}</p>`
      : `<p>Neues Tagesziel: <b>${r0(next.kcal)} kcal</b> statt ${r0(targets().kcal)} (${diff > 0 ? "+" : "−"}${r0(Math.abs(diff))} kcal Verbrauch).</p>
        <div class="row-btns"><button class="btn small primary" data-act="adapt" data-v="${a.tdee}" data-n="${a.logged}">Übernehmen</button><button class="btn small" data-act="goals" aria-haspopup="dialog">Rechnung ansehen</button></div>`}
  </section>`;
}

/* ---------- Hinzufügen ---------- */
function openFoodAdd(meal) {
  ui.fmeal = meal; ui.fq = ""; ui.foff = null; ui.foffState = "";
  openDialog(`<h2 id="dlg-h">${esc(N.MEALS.find(m => m[0] === meal)[1])}: hinzufügen</h2>
    <div class="row-btns" style="margin:0 0 16px"><button class="btn small primary" data-act="scan">Barcode scannen</button><button class="btn small" data-act="newfood">Neues Lebensmittel</button><button class="btn small" data-act="fquick" aria-haspopup="dialog">Nur kcal</button></div>
    <label class="field">Suchen <input id="fq" type="search" data-on="fq" autocomplete="off" enterkeyhint="search"></label>
    <div id="fres"></div>
    <button class="btn" data-act="close">Abbrechen</button>`, "#fq");
  renderFoodResults();
}
function localFoods(q) {
  const used = {}; D().food.forEach((e, i) => { if (e.foodId) used[e.foodId] = i; });
  return Object.values(D().foods).filter(f => !q || (f.name + " " + (f.brand || "")).toLowerCase().includes(q))
    .sort((a, b) => (used[b.id] ?? -1) - (used[a.id] ?? -1) || a.name.localeCompare(b.name, "de"));
}
function renderFoodResults() {
  const box = $("#fres"); if (!box) return;
  const q = ui.fq.trim().toLowerCase(), all = localFoods(q);
  const favs = q ? [] : all.filter(f => f.fav), list = all.filter(f => !favs.includes(f)).slice(0, 30);
  ui.fcands = [...favs, ...list];
  const item = (f, i) => `<li><button data-act="pickfood" data-i="${i}"><b>${f.fav ? `<span aria-hidden="true">★ </span>` : ""}${esc(f.name)}${f.fav && q ? `<span class="sr"> (Favorit)</span>` : ""}</b><small>${esc(foodLine(f))}</small></button></li>`;
  let off = "";
  if (ui.foffState === "loading") off = `<p class="meta" role="status">Suche bei Open Food Facts …</p>`;
  else if (ui.foffState === "error") off = `<p class="err" role="alert">Open Food Facts antwortet gerade nicht. Die Online-Suche erlaubt nur wenige Anfragen pro Minute. Versuch es gleich nochmal, scanne den Barcode oder leg das Lebensmittel selbst an.</p>`;
  else if (ui.foff) {
    const base = ui.fcands.length;
    ui.fcands.push(...ui.foff);
    off = `<h3 class="meta" style="margin:12px 0 6px">Open Food Facts: ${ui.foff.length} Treffer</h3>${ui.foff.length ? `<ul class="plist">${ui.foff.map((f, i) => item(f, base + i)).join("")}</ul>` : ""}`;
  }
  box.innerHTML = `
    ${favs.length ? `<h3 class="meta" style="margin:0 0 6px">Favoriten</h3><ul class="plist">${favs.map(item).join("")}</ul>` : ""}
    ${list.length ? `<h3 class="meta" style="margin:${favs.length ? "12px" : "0"} 0 6px">${q ? "Deine Lebensmittel" : "Zuletzt verwendet"}</h3><ul class="plist">${list.map((f, i) => item(f, favs.length + i)).join("")}</ul>`
      : favs.length ? "" : `<p class="meta">${q ? "Keine eigenen Treffer." : "Noch keine eigenen Lebensmittel. Scanne einen Barcode, suche online oder leg eins an."}</p>`}
    ${q.length >= 3 && !ui.foff && ui.foffState !== "loading" ? `<button class="btn" data-act="offsearch" style="margin-bottom:12px">„${esc(ui.fq.trim())}“ online suchen</button>` : ""}
    ${off}`;
}

/* ---------- Menge ---------- */
function openAmount(food, entry) {
  ui.famount = {food, entry};
  const grams = entry ? entry.grams : food.serving || 100;
  const mealSel = entry ? entry.meal : ui.fmeal || "snack", fav = !!(food.id && D().foods[food.id] && D().foods[food.id].fav);
  openDialog(`<h2 id="dlg-h">${esc(food.name)}</h2>
    <p class="meta" style="text-align:center;margin-top:-10px">${esc(foodLine(food))}</p>
    <div class="favrow"><button type="button" class="btn small favbtn" data-act="ffav" aria-pressed="${fav}"><span aria-hidden="true">${fav ? "★" : "☆"}</span> ${fav ? "Favorit" : "Als Favorit merken"}</button></div>
    <p class="err" role="alert" hidden></p>
    ${food.serving ? `<div class="pair"><label class="field">Portionen à ${fmt(food.serving)} g <input id="fport" data-on="fport" inputmode="decimal" autocomplete="off" value="${fmt(Math.round(grams / food.serving * 100) / 100)}"></label>
      <label class="field">Gramm <input id="fgrams" data-on="fgrams" inputmode="decimal" autocomplete="off" value="${fmt(grams)}"></label></div>
      <div class="quick"><button class="btn small" data-act="fgset" data-g="${food.serving / 2}">½ Portion</button><button class="btn small" data-act="fgset" data-g="${food.serving}">1 Portion</button><button class="btn small" data-act="fgset" data-g="${food.serving * 2}">2 Portionen</button><button class="btn small" data-act="fgset" data-g="100">100 g</button></div>`
      : `<label class="field">Menge in Gramm <input id="fgrams" data-on="fgrams" inputmode="decimal" autocomplete="off" value="${fmt(grams)}"></label>`}
    <div class="preview" id="fprev" aria-live="polite"></div>
    <label class="field">Mahlzeit <select id="fmealsel">${N.MEALS.map(([id, n]) => `<option value="${id}" ${id === mealSel ? "selected" : ""}>${n}</option>`).join("")}</select></label>
    <div class="dlg-actions"><button class="btn" data-act="close">Abbrechen</button><button class="btn primary" data-act="amountsave">${entry ? "Speichern" : "Hinzufügen"}</button></div>
    ${entry ? `<button class="btn destructive" data-act="fdel" style="margin-top:10px">Eintrag löschen</button>` : ""}
    ${food.id && D().foods[food.id] ? `<button class="btn" data-act="foodedit" style="margin-top:10px">Lebensmittel bearbeiten</button>` : ""}`, "#fgrams");
  updatePreview();
}
function updatePreview() {
  const el = $("#fprev"); if (!el || !ui.famount) return;
  const m = N.macrosFor(ui.famount.food.per100, num($("#fgrams").value));
  el.innerHTML = `<div><b>${r0(m.kcal)}</b><small>kcal</small></div><div><b>${r1(m.p)}</b><small>Protein g</small></div><div><b>${r1(m.c)}</b><small>Kohlenh. g</small></div><div><b>${r1(m.f)}</b><small>Fett g</small></div>`;
}
function syncPort() { const f = ui.famount && ui.famount.food, p = $("#fport"); if (f && f.serving && p) { const g = num($("#fgrams").value); p.value = g ? fmt(Math.round(g / f.serving * 100) / 100) : ""; } }
/* ---------- Schnell-Eintrag: nur Kalorien (z. B. Restaurant) ---------- */
// Gespeichert als 1000 g mit Werten pro 100 g = Gesamtwert ÷ 10, damit die normale Rechnung und Import-Prüfung gelten.
function openQuick(entry) {
  ui.fquickEdit = entry || null;
  const v = k => entry ? fmt(Math.round(entry.per100[k] * 10)) : "";
  const mealSel = entry ? entry.meal : ui.fmeal || "snack";
  const fld = (id, label, val) => `<label class="field">${label} <input id="${id}" inputmode="decimal" autocomplete="off" value="${val}"></label>`;
  openDialog(`<h2 id="dlg-h">${entry ? "Schnell-Eintrag ändern" : "Nur Kalorien eintragen"}</h2>
    <p class="meta" style="text-align:center;margin-top:-10px">Für Essen ohne Verpackung, etwa im Restaurant. Schätzen ist besser als weglassen.</p>
    <p class="err" role="alert" hidden></p>
    <label class="field">Bezeichnung <small style="display:inline">(optional)</small><input id="q-name" autocomplete="off" value="${esc(entry ? entry.name : "")}" placeholder="z. B. Pizza beim Italiener"></label>
    ${fld("q-kcal", "Energie (kcal)", v("kcal"))}
    <p class="meta" style="margin:-4px 0 10px">Optional, falls bekannt:</p>
    <div class="pair">${fld("q-p", "Protein (g)", v("p"))}${fld("q-c", "Kohlenh. (g)", v("c"))}</div>${fld("q-f", "Fett (g)", v("f"))}
    <label class="field">Mahlzeit <select id="q-meal">${N.MEALS.map(([id, n]) => `<option value="${id}" ${id === mealSel ? "selected" : ""}>${n}</option>`).join("")}</select></label>
    <div class="dlg-actions"><button class="btn" data-act="close">Abbrechen</button><button class="btn primary" data-act="quicksave">${entry ? "Speichern" : "Hinzufügen"}</button></div>
    ${entry ? `<button class="btn destructive" data-act="qdel" style="margin-top:10px">Eintrag löschen</button>` : ""}`, "#q-kcal");
}
function saveQuick() {
  const kcal = num($("#q-kcal").value), p = num($("#q-p").value), c = num($("#q-c").value), f = num($("#q-f").value);
  if (kcal <= 0 || kcal > 9000) return dlgError("Bitte gib eine Energiemenge zwischen 1 und 9000 kcal ein.");
  if (p < 0 || c < 0 || f < 0 || p > 1000 || c > 1000 || f > 1000) return dlgError("Bitte prüfe Protein, Kohlenhydrate und Fett.");
  const name = $("#q-name").value.trim().slice(0, 120) || "Schnell-Eintrag", meal = $("#q-meal").value;
  const per100 = {kcal: kcal / 10, p: p / 10, c: c / 10, f: f / 10};
  if (ui.fquickEdit) Object.assign(ui.fquickEdit, {name, meal, per100});
  else D().food.push({id: St.uid(), date: ui.fday || dkey(), meal, foodId: null, name, brand: "", per100, grams: 1000, quick: true});
  persist(); ui.fmeal = meal; opener = null; closeDialog(); if (location.hash.startsWith("#/ernaehrung")) rerender(); else go("#/ernaehrung");
  say(`${name}, ${r0(kcal)} kcal eingetragen.`);
}
function saveAmount() {
  const g = num($("#fgrams").value);
  if (g <= 0 || g > 5000) return dlgError("Bitte gib eine Menge zwischen 1 und 5000 g ein.");
  const {food, entry} = ui.famount, meal = $("#fmealsel").value;
  if (!food.id) { food.id = "f_" + St.uid(); }
  if (!D().foods[food.id]) D().foods[food.id] = {...food};          // Online-Treffer lokal merken, damit sie offline wieder auftauchen
  if (entry) Object.assign(entry, {grams: g, meal, name: food.name, brand: food.brand || "", per100: {...food.per100}});
  else D().food.push({id: St.uid(), date: ui.fday || dkey(), meal, foodId: food.id, name: food.name, brand: food.brand || "", per100: {...food.per100}, grams: g});
  persist(); ui.fmeal = meal; closeDialog(); if (location.hash.startsWith("#/ernaehrung")) rerender(); else go("#/ernaehrung");
  say(`${food.name}, ${r0(g)} g ${entry ? "geändert" : "eingetragen"}.`);
}

/* ---------- Eigenes Lebensmittel ---------- */
function openFoodForm(pre = {}, note = "") {
  ui.fentry = null;
  ui.fedit = pre.id && D().foods[pre.id] ? pre.id : null; ui.fwarned = false; ui.fbarcode = pre.barcode || "";
  const v = k => pre.per100 && pre.per100[k] != null ? fmt(Math.round(pre.per100[k] * 10) / 10) : "";
  const fld = (id, label, val) => `<label class="field">${label} <input id="${id}" inputmode="decimal" autocomplete="off" value="${val}"></label>`;
  openDialog(`<h2 id="dlg-h">${ui.fedit ? "Lebensmittel bearbeiten" : "Neues Lebensmittel"}</h2>
    ${note ? `<p class="note">${esc(note)}</p>` : ""}
    <p class="err" role="alert" hidden></p>
    <label class="field">Name <input id="fn-name" autocomplete="off" value="${esc(pre.name || "")}"></label>
    <label class="field">Marke <small style="display:inline">(optional)</small><input id="fn-brand" autocomplete="off" value="${esc(pre.brand || "")}"></label>
    <p class="meta" style="margin:-4px 0 10px">Nährwerte pro 100 g, wie auf der Verpackung</p>
    <div class="pair">${fld("fn-kcal", "Energie (kcal)", v("kcal"))}${fld("fn-p", "Protein (g)", v("p"))}</div>
    <div class="pair">${fld("fn-c", "Kohlenhydrate (g)", v("c"))}${fld("fn-f", "Fett (g)", v("f"))}</div>
    ${fld("fn-serv", "Portion in g (optional)", pre.serving ? fmt(pre.serving) : "")}
    ${ui.fbarcode ? `<p class="meta">Barcode: ${esc(ui.fbarcode)}</p>` : ""}
    <div class="dlg-actions"><button class="btn" data-act="close">Abbrechen</button><button class="btn primary" data-act="foodsave">Speichern</button></div>
    ${ui.fedit ? `<button class="btn destructive" data-act="fooddel" style="margin-top:10px">Lebensmittel löschen</button>` : ""}`, "#fn-name");
}
function saveFood() {
  const name = $("#fn-name").value.trim();
  if (!name) return dlgError("Bitte gib dem Lebensmittel einen Namen.");
  const per100 = {kcal: num($("#fn-kcal").value), p: num($("#fn-p").value), c: num($("#fn-c").value), f: num($("#fn-f").value)};
  if (per100.kcal <= 0 || per100.kcal > 900) return dlgError("Energie pro 100 g muss zwischen 1 und 900 kcal liegen (reines Fett hat etwa 900).");
  if (per100.p + per100.c + per100.f > 100) return dlgError("Protein, Kohlenhydrate und Fett ergeben zusammen mehr als 100 g pro 100 g. Bitte prüfen.");
  // Plausibilität nach Atwater (4/4/9 kcal pro g). Ballaststoffe und Alkohol erklären kleine Abweichungen.
  const calc = N.atwater(per100);
  if (!ui.fwarned && Math.abs(calc - per100.kcal) > Math.max(25, per100.kcal * 0.2)) {
    ui.fwarned = true;
    return dlgError(`Aus den Makros ergeben sich etwa ${r0(calc)} kcal, eingetragen sind ${r0(per100.kcal)}. Tippfehler? Zum Speichern trotzdem nochmal tippen.`);
  }
  const food = {id: ui.fedit || "f_" + St.uid(), name, brand: $("#fn-brand").value.trim(), barcode: ui.fbarcode, per100, serving: num($("#fn-serv").value), source: "own"};
  D().foods[food.id] = food; persist(); say(`${name} gespeichert.`);
  // Kam die Bearbeitung aus einem Tagebuch-Eintrag, wird genau dieser Eintrag korrigiert statt ein zweiter angelegt.
  openAmount(food, ui.fentry || undefined); ui.fentry = null;
}

/* ---------- Ziele & Quellen ---------- */
function openGoals() {
  const pr = D().profile, kg = St.currentWeight(), miss = N.missing(pr, kg), t = N.computeTargets(pr, kg);
  const seg = `<div class="seg" role="group" aria-label="Art des Ziels" style="margin-bottom:16px">
    <button type="button" data-act="gmode" data-v="0" aria-pressed="${!pr.manual}">Nach Literatur</button>
    <button type="button" data-act="gmode" data-v="1" aria-pressed="${!!pr.manual}">Selbst festlegen</button></div>`;
  const goalSeg = `<div class="seg" role="group" aria-label="Ziel" style="margin-bottom:12px">${Object.entries(N.GOALS).map(([id, g]) => `<button type="button" data-act="pgoal" data-v="${id}" aria-pressed="${pr.goal === id}">${g.l}</button>`).join("")}</div>`;
  let body;
  if (pr.manual) {
    const fld = (id, label, val) => `<label class="field">${label} <input id="${id}" inputmode="decimal" autocomplete="off" value="${val || ""}"></label>`;
    body = `<p class="err" role="alert" hidden></p>
      ${fld("g-kcal", "Energie (kcal pro Tag)", pr.kcal)}
      <div class="pair">${fld("g-p", "Protein (g)", pr.p)}${fld("g-c", "Kohlenhydrate (g)", pr.c)}</div>${fld("g-f", "Fett (g)", pr.f)}
      ${t && !t.blocked ? `<p class="meta">Zum Vergleich, nach Literatur berechnet: ${r0(t.kcal)} kcal, ${t.p} g Protein, ${t.c} g Kohlenhydrate, ${t.f} g Fett.</p>` : ""}
      <div class="dlg-actions"><button class="btn" data-act="close">Abbrechen</button><button class="btn primary" data-act="goalsave">Speichern</button></div>`;
  } else if (t && t.blocked) {
    body = `<p class="note">SATZ berechnet Ziele erst ab ${N.MIN_AGE} Jahren. Die Formel ist für Erwachsene entwickelt, und im Wachstum ist ein Defizit riskant. Sprich mit deiner Ärztin, deinem Arzt oder einer Ernährungsberatung.</p>
      <button class="btn" data-act="close">Schließen</button>`;
  } else if (!t) {
    body = `<p>Für die Berechnung fehlt noch: <b>${miss.join(", ")}</b>.</p>
      <a class="btn primary" href="#/mehr">Persönliche Daten eintragen</a>`;
  } else {
    const s = t.steps, g = s.goal, sexTxt = pr.sex === "m" ? "+ 5 (Männer)" : pr.sex === "w" ? "− 161 (Frauen)" : "− 78 (Mittelwert, keine Angabe)";
    body = `${goalSeg}${t.warnings.map(w => `<p class="note">${esc(w)}</p>`).join("")}<p class="meta">${esc(g.why)}</p>
      <ol class="steps">
        <li>Grundumsatz nach Mifflin-St Jeor: 10 × ${fmt(s.kg)} kg + 6,25 × ${fmt(pr.height)} cm − 5 × ${s.years} Jahre ${sexTxt} = <b>${r0(s.bmr)} kcal</b></li>
        ${s.adj ? `<li>Gesamtbedarf aus deinen eigenen Daten (Essen und Gewichtstrend, Stand ${shortDate(s.adj.date + "T12:00:00")}): <b>${r0(s.tdee)} kcal</b>. Die Formel ergäbe ${r0(Math.round(s.bmr * s.pal / 10) * 10)} kcal. <button type="button" class="linkbtn" data-act="adaptoff">Wieder die Formel nutzen</button></li>`
          : `<li>× Aktivitätsfaktor (PAL) ${fmt(s.pal)} = <b>${r0(s.tdee)} kcal</b> Gesamtbedarf</li>`}
        <li>Ziel „${g.l}“: ${g.rate ? `${g.rate > 0 ? "+" : "−"}${fmt(Math.abs(g.rate) * 100)} % Körpergewicht pro Woche × 7700 kcal/kg ÷ 7 = <b>${s.delta > 0 ? "+" : "−"}${r0(Math.abs(s.delta))} kcal</b> pro Tag` : "<b>± 0 kcal</b>"}</li>
        <li>Tagesziel (gerundet): <b>${r0(t.kcal)} kcal</b></li>
        <li>Protein: ${fmt(g.protein)} g × ${fmt(s.kg)} kg = <b>${t.p} g</b></li>
        <li>Fett: 25 % der Energie ÷ 9 kcal/g, mindestens 0,6 g/kg = <b>${t.f} g</b></li>
        <li>Kohlenhydrate: der Rest ÷ 4 kcal/g = <b>${t.c} g</b></li>
      </ol>
      <p class="meta">Das sind Schätzwerte für gesunde Erwachsene. Die Formel liegt bei den meisten Menschen innerhalb von ±10 % (Frankenfield et al. 2005). Beobachte dein Gewicht 2–3 Wochen und passe dann an. Kein Ersatz für ärztliche oder ernährungsberaterische Beratung, etwa bei Schwangerschaft oder Essstörungen.</p>
      <button class="btn" data-act="close">Fertig</button>`;
  }
  openDialog(`<h2 id="dlg-h">Ziele &amp; Quellen</h2>${seg}${body}
    <h3 style="margin:20px 0 8px">Quellen</h3>
    <ol class="sources">${N.SOURCES.map(([a, t2, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(a)}</a>: ${esc(t2)}</li>`).join("")}</ol>`, pr.manual ? "#g-kcal" : null);
}
function saveGoals() {
  const v = {kcal: Math.round(num($("#g-kcal").value)), p: Math.round(num($("#g-p").value)), c: Math.round(num($("#g-c").value)), f: Math.round(num($("#g-f").value))};
  if (v.kcal < 800 || v.kcal > 8000) return dlgError("Bitte gib eine Energiemenge zwischen 800 und 8000 kcal ein.");
  const kg = St.currentWeight();
  if (!ui.gwarned2 && (v.kcal < N.MIN_KCAL || (kg && v.f && v.f < kg * N.MIN_FAT_PER_KG))) { ui.gwarned2 = true; return dlgError(`Unter ${N.MIN_KCAL} kcal oder unter ${fmt(N.MIN_FAT_PER_KG)} g Fett pro kg ist für die meisten Erwachsenen zu wenig und sollte ärztlich begleitet sein. Zum Speichern trotzdem nochmal tippen.`); }
  const macro = v.p * 4 + v.c * 4 + v.f * 9;
  if (macro && Math.abs(macro - v.kcal) > v.kcal * 0.1 && !ui.gwarned) { ui.gwarned = true; return dlgError(`Die Makros ergeben ${r0(macro)} kcal, das Ziel sind ${r0(v.kcal)} kcal. Zum Speichern trotzdem nochmal tippen.`); }
  Object.assign(D().profile, v, {manual: true}); persist(); closeDialog(); rerender(); toast("Eigenes Ziel gespeichert.");
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
  openDialog(`<h2 id="dlg-h">Barcode scannen</h2>
    <div class="scanbox"><video id="scanv" playsinline muted autoplay aria-label="Kamerabild"></video></div>
    <p class="meta" id="scanst" role="status">Kamera wird gestartet …</p>
    <div class="inline"><label class="field">Oder Nummer eingeben <input id="bc" inputmode="numeric" autocomplete="off" pattern="[0-9]*"></label><button class="btn" data-act="bclookup">Suchen</button></div>
    <button class="btn" data-act="close">Abbrechen</button>`, "h2");
  const video = $("#scanv");
  if (!navigator.mediaDevices?.getUserMedia) { scanStatus("Dieses Gerät erlaubt hier keinen Kamerazugriff. Gib die Nummer unter dem Barcode ein."); return; }
  const constraints = {video: {facingMode: {ideal: "environment"}, width: {ideal: 1280}, height: {ideal: 720}}, audio: false};
  try {
    let native = false;
    if ("BarcodeDetector" in window) { try { native = (await BarcodeDetector.getSupportedFormats()).includes("ean_13"); } catch (e) {} }
    if (native) {
      scan.stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!dlg.open) return stopScanner();
      video.srcObject = scan.stream; await video.play().catch(() => {});
      const det = new BarcodeDetector({formats: ["ean_13", "ean_8", "upc_a", "upc_e"]});
      scanStatus("Halte den Barcode in den Rahmen.");
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
      scanStatus("Halte den Barcode in den Rahmen.");
      await scan.reader.decodeFromConstraints(constraints, video, res => { if (res && scan.reader) found(res.getText()); });
      scan.stream = video.srcObject;
    }
  } catch (e) {
    stopScanner();
    scanStatus(e && e.name === "NotAllowedError"
      ? "Kein Kamerazugriff erlaubt. Du kannst ihn in den iPhone-Einstellungen erlauben oder die Nummer unter dem Barcode eingeben."
      : "Die Kamera ließ sich nicht starten. Gib die Nummer unter dem Barcode ein.");
  }
}
function found(code) {
  if (scan.busy) return; scan.busy = true;
  if (navigator.vibrate) navigator.vibrate(30);
  stopScanner(); lookupBarcode(code);
}
async function lookupBarcode(code) {
  code = String(code).replace(/\D/g, "");
  if (code.length < 8) { scan.busy = false; return scanStatus("Ein Barcode hat 8 bis 13 Ziffern."); }
  const local = Object.values(D().foods).find(f => f.barcode === code);
  if (local) return openAmount(local);
  scanStatus(`Barcode ${code}: suche bei Open Food Facts …`);
  try {
    const p = await N.offProduct(code);
    if (!dlg.open) return;
    if (p) openAmount(p);
    else openFoodForm({barcode: code}, `Barcode ${code} ist bei Open Food Facts nicht eingetragen. Leg das Lebensmittel mit den Werten von der Verpackung an. Beim nächsten Scan findet SATZ es dann.`);
  } catch (e) {
    openFoodForm({barcode: code}, "Open Food Facts ist gerade nicht erreichbar. Trag die Werte von der Verpackung ein.");
  }
}

/* ---------- Persönliche Daten (Mehr) ---------- */
function profileSection() {
  const pr = D().profile, kg = St.currentWeight(), years = N.age(pr.birth), lastW = D().weights[D().weights.length - 1];
  return `<h2 class="sec" style="margin-top:4px">Persönliche Daten</h2>
    <div class="pair">
      <label class="field">Geburtsdatum <input type="date" data-on="pbirth" value="${esc(pr.birth)}" max="${dkey()}" min="1900-01-01"></label>
      <div class="field">Alter <span class="exsel" style="min-height:48px" id="p-age" aria-live="polite">${years != null ? `${years} Jahre` : "–"}</span></div>
    </div>
    <div class="pair">
      <label class="field">Größe (cm) <input data-on="pheight" inputmode="decimal" autocomplete="off" value="${pr.height || ""}"></label>
      <label class="field">Gewicht (kg) <input data-on="pweight" inputmode="decimal" autocomplete="off" value="${kg ? fmt(kg) : ""}"></label>
    </div>
    <label class="field">Geschlecht <small style="display:inline">(für die Grundumsatz-Formel)</small><select data-on="psex">
      ${[["", "Bitte wählen"], ["m", "Männlich"], ["w", "Weiblich"], ["x", "Keine Angabe (Mittelwert)"]].map(([v, l]) => `<option value="${v}" ${pr.sex === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <label class="field">Aktivität im Alltag <select data-on="ppal">${N.PAL.map(a => `<option value="${a.v}" ${pr.pal === a.v ? "selected" : ""}>${a.l}: ${a.d}</option>`).join("")}</select></label>
    <div class="field" style="margin-bottom:8px"><span id="l-goal">Ziel</span>
      <div class="seg" role="group" aria-labelledby="l-goal" style="margin-top:6px">${Object.entries(N.GOALS).map(([id, g]) => `<button type="button" data-act="pgoal" data-v="${id}" aria-pressed="${pr.goal === id}">${g.l}</button>`).join("")}</div></div>
    <p class="foot">${lastW ? `Gewicht zuletzt eingetragen am ${new Date(lastW.date + "T12:00:00").toLocaleDateString("de-DE")}. ` : ""}Das Alter rechnet sich an deinem Geburtstag automatisch hoch. Die Angaben bleiben auf diesem Gerät und dienen nur der Berechnung deines Bedarfs unter Ernährung.</p>`;
}
function accentRow() {
  const s = D().settings, dark = isDark();
  return `<div class="row stack"><span id="l-acc">Akzentfarbe</span>
    <div class="swatches" role="group" aria-labelledby="l-acc">${ACCENTS.map(([id, l, c1, c2]) => `<button type="button" data-act="set" data-k="accent" data-v="${id}" aria-pressed="${s.accent === id}"><i style="background:${dark ? c2 : c1}"></i>${l}</button>`).join("")}</div></div>`;
}

Object.assign(A, {
  fday: t => { ui.fday = shiftDay(ui.fday || dkey(), +t.dataset.d); if (ui.fday > dkey()) ui.fday = dkey(); rerender(`[data-act="fday"][data-d="${t.dataset.d}"]:not(:disabled)`); },
  fadd: t => openFoodAdd(t.dataset.m),
  fedit: t => { const e = D().food.find(x => x.id === t.dataset.id); if (e && e.quick) return openQuick(e); if (e) openAmount(D().foods[e.foodId] ? {...D().foods[e.foodId], per100: e.per100} : {name: e.name, brand: e.brand, per100: e.per100}, e); },
  qdel: () => {
    const e = ui.fquickEdit, snap = St.snapshot();
    D().food = D().food.filter(x => x.id !== e.id); persist(); opener = null; closeDialog(); rerender(); view.querySelector("h1").focus();
    toast(`${e.name} gelöscht.`, () => { St.restore(snap); rerender(); });
  },
  fdel: () => {
    const e = ui.famount.entry, snap = St.snapshot();
    D().food = D().food.filter(x => x.id !== e.id); persist(); opener = null; closeDialog(); rerender(); view.querySelector("h1").focus();
    toast(`${e.name} gelöscht.`, () => { St.restore(snap); rerender(); });
  },
  pickfood: t => openAmount(ui.fcands[+t.dataset.i]),
  fgset: t => { $("#fgrams").value = fmt(+t.dataset.g); syncPort(); updatePreview(); },
  ffav: t => {
    const food = ui.famount.food;
    if (!food.id) food.id = "f_" + St.uid();
    if (!D().foods[food.id]) D().foods[food.id] = {...food};
    const f = D().foods[food.id]; if (f.fav) delete f.fav; else f.fav = true; persist();
    t.setAttribute("aria-pressed", String(!!f.fav)); t.innerHTML = `<span aria-hidden="true">${f.fav ? "★" : "☆"}</span> ${f.fav ? "Favorit" : "Als Favorit merken"}`;
    say(f.fav ? `${f.name} ist jetzt Favorit.` : `${f.name} ist kein Favorit mehr.`);
  },
  fcopyprev: t => {
    const k = ui.fday || dkey(), m = t.dataset.m, prev = D().food.filter(e => e.date === shiftDay(k, -1) && (!m || e.meal === m)), snap = St.snapshot();
    prev.forEach(e => D().food.push({...e, per100: {...e.per100}, id: St.uid(), date: k}));
    persist(); rerender(); view.querySelector("h1").focus();
    toast(`${prev.length} ${prev.length === 1 ? "Eintrag" : "Einträge"} vom Vortag übernommen.`, () => { St.restore(snap); rerender(); });
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
    toast(`${f.name} gelöscht. Einträge im Tagebuch bleiben.`, () => { St.restore(snap); rerender(); });
  },
  offsearch: async () => {
    const q = ui.fq.trim(); ui.foffState = "loading"; renderFoodResults();
    try { ui.foff = (await N.offSearch(q)).slice(0, 20); ui.foffState = ""; } catch (e) { ui.foff = null; ui.foffState = "error"; }
    if (ui.fq.trim() === q) { renderFoodResults(); say(ui.foff ? `${ui.foff.length} Treffer bei Open Food Facts.` : "Suche fehlgeschlagen."); }
  },
  scan: () => openScanner(),
  bclookup: () => { stopScanner(); scan.busy = true; lookupBarcode($("#bc").value); },
  adapt: t => {
    const pr = D().profile, snap = St.snapshot();
    pr.tdeeAdj = {tdee: +t.dataset.v, date: dkey(), days: +t.dataset.n}; pr.manual = false;
    persist(); rerender(); toast(`Neues Ziel: ${r0(targets().kcal)} kcal pro Tag.`, () => { St.restore(snap); rerender(); });
  },
  adaptoff: () => { const snap = St.snapshot(); delete D().profile.tdeeAdj; persist(); openGoals(); rerender(); toast("Ziel wieder nach Formel.", () => { St.restore(snap); rerender(); }); },
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
  queueMicrotask(() => { if (!hadT && targets() && location.hash.startsWith("#/ernaehrung")) { rerender(); say("Dein Bedarf ist jetzt berechnet."); } });
  if (k === "pbirth") { pr.birth = el.value; const y = N.age(pr.birth); $("#p-age").textContent = y != null ? `${y} Jahre` : "–"; }
  if (k === "psex") pr.sex = el.value;
  if (k === "ppal") pr.pal = +el.value;
  if (k === "pheight") { const v = num(el.value); if (v && (v < 100 || v > 250)) { toast("Größe bitte in Zentimetern, zwischen 100 und 250."); el.value = pr.height || ""; return; } pr.height = v; }
  if (k === "pweight") {
    const v = Math.round(num(el.value) * 10) / 10;
    if (v && (v < 30 || v > 300)) { toast("Gewicht bitte in Kilogramm, zwischen 30 und 300."); el.value = St.currentWeight() ? fmt(St.currentWeight()) : ""; return; }
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
St.load(APP_VERSION);
applySettings();
// Ladebildschirm: 2 s mit Balken und Version, nur beim ersten Start nach dem Schließen der App.
// Zurückkehren aus dem Hintergrund lädt die Seite nicht neu; Neuladen in derselben Sitzung (Update) merkt sich sessionStorage.
(() => {
  const sp = $("#splash"); if (!sp) return;
  let seen = false; try { seen = sessionStorage.getItem("satz-splash") === "1"; sessionStorage.setItem("satz-splash", "1"); } catch (e) {}
  if (seen) { sp.remove(); return; }
  $("#splashVer").textContent = `Version ${APP_VERSION}`;
  sp.setAttribute("aria-label", `SATZ wird geladen, Version ${APP_VERSION}`);
  const hide = () => { if (sp.classList.contains("out")) return; sp.classList.add("out"); setTimeout(() => sp.remove(), 350); };
  if (D().active) { sp.remove(); return; }
  sp.addEventListener("click", hide);
  setTimeout(hide, 2000);
})();
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
