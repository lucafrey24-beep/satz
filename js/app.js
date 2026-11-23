import * as St from "./store.js";
import {MUSCLES, MUSCLE_NAME, TEMPLATES} from "./data.js";

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
  toastTimer = setTimeout(hide, 8000);
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
function dlgError(msg) { const e = dlg.querySelector(".err"); e.textContent = msg; e.hidden = false; }

/* ============ Einstellungen anwenden ============ */
function applySettings() {
  const s = D().settings, r = document.documentElement;
  r.style.setProperty("--scale", s.scale);
  if (s.scale && s.scale !== 1) r.dataset.scale = ""; else delete r.dataset.scale;
  if (s.theme === "auto") delete r.dataset.theme; else r.dataset.theme = s.theme;
  if (s.contrast) r.dataset.contrast = "high"; else delete r.dataset.contrast;
  const dark = s.theme === "dark" || (s.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]').content = dark ? "#000000" : "#F2F2F7";
}

/* ============ Router ============ */
const ROUTES = {heute: viewToday, plaene: viewPlans, vorlage: viewTemplate, plan: viewEditor, uebungen: viewExercises, verlauf: viewHistory, mehr: viewMore, training: viewTraining};
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
  renderBar(training);
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
function renderBar(training) {
  const a = D().active;
  bar.innerHTML = training && a
    ? `<button class="navbtn" data-act="end">Beenden</button><span class="ctx">${esc(a.dayName)}</span>
       <button class="navbtn strong" data-act="overview" aria-haspopup="dialog">Übersicht</button>`
    : `<a class="wordmark" href="#/heute" aria-label="SATZ, zur Startseite">SATZ<span aria-hidden="true">.</span></a>`;
}

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
  const sug = St.suggest(it), key = `${a.id}:${i}:${logged.length}`;
  if (ui.key !== key) {
    ui.key = key; ui.rir = null;
    if (logged.length) { const l = logged[logged.length - 1]; ui.kg = l.kg; ui.reps = l.reps; } else { ui.kg = sug.kg; ui.reps = sug.reps; }
  }
  const bw = e.unit === "bw", resting = a.restEnd > Date.now();
  const next = a.queue.findIndex((q, k) => k > i && !q.skipped && St.loggedFor(a, k).length < St.targetSets(q));
  view.innerHTML = `
    <div class="progress" aria-hidden="true">${a.queue.map((q, k) => `<span class="${q.skipped ? "skip" : k === i ? "now" : St.loggedFor(a, k).length >= St.targetSets(q) ? "done" : ""}"></span>`).join("")}</div>
    <p class="eyebrow">Übung ${i + 1} von ${a.queue.length} · Satz ${logged.length + 1} von ${target} · Ziel ${it.min}–${it.max} Wdh.</p>
    <h1 class="big">${esc(e.name)}</h1>
    <p class="hint">${esc(sug.text)}</p>
    ${resting ? `<div class="rest" role="group" aria-label="Pause"><span class="eyebrow">Pause</span><div class="num" id="rt" aria-hidden="true">${restLeft()}</div>
      <div class="row-btns"><button class="btn small" data-act="rest30">+30 s</button><button class="btn small" data-act="skiprest">Pause beenden</button></div></div>` : ""}
    <div class="stepper" role="group" aria-label="${bw ? "Zusatzgewicht" : "Gewicht"}">
      <button data-act="kg" data-d="-1" aria-label="Gewicht um ${fmt(e.step)} Kilo verringern">−</button>
      <output aria-live="polite" aria-atomic="true"><span class="v num">${fmt(ui.kg)}</span><span class="u">${bw ? "kg zusätzlich" : "kg"}</span></output>
      <button data-act="kg" data-d="1" aria-label="Gewicht um ${fmt(e.step)} Kilo erhöhen">+</button></div>
    <div class="stepper" role="group" aria-label="Wiederholungen">
      <button data-act="reps" data-d="-1" aria-label="Eine Wiederholung weniger">−</button>
      <output aria-live="polite" aria-atomic="true"><span class="v num">${ui.reps}</span><span class="u">Wiederholungen</span></output>
      <button data-act="reps" data-d="1" aria-label="Eine Wiederholung mehr">+</button></div>
    ${D().settings.rir ? `<fieldset><legend>Wie viele Wdh. wären noch gegangen? <span style="font-weight:500">(optional)</span></legend>
      <div class="rir">${[0, 1, 2, 3, 4].map(r => `<button type="button" data-act="rir" data-v="${r}" aria-pressed="${ui.rir === r}">${r === 4 ? "4+" : r}</button>`).join("")}</div></fieldset>` : ""}
    <div class="actionbar"><button class="btn primary" data-act="saveset" id="saveset">Satz ${logged.length + 1} speichern</button></div>
    ${logged.length ? `<h2 class="sec" style="margin-top:8px">Eingetragen</h2><ul class="logged">${logged.map((l, k) => `<li><span>Satz ${k + 1}</span><span class="num">${St.fmtW(e, l.kg)} × ${l.reps}${l.rir != null ? ` · RIR ${l.rir === 4 ? "4+" : l.rir}` : ""}</span></li>`).join("")}</ul>
      <button class="btn small" data-act="undoset" style="margin-top:8px">Letzten Satz löschen</button>` : ""}
    <div class="row-btns" style="margin-top:16px"><button class="btn small" data-act="extraset">+ Extra-Satz</button><button class="btn small" data-act="skipex">Übung auslassen</button></div>
    <p class="meta" style="margin-top:12px">${next >= 0 ? `Danach: ${esc(St.ex(a.queue[next].exId).name)}` : "Das ist die letzte offene Übung."}</p>
    <div style="height:16px"></div>`;
}
function restLeft() {
  const s = Math.max(0, Math.ceil((D().active.restEnd - Date.now()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
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

function saveSet() {
  const a = D().active, i = a.idx, it = a.queue[i], e = St.ex(it.exId);
  a.sets.push({q: i, exId: it.exId, kg: ui.kg, reps: ui.reps, rir: ui.rir, t: Date.now()});
  const n = St.loggedFor(a, i).length, target = St.targetSets(it);
  let msg = `Gespeichert: ${St.fmtW(e, ui.kg)}, ${ui.reps} Wiederholungen.`;
  if (ui.reps < it.min) msg += ` Unter dem Ziel von ${it.min}.`;
  const nextIdx = St.firstOpen(a, i);
  if (nextIdx < 0) { a.restEnd = 0; persist(); ui.summary = true; say(msg + " Alle Übungen erledigt."); rerender(); view.querySelector("h1").focus(); return; }
  a.restEnd = Date.now() + it.rest * 1000; lastRestState = true;
  if (n >= target) { a.idx = nextIdx; msg += ` ${e.name} erledigt. Nächste Übung: ${St.ex(a.queue[nextIdx].exId).name}.`; }
  msg += ` Pause ${it.rest} Sekunden.`;
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
    view.innerHTML = `<h1 class="big">Verlauf</h1><p>Noch keine Trainings. Nach deinem ersten Training siehst du hier, was sich bei jeder Übung verändert.</p>`;
    return;
  }
  const exIds = [...new Set(s.sessions.flatMap(x => x.sets.map(y => y.exId)))];
  const changes = exIds.map(id => {
    const hist = s.sessions.filter(x => x.sets.some(y => y.exId === id));
    if (hist.length < 2) return null;
    const top = x => Math.max(...x.sets.filter(y => y.exId === id).map(y => y.kg));
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
    <h2 class="sec">Letzte 7 Tage</h2>
    ${volumeTable(St.recentVolume(7), "Sätze pro Muskel in den letzten 7 Tagen, verglichen mit dem Plan", p ? St.planVolume(p) : null)}
    <h2 class="sec">Trainings</h2>
    ${ses.map(x => `<details><summary>${dateDe(x.date)} · ${esc(x.dayName)} · ${x.sets.length} Sätze</summary>
      <ul class="logged">${groupSets(x.sets).map(g => `<li><span>${esc(St.ex(g.exId).name)}</span><span class="num">${g.sets.map(y => `${fmt(y.kg)}×${y.reps}`).join(", ")}</span></li>`).join("")}</ul>
      <button class="btn small destructive" data-act="delsession" data-id="${x.id}" style="margin:10px 0">Training löschen</button></details>`).join("")}
    <div style="height:24px"></div>`;
}
function groupSets(sets) {
  const g = [];
  sets.forEach(s => { const last = g[g.length - 1]; if (last && last.exId === s.exId) last.sets.push(s); else g.push({exId: s.exId, sets: [s]}); });
  return g;
}
function exDetail(id) {
  const hist = D().sessions.filter(x => x.sets.some(y => y.exId === id)).map(x => {
    const sets = x.sets.filter(y => y.exId === id), kg = Math.max(...sets.map(y => y.kg));
    return {date: x.date, kg, reps: sets.filter(y => y.kg === kg).map(y => y.reps), sets};
  });
  const pts = hist.slice(-12);
  let svg = "";
  if (pts.length > 1) {
    const ys = pts.map(h => h.kg), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
    const xy = pts.map((h, k) => [8 + k * (284 / (pts.length - 1)), 56 - ((h.kg - lo) / span) * 48]);
    svg = `<svg class="spark" viewBox="0 0 300 64" preserveAspectRatio="none" aria-hidden="true"><path d="M${xy.map(c => c.join(",")).join(" L")}" vector-effect="non-scaling-stroke"/>${xy.map(c => `<circle cx="${c[0]}" cy="${c[1]}" r="3.5"/>`).join("")}</svg>`;
  }
  return `${svg}<div class="table-wrap"><table><caption class="sr">Schwerster Satz pro Training</caption><thead><tr><th scope="col">Datum</th><th scope="col" class="n">Gewicht</th><th scope="col" class="n">Wdh.</th></tr></thead>
    <tbody>${[...pts].reverse().map(h => `<tr><td>${dateDe(h.date)}</td><td class="n">${fmt(h.kg)} kg</td><td class="n">${h.reps.join(" + ")}</td></tr>`).join("")}</tbody></table></div>`;
}

/* ============ Mehr ============ */
function viewMore() {
  const s = D().settings;
  const seg = (key, opts) => `<div class="seg" role="group">${opts.map(([v, l, aria]) => `<button type="button" data-act="set" data-k="${key}" data-v="${v}" aria-pressed="${String(s[key]) === String(v)}" ${aria ? `aria-label="${aria}"` : ""}>${l}</button>`).join("")}</div>`;
  view.innerHTML = `<h1 class="big">Mehr</h1>
    <h2 class="sec" style="margin-top:4px">Anzeige</h2>
    <div class="group">
      <div class="row stack"><span id="l-scale">Textgröße</span>${seg("scale", [[1, "iPhone", "Wie in den iPhone-Einstellungen"], [1.15, "A+", "Groß"], [1.3, "A++", "Sehr groß"], [1.5, "A+++", "Riesig"]]).replace('role="group"', 'role="group" aria-labelledby="l-scale"')}</div>
      <div class="row stack"><span id="l-theme">Erscheinungsbild</span>${seg("theme", [["auto", "Automatisch"], ["light", "Hell"], ["dark", "Dunkel"]]).replace('role="group"', 'role="group" aria-labelledby="l-theme"')}</div>
      <label class="row" for="s-contrast"><span>Kontrast erhöhen</span><input id="s-contrast" class="switch" type="checkbox" role="switch" data-on="contrast" ${s.contrast ? "checked" : ""}></label>
    </div>
    <p class="foot">„iPhone“ übernimmt die Textgröße aus Einstellungen → Anzeige &amp; Helligkeit.</p>
    <h2 class="sec">Training</h2>
    <div class="group">
      <label class="row" for="s-rir"><span>„Wdh. in Reserve“ abfragen</span><input id="s-rir" class="switch" type="checkbox" role="switch" data-on="rir" ${s.rir ? "checked" : ""}></label>
    </div>
    <label class="field" style="margin-top:16px">Standardpause <select data-on="rest">
      <option value="0" ${!s.rest ? "selected" : ""}>Automatisch (Grundübungen 120 s, sonst 90 s)</option>
      ${[60, 90, 120, 180].map(r => `<option value="${r}" ${s.rest === r ? "selected" : ""}>${r} s für alle</option>`).join("")}</select></label>
    <h2 class="sec">Deine Daten</h2>
    <p>Alles bleibt auf diesem Gerät. Es gibt kein Konto und keinen Server. Sichere deine Daten ab und zu als Datei, besonders vor einem Handywechsel.</p>
    <button class="btn" data-act="export">Daten als Datei sichern</button>
    <button class="btn" data-act="import">Sicherung laden</button>
    <input type="file" id="importFile" accept="application/json,.json" hidden>
    <p class="err" id="importErr" role="alert" hidden></p>
    <button class="btn destructive" data-act="reset">Alle Daten löschen</button>
    <h2 class="sec">Über SATZ</h2>
    <p class="meta">Die Regeln hinter der App: Doppelte Progression (Plotkin et al. 2022), etwa 10–20 Sätze pro Muskel und Woche (Schoenfeld et al. 2017; Pelland et al. 2026, mitarbeitende Muskeln als halber Satz), Pausen von 90–120 s (Singer et al. 2024), optionale RIR-Angabe (Zourdos et al. 2016). Keine Streaks, kein Zwang: Gewohnheiten brauchen Zeit, ein verpasster Tag schadet nicht (Lally et al. 2010).</p>
    <p class="meta">Version 0.2 · Daten-Version ${St.VERSION}</p><div style="height:24px"></div>`;
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
  kg: t => { const a = D().active, e = St.ex(a.queue[a.idx].exId); ui.kg = Math.max(0, Math.round((ui.kg + e.step * +t.dataset.d) * 100) / 100); rerenderKeep(t); },
  reps: t => { ui.reps = Math.max(0, Math.min(100, ui.reps + +t.dataset.d)); rerenderKeep(t); },
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
  rest30: () => { const a = D().active; a.restEnd += 30000; persist(); const el = $("#rt"); if (el) el.textContent = restLeft(); say(`Pause verlängert, noch ${restLeft().replace(":", " Minuten ")} Sekunden.`); },
  skiprest: () => { D().active.restEnd = 0; lastRestState = false; persist(); rerender("#saveset"); },
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
    const n = a.sets.length; St.finishSession(); ui.summary = false; ui.key = "";
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    go("#/heute"); toast(n ? `Training gespeichert: ${n} Sätze.${checked.length ? " Plan angepasst." : ""}` : "Training beendet.");
  },
  discard: () => {
    const snap = St.snapshot(); D().active = null; persist(); ui.summary = false; go("#/heute");
    toast("Training verworfen.", () => { St.restore(snap); go("#/training"); });
  },
  delsession: t => {
    const snap = St.snapshot(); D().sessions = D().sessions.filter(x => x.id !== t.dataset.id); persist(); rerender(); view.querySelector("h1").focus();
    toast("Training gelöscht.", () => { St.restore(snap); rerender(); });
  },
  /* Einstellungen */
  set: t => { const k = t.dataset.k, v = t.dataset.v; D().settings[k] = k === "scale" ? +v : v; persist(); applySettings(); rerender(`[data-k="${k}"][data-v="${v}"]`); },
  export: () => {
    const blob = new Blob([JSON.stringify(D(), null, 1)], {type: "application/json"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `satz-sicherung-${new Date().toISOString().slice(0, 10)}.json`; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast("Sicherung erstellt.");
  },
  import: () => $("#importFile").click(),
  reset: () => {
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
  if (el.id === "importFile" && el.files[0]) {
    const r = new FileReader();
    r.onload = () => {
      const err = $("#importErr");
      let data; try { data = JSON.parse(r.result); } catch (e) { data = null; }
      if (!St.valid(data)) { err.textContent = "Diese Datei ist keine gültige SATZ-Sicherung."; err.hidden = false; return; }
      const snap = St.snapshot(); St.replaceAll(data); applySettings(); ui.day = null;
      go("#/heute"); toast(`Sicherung geladen: ${data.sessions.length} Trainings.`, () => { St.restore(snap); applySettings(); go("#/mehr"); });
    };
    r.readAsText(el.files[0]); el.value = "";
  }
});
// Enter in Dialog-Feldern speichert
dlg.addEventListener("keydown", ev => {
  if (ev.key !== "Enter" || ev.target.tagName !== "INPUT" || ev.target.type === "search" || ev.target.type === "checkbox") return;
  ev.preventDefault(); const b = dlg.querySelector('[data-act="slotsave"],[data-act="exsave"]'); if (b) b.click();
});

/* ============ Start ============ */
St.load();
applySettings();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applySettings);
window.addEventListener("hashchange", route);
route();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
