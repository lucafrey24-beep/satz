// Einstieg für neue Nutzer: fünf kurze Fragen, daraus ein Vorschlag aus den fertigen Plänen.
// Nur Logik und Texte, keine Darstellung. Bestehende Nutzer (mit Plan oder Training) sehen den Einstieg nie.
// Die Texte stehen gesammelt hier, damit sie sich später leicht übersetzen lassen.
import {TEMPLATES} from "./data.js";

export const QUESTIONS = [
  {id: "goal", q: "Was willst du vor allem erreichen?", opts: [
    ["kraft", "Kraft und Muskeln", "Stärker werden, Muskeln aufbauen"],
    ["gesaess", "Gesäß und Beine", "Schwerpunkt Unterkörper, Oberkörper bleibt dabei"],
    ["ausdauer", "Fitness und Kraftausdauer", "Viele Wiederholungen, kurze Pausen"],
    ["athletik", "Athletik", "Sprungkraft und Schnelligkeit für deinen Sport"],
    ["mobil", "Beweglichkeit", "Dehnen und Mobility, ohne Gewichte"]]},
  {id: "exp", q: "Wie lange trainierst du schon mit Gewichten?", opts: [
    ["neu", "Ich fange gerade an", ""], ["jahr", "Weniger als ein Jahr", ""], ["mehr", "Länger als ein Jahr", "regelmäßig"]]},
  {id: "place", q: "Wo trainierst du?", opts: [
    ["studio", "Im Studio", "Maschinen, Kabelzug, Hanteln"], ["kh", "Zu Hause mit Kurzhanteln", ""],
    ["band", "Zu Hause mit Widerstandsband", ""], ["ohne", "Zu Hause ohne Gerät", "nur Körpergewicht"]]},
  {id: "days", q: "An wie vielen Tagen pro Woche willst du trainieren?", opts: [[2, "2 Tage", ""], [3, "3 Tage", ""], [4, "4 Tage", ""], [5, "5 Tage", ""], [6, "6 Tage", ""]]},
  {id: "mins", q: "Wie viel Zeit hast du pro Training?", opts: [[30, "Etwa 30 Minuten", ""], [45, "Etwa 45 Minuten", ""], [60, "Etwa 60 Minuten", ""], [90, "Mehr als eine Stunde", ""]]},
];

// Dauer eines Trainingstags wie auf „Heute“: pro Satz Pause plus etwa 45 s Arbeit
export const dayMinutes = (slots, restFor) => Math.round(slots.reduce((a, sl) => a + sl.sets * (restFor(sl) + 45), 0) / 60);

export function recommend(a) {
  const t = id => TEMPLATES.find(x => x.id === id);
  let id, why;
  if (a.goal === "mobil") { id = "mobility15"; why = "Du willst beweglicher werden. Die Einheit dauert etwa 15 Minuten und passt an Ruhetagen oder nach dem Training."; }
  else if (a.place === "kh") { id = "zuhause_kh"; why = "Du trainierst zu Hause mit Kurzhanteln. Der Plan braucht keine Bank und trainiert alle großen Muskeln zweimal in zwei Trainings."; }
  else if (a.place === "band") { id = "zuhause_band"; why = "Du trainierst zu Hause mit Band. Das Band übernimmt die Zugübungen, für die sonst ein Kabelzug nötig wäre."; }
  else if (a.place === "ohne") { id = "zuhause_ohne"; why = "Du trainierst ohne Gerät. Ein Tisch und ein Stuhl reichen für alle Übungen."; }
  else if (a.goal === "athletik") { id = "athletik"; why = "Für Athletik kommen Sprünge und explosive Übungen zuerst, dann Grundkraft mit wenigen Wiederholungen."; }
  else if (a.goal === "ausdauer") { id = "zirkel"; why = "Für Kraftausdauer: viele Wiederholungen und kurze Pausen."; }
  else if (a.goal === "gesaess") { id = "glutes"; why = "Zwei Tage mit Schwerpunkt Gesäß und Beine, ein Tag für den Oberkörper."; }
  else if (a.days <= 2) { id = "minimal"; why = "Mit zwei Tagen pro Woche bringt ein Ganzkörperplan am meisten: Jeder Muskel kommt zweimal dran."; }
  else if (a.days === 3) { id = "ganzkoerper"; why = a.exp === "mehr"
    ? "Bei drei Tagen bringt Ganzkörper mehr Volumen pro Muskel als ein Dreier-Split, bei dem jeder Muskel nur einmal pro Woche dran ist."
    : "Bei drei Tagen und wenig Erfahrung ist Ganzkörper der beste Start: Du übst jede Bewegung oft und lernst sie schnell."; }
  else if (a.days >= 6 && a.exp === "mehr") { id = "ppl"; why = "Sechs Tage und mehr als ein Jahr Erfahrung: Push, Pull, Beine zweimal pro Woche bringt viel Volumen."; }
  else { id = "ok_uk"; why = a.days >= 6
    ? "Sechs Tage sind am Anfang viel. Oberkörper und Unterkörper im Wechsel trainiert jeden Muskel zweimal pro Woche, die übrigen Tage sind Erholung."
    : "Bei vier oder fünf Tagen trainiert Oberkörper und Unterkörper im Wechsel jeden Muskel zweimal pro Woche."; }
  const tpl = t(id);
  // Wochenziel: die gewählten Tage. Mobility zählt als eigene Einheit, dafür bleiben drei pro Woche ein guter Richtwert.
  const perWeek = id === "mobility15" ? Math.min(a.days, 3) : Math.min(7, a.days);
  return {tpl, perWeek, why};
}

// Passt die Satzzahl an die verfügbare Zeit an: Sätze reduzieren (mindestens 2, Halten und Mobility unverändert),
// bis der längste Tag in die Zeit passt. Ändert nur den neuen Plan, nie bestehende.
export function fitToTime(plan, mins, restFor, keepUnit) {
  const longest = () => Math.max(...plan.days.map(d => dayMinutes(d.slots, restFor)));
  let cut = 0;
  for (let round = 0; round < 3 && longest() > mins * 1.1; round++) {
    plan.days.forEach(d => d.slots.forEach(sl => { if (sl.sets > 2 && !keepUnit(sl)) { sl.sets--; cut++; } }));
  }
  return {cut, minutes: longest()};
}
