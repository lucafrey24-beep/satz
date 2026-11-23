import * as St from "./store.js";
import {MUSCLES, MUSCLE_NAME, TEMPLATES} from "./data.js";
import * as N from "./nutrition.js";

/* ============ Hilfen ============ */
const $ = s => document.querySelector(s);
const view = $("#view"), dlg = $("#dlg"), tabs = $("#tabs"), bar = $("#appbar");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
const D = () => St.S;
const ui = {day: null, eday: 0, summary: false, key: "", kg: 0, reps: 8, rir: null, draft: null, draftNew: false, pq: "", pm: "", exq: "", histEx: ""};
const fmt = St.fmt;
const scheme = sl => `${sl.sets}×${sl.min}–${sl.max}`;
const schemeSr = sl => `${sl.sets} Sätze, ${sl.min} bis ${sl.max} Wiederholungen`;
const dateDe = iso => new Date(iso).toLocaleDateString("de-DE", {weekday: "short", day: "numeric", month: "numeric"});
const muscleList = e => [...e.primary.map(m => MUSCLE_NAME[m]), ...e.secondary.map(m => MUSCLE_NAME[m] + " (mit)")].join(", ");

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
}

/* ============ Router ============ */
const ROUTES = {heute: viewToday, plaene: viewPlans, vorlage: viewTemplate, plan: viewEditor, uebungen: viewExercises, verlauf: viewHistory, ernaehrung: viewNutrition, mehr: viewMore, training: viewTraining};
function route() {
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  let name = parts[0] || "heute";
  if (D().active && name !== "training") { location.replace("#/training"); return; }
  if (!D().active && name === "training") { location.replace("#/heute"); return; }
  if (!ROUTES[name]) name = "heute";
  const training = name === "training";
  tabs.hidden = training;
  view.classList.toggle("modal", training);
  tabs.querySelectorAll("a").forEach(a => a.dataset.tab === tabFor(name) ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  placePill(tabFor(name));
  updateWakeLock();
  renderBar(training, name);
  if (dlg.open) dlg.close();
  ROUTES[name](parts[1]);
  view.scrollTop = 0;
  const h = view.querySelector("h1");
  if (h) { h.tabIndex = -1; h.focus({preventScroll: true}); }
  document.title = (h ? h.textContent.replace(/\s+/g, " ").trim() + " · " : "") + "SATZ";
}
const tabFor = n => ({vorlage: "plaene", plan: "plaene", uebungen: "plaene"})[n] || n;
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
function rerender(focusSel) {
  const top = view.scrollTop;
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  (ROUTES[parts[0]] || viewToday)(parts[1]);
  view.scrollTop = top;
  if (focusSel) { const f = view.querySelector(focusSel); if (f) f.focus({preventScroll: false}); }
}
const BACK = {vorlage: ["#/plaene", "Pläne"], plan: ["#/plaene", "Pläne"], uebungen: ["#/plaene", "Pläne"]};
function renderBar(training, name) {
  const a = D().active, back = BACK[name];
  bar.classList.remove("titled");
  bar.innerHTML = training && a
    ? `<button class="navbtn" data-act="end">Beenden</button><span class="ctx">${esc(a.dayName)}</span>
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
    <p class="meta">${t.level} · ${t.days.length} ${t.days.length === 1 ? "Tag" : "Tage"} · ${t.perWeek}× pro Woche</p>
    ${compact ? "" : `<p>${esc(t.desc)}</p>`}
    <div class="row-btns"><a class="btn small" href="#/vorlage/${t.id}">Ansehen</a>
      <button class="btn small primary" data-act="adopt" data-id="${t.id}">Übernehmen</button></div>
  </article>`;
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
      ${TEMPLATES.map(t => templateCard(t)).join("")}
      ${emptyPlanBtn()}<div style="height:24px"></div>`;
    return;
  }
  if (!p.days.length) {
    view.innerHTML = `<p class="eyebrow">Plan: ${esc(p.name)}</p><h1 class="big">Noch leer</h1><p>Leg den ersten Trainingstag an.</p>
      <a class="btn primary" href="#/plan/${p.id}">Plan bearbeiten</a>`;
    return;
  }
  const di = ui.day != null && ui.day < p.days.length ? ui.day : St.nextDayIndex(p);
  const d = p.days[di], sets = d.slots.reduce((a, s) => a + s.sets, 0);
  const mins = Math.round(d.slots.reduce((a, s) => a + s.sets * (St.restFor(s) + 45), 0) / 60);
  const last = St.lastSession(), gap = last ? St.daysSince(last.date) : null;
  const week = D().sessions.filter(s => St.daysSince(s.date) < 7).length;
  view.innerHTML = `
    <p class="eyebrow">Plan: ${esc(p.name)}</p>
    <h1 class="big">${di === St.nextDayIndex(p) ? "Heute:<br>" : ""}${esc(d.name)}</h1>
    ${gap != null && gap > 14 ? `<p class="note">Willkommen zurück. Dein letztes Training ist ${gap} Tage her. Die Vorschläge starten heute etwas leichter.</p>` : ""}
    <p class="meta">Letzte 7 Tage: ${week} von ${p.perWeek} geplanten Trainings.</p>
    ${backupDue() ? `<div class="note"><b>Zeit für eine Sicherung.</b> ${D().settings.lastBackup ? `Die letzte ist ${St.daysSince(D().settings.lastBackup)} Tage alt.` : "Du hast noch keine."} Deine Trainings liegen nur auf diesem Gerät.
      <div class="row-btns"><button class="btn small primary" data-act="export">Jetzt sichern</button><button class="btn small" data-act="snoozebackup">Später</button></div></div>` : ""}
    ${p.days.length > 1 ? dayBar(p, di, "pickday", "Trainingstag wählen") : ""}
    <p class="meta">${d.slots.length} Übungen · ${sets} Sätze · ca. ${mins} Min.</p>
    <ol class="exlist" aria-label="Übungen">
      ${d.slots.map(sl => { const e = St.ex(sl.exId), l = St.lastSetsFor(sl.exId);
        return `<li><span class="t">${esc(e.name)}</span><span class="s"><span aria-hidden="true">${scheme(sl)}</span><span class="sr">${schemeSr(sl)}</span></span>
        ${l ? `<span class="l">Zuletzt: ${St.fmtW(e, Math.max(...l.sets.map(x => x.kg)))}, ${l.sets.map(x => x.reps).join(" + ")} Wdh.</span>` : ""}</li>`; }).join("")}
    </ol>
    ${d.slots.length ? `<div class="actionbar"><button class="btn primary" data-act="start" data-i="${di}">Training starten</button></div>`
      : `<p class="meta">Dieser Tag hat noch keine Übungen.</p><a class="btn" href="#/plan/${p.id}">Plan bearbeiten</a>`}`;
}

/* ============ Pläne ============ */
function viewPlans() {
  const s = D(), customN = Object.values(s.exercises).filter(e => e.custom).length;
  view.innerHTML = `<h1 class="big">Pläne</h1>
    ${s.plans.length ? s.plans.map(p => `<article class="card" aria-labelledby="p-${p.id}">
      <h3 id="p-${p.id}">${esc(p.name)}${p.id === s.activePlanId ? `<span class="badge">aktiv</span>` : ""}</h3>
      <p class="meta">${p.days.length} ${p.days.length === 1 ? "Tag" : "Tage"} · ${p.perWeek}× pro Woche</p>
      <div class="row-btns">
        ${p.id !== s.activePlanId ? `<button class="btn small primary" data-act="activate" data-id="${p.id}">Aktivieren</button>` : ""}
        <a class="btn small" href="#/plan/${p.id}" aria-label="${esc(p.name)} bearbeiten">Bearbeiten</a>
        <button class="btn small" data-act="copyplan" data-id="${p.id}" aria-label="${esc(p.name)} kopieren">Kopieren</button>
        <button class="btn small destructive" data-act="delplan" data-id="${p.id}" aria-label="${esc(p.name)} löschen">Löschen</button>
      </div></article>`).join("") : `<p>Noch kein eigener Plan.</p>`}
    ${emptyPlanBtn()}
    <h2 class="sec">Fertige Pläne</h2>
    <p class="meta">Nach Trainingswissenschaft zusammengestellt. Übernehmen erstellt eine Kopie, die du frei ändern kannst.</p>
    ${TEMPLATES.map(t => templateCard(t, true)).join("")}
    <h2 class="sec">Übungen</h2>
    <p class="meta">${Object.keys(s.exercises).length} Übungen, davon ${customN} eigene.</p>
    <a class="btn" href="#/uebungen">Übungen verwalten</a><div style="height:24px"></div>`;
}

function viewTemplate(id) {
  const t = TEMPLATES.find(x => x.id === id);
  if (!t) return go("#/plaene");
  const p = St.instantiate(t);
  view.innerHTML = `<p class="eyebrow">Fertiger Plan · ${t.level}</p><h1 class="big">${esc(t.name)}</h1>
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
    <h2 class="sec">Wochenvolumen</h2>
    <p>${low.length ? `Unter 10 Sätzen pro Woche: <b>${low.join(", ")}</b>. Mehr Sätze, mehr Trainings pro Woche oder eine zusätzliche Übung heben das an.` : "Alle großen Muskelgruppen liegen bei mindestens 10 Sätzen pro Woche."}</p>
    <details><summary>Tabelle: Sätze pro Muskel und Woche</summary>${volumeTable(v, "Sätze pro Muskel und Woche")}</details>
    <div class="actionbar"><a class="btn primary" href="#/plaene">Fertig</a></div>`;
}
const curPlan = () => St.plan(location.hash.split("/")[2]);

/* ---------- Slot-Dialog ---------- */
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
        ${[0, 60, 90, 120, 150, 180, 240].map(r => `<option value="${r}" ${sl.rest === r ? "selected" : ""}>${r ? r + " s" : "Standard"}</option>`).join("")}
      </select></label></div>
    <fieldset><legend>Wiederholungen</legend><div class="pair">
      <label class="field">von <input id="f-min" type="number" inputmode="numeric" min="1" max="50" value="${sl.min}"></label>
      <label class="field">bis <input id="f-max" type="number" inputmode="numeric" min="1" max="50" value="${sl.max}"></label></div></fieldset>
    <div class="dlg-actions"><button class="btn" data-act="close">Abbrechen</button><button class="btn primary" data-act="slotsave">Speichern</button></div>`,
    ui.draftNew ? "#f-sets" : "#dlg-h");
}
function saveSlot() {
  const sets = +$("#f-sets").value, min = +$("#f-min").value, max = +$("#f-max").value, rest = +$("#f-rest").value;
  if (!(sets >= 1 && sets <= 10)) return dlgError("Sätze: bitte eine Zahl von 1 bis 10.");
  if (!(min >= 1 && max <= 50 && min <= max)) return dlgError("Wiederholungen: „von“ muss zwischen 1 und „bis“ liegen, „bis“ höchstens 50.");
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
function openPicker(cb) {
  pickCb = cb; ui.pq = ""; ui.pm = "";
  openDialog(`<h2 id="dlg-h">Übung wählen</h2>
    <label class="field">Suchen oder eigenen Namen eingeben <input id="pq" type="search" data-on="pq" autocomplete="off" enterkeyhint="search"></label>
    <label class="field">Muskel <select data-on="pm"><option value="">Alle Muskeln</option>${MUSCLES.map(m => `<option value="${m.id}">${m.name}</option>`).join("")}</select></label>
    <div id="pres"></div>
    <button class="btn" data-act="close">Abbrechen</button>`, "#pq");
  renderPickList();
}
function renderPickList() {
  const q = ui.pq.trim().toLowerCase();
  const list = Object.values(D().exercises)
    .filter(e => !e.archived && (!q || e.name.toLowerCase().includes(q)) && (!ui.pm || e.primary.includes(ui.pm) || e.secondary.includes(ui.pm)))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  const exact = list.some(e => e.name.toLowerCase() === q);
  $("#pres").innerHTML = `
    ${q && !exact ? `<button class="btn primary" data-act="newex" style="margin-bottom:12px">„${esc(ui.pq.trim())}“ als eigene Übung anlegen</button>` : ""}
    <p class="meta" aria-live="polite">${list.length} ${list.length === 1 ? "Treffer" : "Treffer"}</p>
    <ul class="plist">${list.map(e => `<li><button data-act="pick" data-id="${e.id}"><b>${esc(e.name)}${e.custom ? `<span class="badge">eigene</span>` : ""}</b><small>${esc(muscleList(e))}</small></button></li>`).join("")}</ul>`;
}

/* ---------- Übung anlegen / bearbeiten ---------- */
function openExForm(exId, name, after) {
  const e = exId ? St.ex(exId) : {name: name || "", primary: [ui.pm || "brust"], secondary: [], step: 2.5, unit: "kg", custom: true};
  const lockMuscles = e.primary.length > 1;
  const used = exId && D().plans.some(p => p.days.some(d => d.slots.some(s => s.exId === exId)));
  ui.exAfter = after; ui.exEdit = exId;
  openDialog(`<h2 id="dlg-h">${exId ? "Übung bearbeiten" : "Eigene Übung"}</h2>
    <p class="err" role="alert" hidden></p>
    <label class="field">Name <input id="x-name" value="${esc(e.name)}" autocomplete="off"></label>
    ${lockMuscles ? `<p class="meta">Muskeln: ${esc(muscleList(e))}. Bei dieser Übung sind sie fest hinterlegt.</p>` : `
    <label class="field">Hauptmuskel <select id="x-prim">${MUSCLES.map(m => `<option value="${m.id}" ${e.primary[0] === m.id ? "selected" : ""}>${m.name}</option>`).join("")}</select></label>
    <fieldset><legend>Mitarbeitende Muskeln (zählen als halber Satz)</legend><div class="checks">
      ${MUSCLES.map(m => `<label class="check"><input type="checkbox" name="x-sec" value="${m.id}" ${e.secondary.includes(m.id) ? "checked" : ""}>${m.name}</label>`).join("")}
    </div></fieldset>`}
    <div class="pair">
      <label class="field">Einheit <select id="x-unit"><option value="kg" ${e.unit === "kg" ? "selected" : ""}>Gewicht</option><option value="bw" ${e.unit === "bw" ? "selected" : ""}>Körpergewicht</option></select></label>
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
  const list = Object.values(D().exercises).filter(e => !e.archived && (!q || e.name.toLowerCase().includes(q))).sort((a, b) => (b.custom - a.custom) || a.name.localeCompare(b.name, "de"));
  view.innerHTML = `<p class="eyebrow"><a href="#/plaene">Pläne</a></p><h1 class="big">Übungen</h1>
    <p class="meta">Umbenennen und Tauschen lassen deinen Verlauf unverändert. Jede Übung behält ihre eigenen Sätze.</p>
    <button class="btn primary" data-act="newexlist">Eigene Übung anlegen</button>
    <label class="field" style="margin-top:14px">Suchen <input type="search" data-on="exq" value="${esc(ui.exq)}" autocomplete="off"></label>
    <ul class="plist" style="max-height:none">${list.map(e => `<li><button data-act="editex" data-id="${e.id}" aria-label="${esc(e.name)} bearbeiten"><b>${esc(e.name)}${e.custom ? `<span class="badge">eigene</span>` : ""}</b>
      <small>${esc(muscleList(e))} · ${St.setCount(e.id)} Sätze im Verlauf</small></button></li>`).join("")}</ul><div style="height:24px"></div>`;
}

/* ============ Training ============ */
function viewTraining() {
  const a = D().active;
  if (ui.summary || St.firstOpen(a, a.idx) < 0) return viewSummary();
  if (a.queue[a.idx].skipped || St.loggedFor(a, a.idx).length >= St.targetSets(a.queue[a.idx])) a.idx = St.firstOpen(a, a.idx);
  const i = a.idx, it = a.queue[i], e = St.ex(it.exId), logged = St.loggedFor(a, i), target = St.targetSets(it);
  const all = a.sets.filter(x => x.q === i);
  const sug = St.suggest(it), key = `${a.id}:${i}:${logged.length}`;
  if (ui.key !== key) {
    if (!ui.key.startsWith(`${a.id}:${i}:`)) ui.stype = "work";
    ui.key = key; ui.rir = null;
    const l = all[all.length - 1];
    if (l) { ui.kg = l.kg; ui.reps = l.reps; } else { ui.kg = sug.kg; ui.reps = sug.reps; }
  }
  const bw = e.unit === "bw", resting = a.restEnd > Date.now(), st = ui.stype || "work";
  const next = a.queue.findIndex((q, k) => k > i && !q.skipped && St.loggedFor(a, k).length < St.targetSets(q));
  const lastNote = [...D().sessions].reverse().find(x => x.notes && x.notes[it.exId]);
  const note = (a.notes || {})[it.exId];
  view.innerHTML = `
    <div class="progress" aria-hidden="true">${a.queue.map((q, k) => `<span class="${q.skipped ? "skip" : k === i ? "now" : St.loggedFor(a, k).length >= St.targetSets(q) ? "done" : ""}"></span>`).join("")}</div>
    <p class="eyebrow">Übung ${i + 1} von ${a.queue.length} · Satz ${logged.length + 1} von ${target} · Ziel ${it.min}–${it.max} Wdh.</p>
    <h1 class="big">${esc(e.name)}</h1>
    <p class="hint">${esc(sug.text)}${lastNote && !note ? `<br><b>Notiz vom ${dateDe(lastNote.date)}:</b> ${esc(lastNote.notes[it.exId])}` : ""}${note ? `<br><b>Notiz:</b> ${esc(note)}` : ""}</p>
    <div class="rest ${resting ? "on" : ""}" role="group" aria-label="Pause">
      <span class="eyebrow">${resting ? "Pause" : "Pause nach dem Satz"}</span>
      <div class="num" id="rt" aria-hidden="true">${resting ? restLeft() : fmtSec(st === "warm" ? 60 : st === "drop" ? 0 : it.rest)}</div>
      <div class="row-btns" ${resting ? "" : `style="visibility:hidden" aria-hidden="true"`}><button class="btn small" data-act="rest30" ${resting ? "" : "tabindex=-1"}>+30 s</button><button class="btn small" data-act="skiprest" ${resting ? "" : "tabindex=-1"}>Pause beenden</button></div></div>
    <div class="seg" role="group" aria-label="Satztyp" style="margin-bottom:10px">
      ${[["work", "Arbeitssatz"], ["warm", "Aufwärmen"], ["drop", "Drop-Satz"]].map(([v, l]) => `<button type="button" data-act="stype" data-v="${v}" aria-pressed="${st === v}">${l}</button>`).join("")}</div>
    <div class="stepper" role="group" aria-labelledby="kg-l">
      <button data-act="kg" data-d="-1" aria-label="Gewicht um ${fmt(e.step)} Kilo verringern">−</button>
      <div class="val"><input id="kgIn" class="v num" data-on="kgin" inputmode="decimal" autocomplete="off" enterkeyhint="done" value="${fmt(ui.kg)}" aria-describedby="kg-l"><label id="kg-l" for="kgIn" class="u">${bw ? "kg zusätzlich" : "kg"} · antippen zum Eintippen</label></div>
      <button data-act="kg" data-d="1" aria-label="Gewicht um ${fmt(e.step)} Kilo erhöhen">+</button></div>
    <div class="stepper" role="group" aria-labelledby="reps-l">
      <button data-act="reps" data-d="-1" aria-label="Eine Wiederholung weniger">−</button>
      <div class="val"><input id="repsIn" class="v num" data-on="repsin" inputmode="numeric" pattern="[0-9]*" autocomplete="off" enterkeyhint="done" value="${ui.reps}"><label id="reps-l" for="repsIn" class="u">Wiederholungen</label></div>
      <button data-act="reps" data-d="1" aria-label="Eine Wiederholung mehr">+</button></div>
    ${D().settings.rir && st !== "warm" ? `<fieldset><legend>Wie viele Wdh. wären noch gegangen? <span style="font-weight:500">(optional)</span></legend>
      <div class="rir">${[0, 1, 2, 3, 4].map(r => `<button type="button" data-act="rir" data-v="${r}" aria-pressed="${ui.rir === r}">${r === 4 ? "4+" : r}</button>`).join("")}</div></fieldset>` : ""}
    <div class="actionbar"><button class="btn primary" data-act="saveset" id="saveset">${st === "warm" ? "Aufwärmsatz speichern" : st === "drop" ? "Drop-Satz speichern" : `Satz ${logged.length + 1} speichern`}</button></div>
    ${all.length ? `<h2 class="sec" style="margin-top:8px">Eingetragen</h2><ul class="logged">${(() => { let n = 0; return all.map(l => { const lab = l.type === "warm" ? "Aufwärmen" : l.type === "drop" ? `Drop-Satz` : `Satz ${++n}`; return `<li><span>${lab}</span><span class="num">${St.fmtW(e, l.kg)} × ${l.reps}${l.rir != null ? ` · RIR ${l.rir === 4 ? "4+" : l.rir}` : ""}</span></li>`; }).join(""); })()}</ul>
      <button class="btn small" data-act="undoset" style="margin-top:8px">Letzten Satz löschen</button>` : ""}
    <div class="row-btns" style="margin-top:16px"><button class="btn small" data-act="extraset">+ Extra-Satz</button><button class="btn small" data-act="note" aria-haspopup="dialog">${note ? "Notiz ändern" : "Notiz"}</button><button class="btn small" data-act="skipex">Übung auslassen</button></div>
    <p class="meta" style="margin-top:12px">${next >= 0 ? `Danach: ${esc(St.ex(a.queue[next].exId).name)}` : "Das ist die letzte offene Übung."}</p>
    <div style="height:16px"></div>`;
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
  if (left > 0) { if (el) el.textContent = restLeft(); lastRestState = true; return; }
  a.restEnd = 0; persist();
  if (lastRestState) { say("Pause vorbei."); if (navigator.vibrate) navigator.vibrate([150, 80, 150]); }
  lastRestState = false;
  if (location.hash === "#/training" && !ui.summary && !dlg.open) rerender();
}, 1000);

/* ---------- Ton am Pausenende ----------
   iPhone-Safari kann nicht vibrieren. Darum plant SATZ beim Speichern (einem Tipp, also mit Erlaubnis zum Abspielen)
   einen kurzen Ton für das Pausenende vor. Der Ton wird im Audio-Takt geplant und kommt auch, wenn JavaScript gedrosselt ist. */
const beep = {ctx: null, nodes: []};
function cancelBeep() { beep.nodes.forEach(n => { try { n.stop(); } catch (e) {} }); beep.nodes = []; }
function scheduleBeep(sec) {
  cancelBeep();
  if (!D().settings.sound || sec <= 0) return;
  try {
    beep.ctx = beep.ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (beep.ctx.state === "suspended") beep.ctx.resume();
    const t0 = beep.ctx.currentTime + sec;
    [0, 0.25, 0.5].forEach((d, k) => {
      const o = beep.ctx.createOscillator(), g = beep.ctx.createGain();
      o.frequency.value = k === 2 ? 1320 : 880; o.type = "sine";
      g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.4, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.18);
      o.connect(g).connect(beep.ctx.destination); o.start(t0 + d); o.stop(t0 + d + 0.2); beep.nodes.push(o);
    });
  } catch (e) {}
}

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
}
function saveSet() {
  readSetInputs();
  const a = D().active, i = a.idx, it = a.queue[i], e = St.ex(it.exId), type = ui.stype || "work";
  a.sets.push({q: i, exId: it.exId, kg: ui.kg, reps: ui.reps, rir: type === "warm" ? null : ui.rir, t: Date.now(), ...(type !== "work" ? {type} : {})});
  const n = St.loggedFor(a, i).length, target = St.targetSets(it);
  let msg = `Gespeichert: ${type === "warm" ? "Aufwärmsatz, " : type === "drop" ? "Drop-Satz, " : ""}${St.fmtW(e, ui.kg)}, ${ui.reps} Wiederholungen.`;
  if (type === "work" && ui.reps < it.min) msg += ` Unter dem Ziel von ${it.min}.`;
  if (type === "drop") ui.stype = "work";
  const nextIdx = St.firstOpen(a, i);
  if (nextIdx < 0) { a.restEnd = 0; cancelBeep(); persist(); ui.summary = true; say(msg + " Alle Übungen erledigt."); rerender(); view.querySelector("h1").focus(); return; }
  const rest = type === "warm" ? 60 : type === "drop" ? 0 : it.rest;
  a.restEnd = rest ? Date.now() + rest * 1000 : 0; lastRestState = !!rest; scheduleBeep(rest);
  if (n >= target) { a.idx = nextIdx; msg += ` ${e.name} erledigt. Nächste Übung: ${St.ex(a.queue[nextIdx].exId).name}.`; }
  if (rest) msg += ` Pause ${rest} Sekunden.`;
  persist(); say(msg); rerender(); view.scrollTop = 0;
  (n >= target ? view.querySelector("h1") : $("#saveset")).focus();
}

function openOverview() {
  const a = D().active;
  openDialog(`<h2 id="dlg-h">Übersicht</h2><ol class="edlist">
    ${a.queue.map((q, k) => { const n = St.loggedFor(a, k).length, t = St.targetSets(q), name = esc(St.ex(q.exId).name);
      return `<li><div class="edrow"><span class="t">${k + 1}. ${name}</span><span class="num">${q.skipped ? "ausgelassen" : `${n}/${t}`}</span></div>
      <div class="edtools">${q.skipped ? `<button class="push" data-act="unskip" data-i="${k}">Wieder aufnehmen</button>`
        : n < t && k !== a.idx ? `<button class="push" data-act="jump" data-i="${k}">Jetzt machen</button>` : ""}</div></li>`; }).join("")}
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
    view.innerHTML = `<h1 class="big">Verlauf</h1><p>Noch keine Trainings. Nach deinem ersten Training siehst du hier, was sich bei jeder Übung verändert.</p>${weightSection()}<div style="height:24px"></div>`;
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
    ${changes.length ? `<h2 class="sec" style="margin-top:4px">Was sich verändert hat</h2><ul class="logged">
      ${changes.map(c => { const e = St.ex(c.id), d = c.to - c.from; return `<li><span>${esc(e.name)}</span><span class="num">${fmt(c.from)} → ${fmt(c.to)} kg <span class="sr">,</span>(${d > 0 ? "+" : d < 0 ? "−" : "±"}${fmt(Math.abs(d))})</span></li>`; }).join("")}
    </ul><p class="meta" style="margin-top:6px">Schwerster Satz im ersten und im letzten Training.</p>` : ""}
    <h2 class="sec">Übung im Detail</h2>
    <label class="field">Übung <select data-on="histex">${exIds.map(id => `<option value="${id}" ${id === ui.histEx ? "selected" : ""}>${esc(St.ex(id).name)}</option>`).join("")}</select></label>
    ${exDetail(ui.histEx)}
    ${weightSection()}
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
  return `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(caption)}: von ${fmt(Math.round(vals[0] * 10) / 10)} auf ${fmt(Math.round(vals.at(-1) * 10) / 10)} ${unit}">
    <line x1="${L}" x2="${W - R}" y1="${Y(hi)}" y2="${Y(hi)}" class="grid"/><line x1="${L}" x2="${W - R}" y1="${Y(lo)}" y2="${Y(lo)}" class="grid"/>
    <text x="${L - 6}" y="${Y(hi) + 4}" text-anchor="end">${fmt(Math.round(hi))}</text><text x="${L - 6}" y="${Y(lo) + 4}" text-anchor="end">${fmt(Math.round(lo))}</text>
    <text x="${L}" y="${H - 6}">${esc(labels[0])}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${esc(labels.at(-1))}</text>
    ${trend ? `<path d="${path(trend)}" class="trend"/>` : ""}<path d="${path(vals)}"/>${vals.map((v, k) => `<circle cx="${X(k).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3"/>`).join("")}
  </svg><figcaption class="meta">${esc(caption)}${trend ? " · gestrichelt: 7-Tage-Mittel" : ""}</figcaption></figure>`;
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
  const useReps = bw && pts.every(h => h.best.kg === 0);
  const svg = chart(pts.map(h => useReps ? h.reps : h.e1), pts.map(h => shortDate(h.date)), useReps ? "Wdh." : "kg",
    useReps ? "Wiederholungen gesamt pro Training" : "Geschätztes 1RM (Epley) aus dem besten Satz");
  return `${svg}<div class="table-wrap"><table><caption class="sr">Arbeitssätze pro Training</caption><thead><tr><th scope="col">Datum</th><th scope="col">Sätze</th><th scope="col" class="n">${useReps ? "Wdh." : "1RM ca."}</th></tr></thead>
    <tbody>${[...pts].reverse().map(h => `<tr><td>${dateDe(h.date)}</td><td class="num">${h.sets.map(y => `${fmt(y.kg)}×${y.reps}`).join(", ")}</td><td class="n">${useReps ? h.reps : fmt(Math.round(h.e1 * 10) / 10) + " kg"}</td></tr>`).join("")}</tbody></table></div>
    <p class="foot">1RM ca. = Gewicht × (1 + Wdh./30), Epley (1985). Steigt auch, wenn du bei gleichem Gewicht mehr Wiederholungen schaffst.</p>`;
}
function weightSection() {
  const w = D().weights.slice(-60);
  const avg = w.map((x, k) => { const from = new Date(x.date + "T12:00:00") - 6 * 864e5, win = w.slice(0, k + 1).filter(y => new Date(y.date + "T12:00:00") >= from); return win.reduce((a, y) => a + y.kg, 0) / win.length; });
  return `<h2 class="sec">Körpergewicht</h2>
    <div class="inline"><label class="field">Heute (kg) <input data-on="pweight" inputmode="decimal" autocomplete="off" value="${w.length && w.at(-1).date === new Date().toISOString().slice(0, 10) ? fmt(w.at(-1).kg) : ""}" placeholder="${w.length ? fmt(w.at(-1).kg) : "z. B. 80"}"></label><button class="btn" data-act="weightsave">Eintragen</button></div>
    ${w.length >= 2 ? chart(w.map(x => x.kg), w.map(x => shortDate(x.date + "T12:00:00")), "kg", "Körpergewicht", avg) : `<p class="meta">Wiege dich ein paar Mal pro Woche, am besten morgens. Nach zwei Einträgen erscheint hier der Verlauf mit Trend.</p>`}
    ${w.length >= 8 ? (() => { const d = avg.at(-1) - avg[Math.max(0, avg.length - 8)]; return `<p class="meta">Trend: ${d > 0 ? "+" : d < 0 ? "−" : "±"}${fmt(Math.abs(Math.round(d * 10) / 10))} kg im Vergleich zu vor etwa einer Woche.</p>`; })() : ""}`;
}
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
      <label class="row" for="s-sound"><span>Ton am Pausenende</span><input id="s-sound" class="switch" type="checkbox" role="switch" data-on="sound" ${s.sound ? "checked" : ""}></label>
    </div>
    <p class="foot">Der Ton kommt auch bei stummgeschaltetem iPhone nur, wenn der Klingelschalter nicht auf lautlos steht. Während des Trainings bleibt der Bildschirm an.</p>
    <label class="field" style="margin-top:16px">Standardpause <select data-on="rest">
      <option value="0" ${!s.rest ? "selected" : ""}>Automatisch (Grundübungen 120 s, sonst 90 s)</option>
      ${[60, 90, 120, 180].map(r => `<option value="${r}" ${s.rest === r ? "selected" : ""}>${r} s für alle</option>`).join("")}</select></label>
    <h2 class="sec">Deine Daten</h2>
    ${recoveredNote()}
    <p>Alles bleibt auf diesem Gerät. Es gibt kein Konto und keinen Server. Sichere deine Daten ab und zu als Datei, besonders vor einem Handywechsel.</p>
    <p class="meta">${s.lastBackup ? `Letzte Sicherung: ${new Date(s.lastBackup).toLocaleDateString("de-DE")} (vor ${St.daysSince(s.lastBackup)} ${St.daysSince(s.lastBackup) === 1 ? "Tag" : "Tagen"}).` : "Noch keine Sicherung erstellt."}</p>
    <button class="btn" data-act="export">Daten als Datei sichern</button>
    <button class="btn" data-act="import">Sicherung laden</button>
    <input type="file" id="importFile" accept="application/json,.json" hidden>
    <p class="err" id="importErr" role="alert" hidden></p>
    <button class="btn destructive" data-act="reset">Alle Daten löschen</button>
    <h2 class="sec">Über SATZ</h2>
    <p class="meta">Ernährung: Grundumsatz nach Mifflin-St Jeor (Mifflin et al. 1990), Aktivitätsfaktoren nach FAO/WHO/UNU 2004, Protein 1,6–2,0 g/kg (Morton et al. 2018; Helms et al. 2014). Alle Schritte und Quellen siehst du unter Ernährung → Ziel. Barcode-Erkennung mit ZXing (Apache-2.0), Produktdaten von Open Food Facts (ODbL).</p>
    <p class="meta">Die Regeln hinter der App: Doppelte Progression (Plotkin et al. 2022), etwa 10–20 Sätze pro Muskel und Woche (Schoenfeld et al. 2017; Pelland et al. 2026, mitarbeitende Muskeln als halber Satz), Pausen von 90–120 s (Singer et al. 2024), optionale RIR-Angabe (Zourdos et al. 2016). Keine Streaks, kein Zwang: Gewohnheiten brauchen Zeit, ein verpasster Tag schadet nicht (Lally et al. 2010).</p>
    <p class="meta">Version 0.5 · Daten-Version ${St.VERSION}</p><div style="height:24px"></div>`;
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
  start: t => { const p = St.activePlan(); St.startSession(p, +t.dataset.i); ui.summary = false; ui.key = ""; ui.day = null; go("#/training"); say(`Training gestartet: ${p.days[+t.dataset.i].name}.`); },
  adopt: t => {
    const tpl = TEMPLATES.find(x => x.id === t.dataset.id), p = St.instantiate(tpl);
    D().plans.push(p); D().activePlanId = p.id; persist(); ui.day = null;
    go("#/heute"); toast(`„${p.name}“ übernommen und aktiviert.`);
  },
  newplan: () => {
    const p = {id: St.uid(), name: "Mein Plan", perWeek: 3, days: [{id: St.uid(), name: "Tag 1", slots: []}]};
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
  addslot: () => openPicker(exId => { ui.draft = {id: St.uid(), exId, sets: 3, min: 8, max: 12, rest: 0}; ui.draftNew = true; openSlot(); }),
  swap: () => { const keep = ui.draft; openPicker(exId => { ui.draft = {...keep, exId}; openSlot(); }); },
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
  kg: t => { readSetInputs(); const a = D().active, e = St.ex(a.queue[a.idx].exId); ui.kg = Math.max(0, Math.round((ui.kg + e.step * +t.dataset.d) * 100) / 100); $("#kgIn").value = fmt(ui.kg); sayLater(`${fmt(ui.kg)} Kilo`); },
  reps: t => { readSetInputs(); ui.reps = Math.max(0, Math.min(100, ui.reps + +t.dataset.d)); $("#repsIn").value = ui.reps; sayLater(`${ui.reps} Wiederholungen`); },
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
    ui.key = `${a.id}:${i}:${St.loggedFor(a, i).length}`; ui.rir = s.rir; ui.kg = s.kg; ui.reps = s.reps; rerender("#saveset"); say("Letzter Satz gelöscht. Werte zum Korrigieren übernommen.");
  },
  extraset: () => { const a = D().active; a.queue[a.idx].extra++; persist(); rerender("#saveset"); say(`Extra-Satz hinzugefügt. Jetzt ${St.targetSets(a.queue[a.idx])} Sätze.`); },
  skipex: () => {
    const a = D().active, i = a.idx, name = St.ex(a.queue[i].exId).name;
    a.queue[i].skipped = true; a.restEnd = 0;
    const n = St.firstOpen(a, i); if (n < 0) ui.summary = true; else a.idx = n;
    ui.key = ""; persist(); rerender(); view.querySelector("h1").focus();
    toast(`${name} ausgelassen.`, () => { a.queue[i].skipped = false; a.idx = i; ui.summary = false; ui.key = ""; persist(); rerender(); view.querySelector("h1").focus(); });
  },
  rest30: () => { const a = D().active; a.restEnd += 30000; scheduleBeep((a.restEnd - Date.now()) / 1000); persist(); const el = $("#rt"); if (el) el.textContent = restLeft(); say(`Pause verlängert, noch ${restLeft().replace(":", " Minuten ")} Sekunden.`); },
  skiprest: () => { D().active.restEnd = 0; lastRestState = false; cancelBeep(); readSetInputs(); persist(); rerender("#saveset"); },
  overview: () => openOverview(),
  jump: t => { const a = D().active; a.idx = +t.dataset.i; ui.key = ""; ui.summary = false; persist(); opener = null; closeDialog(); rerender(); view.querySelector("h1").focus(); },
  unskip: t => { const a = D().active; a.queue[+t.dataset.i].skipped = false; a.idx = +t.dataset.i; ui.key = ""; ui.summary = false; persist(); opener = null; closeDialog(); rerender(); view.querySelector("h1").focus(); },
  end: () => { ui.summary = true; rerender(); view.querySelector("h1").focus(); },
  resume: () => { ui.summary = false; const a = D().active; a.idx = St.firstOpen(a, a.idx); persist(); rerender(); view.querySelector("h1").focus(); },
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
  weightsave: () => { const el = view.querySelector('[data-on="pweight"]'); el.dispatchEvent(new Event("change", {bubbles: true})); rerender(); },
  delsession: t => {
    const snap = St.snapshot(); D().sessions = D().sessions.filter(x => x.id !== t.dataset.id); persist(); rerender(); view.querySelector("h1").focus();
    toast("Training gelöscht.", () => { St.restore(snap); rerender(); });
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
  if (k === "pname") { curPlan().name = el.value.trim() || "Mein Plan"; persist(); rerender('[data-on="pname"]'); }
  if (k === "dname") { const p = curPlan(); p.days[ui.eday].name = el.value.trim() || `Tag ${ui.eday + 1}`; persist(); rerender('[data-on="dname"]'); }
  if (k === "histex") { ui.histEx = el.value; rerender('[data-on="histex"]'); }
  if (k === "contrast" || k === "rir") { D().settings[k] = el.checked; persist(); applySettings(); }
  if (k === "rest") { D().settings.rest = +el.value; persist(); }
  if (k === "kgin" || k === "repsin") { readSetInputs(); el.value = k === "kgin" ? fmt(ui.kg) : ui.reps; }
  if (k === "sound") { D().settings.sound = el.checked; persist(); }
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
  ev.preventDefault(); const b = dlg.querySelector('[data-act="slotsave"],[data-act="exsave"],[data-act="amountsave"],[data-act="foodsave"],[data-act="goalsave"],[data-act="bclookup"]'); if (b) b.click();
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
const ACCENTS = [["gruen", "Grün", "#0B6B46", "#3DDC97"], ["graphit", "Graphit", "#1C1C1E", "#F2F2F7"], ["kobalt", "Kobalt", "#1D4ED8", "#7AA2FF"], ["signal", "Signal", "#C8102E", "#FF8585"]];
const isDark = () => { const s = D().settings; return s.theme === "dark" || (s.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches); };
const targets = () => N.activeTargets(D().profile, St.currentWeight());
const foodLine = f => [f.brand, `${r0(f.per100.kcal)} kcal / 100 g`].filter(Boolean).join(" · ");

/* ============ Ernährung: Ansicht ============ */
function viewNutrition() {
  if (!ui.fday) ui.fday = dkey();
  const k = ui.fday, today = dkey(), t = targets();
  const entries = D().food.filter(e => e.date === k), sum = N.sumEntries(entries);
  const bar = (v, max) => { const pct = max ? Math.min(100, v / max * 100) : 0; return `<div class="bar ${max && v > max * 1.05 ? "over" : ""}" aria-hidden="true"><i style="width:${pct}%"></i></div>`; };
  const mac = (name, v, max) => `<div><span class="n">${name}</span><div class="g">${r0(v)}${max ? ` / ${r0(max)}` : ""} g</div>${bar(v, max)}</div>`;
  const left = t ? t.kcal - sum.kcal : 0;
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
    ${t ? "" : N.computeTargets(D().profile, St.currentWeight())?.blocked ? `<p class="hint">SATZ berechnet Ernährungsziele erst ab ${N.MIN_AGE} Jahren. Du kannst trotzdem mitschreiben, was du isst.</p>` : `<p class="hint">Trag unter <a href="#/mehr">Mehr → Persönliche Daten</a> Geburtsdatum, Geschlecht, Größe und Gewicht ein. Dann berechnet SATZ deinen Bedarf nach anerkannten Formeln. Oder leg die Werte selbst fest.</p>`}
    ${N.MEALS.map(([id, name]) => { const es = entries.filter(e => e.meal === id), ms = N.sumEntries(es); return `
      <div class="mealh"><h2 class="sec" id="m-${id}">${name}</h2>${es.length ? `<span>${r0(ms.kcal)} kcal</span>` : ""}</div>
      <ul class="group" aria-labelledby="m-${id}">
        ${es.map(e => { const m = N.macrosFor(e.per100, e.grams); return `<li><button class="fbtn" data-act="fedit" data-id="${e.id}" aria-haspopup="dialog"><span><b>${esc(e.name)}</b><small>${r0(e.grams)} g · P ${r0(m.p)} · K ${r0(m.c)} · F ${r0(m.f)}</small></span><span class="k">${r0(m.kcal)} kcal</span></button></li>`; }).join("")}
        <li><button class="fbtn add" data-act="fadd" data-m="${id}" aria-haspopup="dialog">+ Hinzufügen<span class="sr"> zu ${name}</span></button></li>
      </ul>`; }).join("")}
    <p class="foot" style="margin-top:16px">Produktdaten aus dem Netz kommen von Open Food Facts, einer freien Datenbank, die von Freiwilligen gepflegt wird. Prüfe die Werte auf der Verpackung. An Open Food Facts geht nur der Barcode oder Suchbegriff, nichts über dich.</p>
    <div style="height:24px"></div>`;
}

/* ---------- Hinzufügen ---------- */
function openFoodAdd(meal) {
  ui.fmeal = meal; ui.fq = ""; ui.foff = null; ui.foffState = "";
  openDialog(`<h2 id="dlg-h">${esc(N.MEALS.find(m => m[0] === meal)[1])}: hinzufügen</h2>
    <div class="row-btns" style="margin:0 0 16px"><button class="btn small primary" data-act="scan">Barcode scannen</button><button class="btn small" data-act="newfood">Neues Lebensmittel</button></div>
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
  const q = ui.fq.trim().toLowerCase(), list = localFoods(q).slice(0, 30);
  ui.fcands = [...list];
  const item = (f, i) => `<li><button data-act="pickfood" data-i="${i}"><b>${esc(f.name)}</b><small>${esc(foodLine(f))}</small></button></li>`;
  let off = "";
  if (ui.foffState === "loading") off = `<p class="meta" role="status">Suche bei Open Food Facts …</p>`;
  else if (ui.foffState === "error") off = `<p class="err" role="alert">Open Food Facts antwortet gerade nicht. Die Online-Suche erlaubt nur wenige Anfragen pro Minute. Versuch es gleich nochmal, scanne den Barcode oder leg das Lebensmittel selbst an.</p>`;
  else if (ui.foff) {
    const base = ui.fcands.length;
    ui.fcands.push(...ui.foff);
    off = `<h3 class="meta" style="margin:12px 0 6px">Open Food Facts: ${ui.foff.length} Treffer</h3>${ui.foff.length ? `<ul class="plist">${ui.foff.map((f, i) => item(f, base + i)).join("")}</ul>` : ""}`;
  }
  box.innerHTML = `
    ${list.length ? `<h3 class="meta" style="margin:0 0 6px">${q ? "Deine Lebensmittel" : "Zuletzt verwendet"}</h3><ul class="plist">${list.map(item).join("")}</ul>`
      : `<p class="meta">${q ? "Keine eigenen Treffer." : "Noch keine eigenen Lebensmittel. Scanne einen Barcode, suche online oder leg eins an."}</p>`}
    ${q.length >= 3 && !ui.foff && ui.foffState !== "loading" ? `<button class="btn" data-act="offsearch" style="margin-bottom:12px">„${esc(ui.fq.trim())}“ online suchen</button>` : ""}
    ${off}`;
}

/* ---------- Menge ---------- */
function openAmount(food, entry) {
  ui.famount = {food, entry};
  const grams = entry ? entry.grams : food.serving || 100;
  const mealSel = entry ? entry.meal : ui.fmeal || "snack";
  openDialog(`<h2 id="dlg-h">${esc(food.name)}</h2>
    <p class="meta" style="text-align:center;margin-top:-10px">${esc(foodLine(food))}</p>
    <p class="err" role="alert" hidden></p>
    <label class="field">Menge in Gramm <input id="fgrams" data-on="fgrams" inputmode="decimal" autocomplete="off" value="${fmt(grams)}"></label>
    ${food.serving ? `<div class="quick"><button class="btn small" data-act="fgset" data-g="${food.serving}">1 Portion (${fmt(food.serving)} g)</button><button class="btn small" data-act="fgset" data-g="100">100 g</button></div>` : ""}
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
function saveAmount() {
  const g = num($("#fgrams").value);
  if (g <= 0 || g > 5000) return dlgError("Bitte gib eine Menge zwischen 1 und 5000 g ein.");
  const {food, entry} = ui.famount, meal = $("#fmealsel").value;
  if (!food.id) { food.id = "f_" + St.uid(); }
  if (!D().foods[food.id]) D().foods[food.id] = {...food};          // Online-Treffer lokal merken, damit sie offline wieder auftauchen
  if (entry) Object.assign(entry, {grams: g, meal});
  else D().food.push({id: St.uid(), date: ui.fday || dkey(), meal, foodId: food.id, name: food.name, brand: food.brand || "", per100: {...food.per100}, grams: g});
  persist(); ui.fmeal = meal; closeDialog(); if (location.hash.startsWith("#/ernaehrung")) rerender(); else go("#/ernaehrung");
  say(`${food.name}, ${r0(g)} g ${entry ? "geändert" : "eingetragen"}.`);
}

/* ---------- Eigenes Lebensmittel ---------- */
function openFoodForm(pre = {}, note = "") {
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
  openAmount(food);
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
        <li>× Aktivitätsfaktor (PAL) ${fmt(s.pal)} = <b>${r0(s.tdee)} kcal</b> Gesamtbedarf</li>
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
  fedit: t => { const e = D().food.find(x => x.id === t.dataset.id); if (e) openAmount(D().foods[e.foodId] ? {...D().foods[e.foodId], per100: e.per100} : {name: e.name, brand: e.brand, per100: e.per100}, e); },
  fdel: () => {
    const e = ui.famount.entry, snap = St.snapshot();
    D().food = D().food.filter(x => x.id !== e.id); persist(); opener = null; closeDialog(); rerender(); view.querySelector("h1").focus();
    toast(`${e.name} gelöscht.`, () => { St.restore(snap); rerender(); });
  },
  pickfood: t => openAmount(ui.fcands[+t.dataset.i]),
  fgset: t => { $("#fgrams").value = fmt(+t.dataset.g); updatePreview(); },
  amountsave: () => saveAmount(),
  newfood: () => openFoodForm({name: (ui.fq || "").trim()}),
  foodedit: () => openFoodForm(D().foods[ui.famount.food.id]),
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
  if (k === "fgrams") updatePreview();
});
document.addEventListener("change", ev => {
  const el = ev.target, k = el.dataset.on, pr = D().profile;
  if (!k || !k.startsWith("p") || k === "pm" || k === "pq" || k === "pname") return;
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
St.load();
applySettings();
// Speicher dauerhaft anfordern, damit Safari ihn nicht nach Wochen ohne Nutzung räumt
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applySettings);
window.addEventListener("hashchange", route);
route();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  // Neue Version übernommen: einmal neu laden, damit das Update sofort sichtbar ist (nicht mitten im Training).
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController && !D().active) location.reload(); });
  navigator.serviceWorker.register("sw.js", {updateViaCache: "none"}).then(r => r.update()).catch(() => {});
}
