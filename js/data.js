// Stammdaten: Muskeln, Übungsbibliothek, fertige Pläne.
// Volumen-Zählung nach Pelland et al. (2026, Sports Med 56(2): 481–505, „fractional“-Methode): Hauptmuskel = 1 Satz, mitarbeitender Muskel = 0,5 Satz.
// Hauptmuskeln sind nur die Muskeln, die die Bewegung tragen. Darum hat jede Übung höchstens zwei Hauptmuskeln.

export const MUSCLES = [
  {id: "brust", major: true, name: "Brust"},
  {id: "ruecken", major: true, name: "Rücken"},
  {id: "schultern", major: true, name: "Schultern"},
  {id: "bizeps", major: true, name: "Bizeps"},
  {id: "trizeps", major: true, name: "Trizeps"},
  {id: "quads", major: true, name: "Quadrizeps"},
  {id: "hamstrings", major: true, name: "Beinbeuger"},
  {id: "gluteus", major: true, name: "Gesäß"},
  {id: "waden", name: "Waden"},
  {id: "bauch", name: "Bauch"},
  {id: "lrs", name: "Unterer Rücken"},
];
export const MUSCLE_NAME = Object.fromEntries(MUSCLES.map(m => [m.id, m.name]));

// [id, Name, Hauptmuskeln, mitarbeitende Muskeln, Steigerung in kg, Einheit]
// Einheit "kg" = Zusatzlast, "bw" = Körpergewicht (+ optional Zusatzgewicht)
const RAW = [
  ["bankdruecken", "Bankdrücken", ["brust"], ["trizeps", "schultern"], 2.5, "kg"],
  ["schraegbank", "Schrägbankdrücken", ["brust"], ["schultern", "trizeps"], 2.5, "kg"],
  ["kh_bank", "Kurzhantel-Bankdrücken", ["brust"], ["trizeps", "schultern"], 2, "kg"],
  ["dips", "Dips", ["brust", "trizeps"], ["schultern"], 2.5, "bw"],
  ["butterfly", "Butterfly", ["brust"], [], 2.5, "kg"],
  ["liegestuetze", "Liegestütze", ["brust"], ["trizeps", "schultern"], 2.5, "bw"],
  ["latziehen", "Latziehen", ["ruecken"], ["bizeps"], 2.5, "kg"],
  ["klimmzuege", "Klimmzüge", ["ruecken"], ["bizeps"], 2.5, "bw"],
  ["tbar", "T-Bar Rows", ["ruecken"], ["bizeps", "lrs"], 2.5, "kg"],
  ["lh_rudern", "Langhantelrudern", ["ruecken"], ["bizeps", "lrs"], 2.5, "kg"],
  ["enges_rudern", "Enges Rudern", ["ruecken"], ["bizeps"], 2.5, "kg"],
  ["kh_rudern", "Kurzhantelrudern einarmig", ["ruecken"], ["bizeps"], 2, "kg"],
  ["rueckenstrecker", "Rückenstrecker", ["lrs"], ["gluteus", "hamstrings"], 2.5, "kg"],
  ["schulterdruecken", "Schulterdrücken", ["schultern"], ["trizeps"], 2.5, "kg"],
  ["seitheben", "Seitheben", ["schultern"], [], 1, "kg"],
  ["butterfly_reverse", "Butterfly Reverse", ["schultern"], ["ruecken"], 2.5, "kg"],
  ["face_pulls", "Face Pulls", ["schultern"], ["ruecken"], 2.5, "kg"],
  ["bizepscurls", "Bizepscurls", ["bizeps"], [], 1, "kg"],
  ["hammercurls", "Hammercurls", ["bizeps"], [], 1, "kg"],
  ["sz_curls", "SZ-Curls", ["bizeps"], [], 2.5, "kg"],
  ["trizeps_pushdown", "Trizeps Pushdowns", ["trizeps"], [], 2.5, "kg"],
  ["trizeps_overhead", "Trizepsdrücken über Kopf", ["trizeps"], [], 2.5, "kg"],
  ["kniebeugen", "Kniebeugen", ["quads", "gluteus"], ["lrs"], 2.5, "kg"],
  ["beinpresse", "Beinpresse", ["quads"], ["gluteus"], 5, "kg"],
  ["ausfallschritte", "Ausfallschritte", ["quads", "gluteus"], ["hamstrings"], 2, "kg"],
  ["beinstrecker", "Beinstrecker", ["quads"], [], 2.5, "kg"],
  ["rdl", "Rumänisches Kreuzheben", ["hamstrings", "gluteus"], ["lrs"], 2.5, "kg"],
  ["kreuzheben", "Kreuzheben", ["gluteus", "hamstrings"], ["lrs", "ruecken", "quads"], 5, "kg"],
  ["beinbeuger", "Beinbeuger", ["hamstrings"], [], 2.5, "kg"],
  ["hip_thrust", "Hip Thrust", ["gluteus"], ["hamstrings"], 5, "kg"],
  ["wadenheben", "Wadenheben", ["waden"], [], 5, "kg"],
  ["crunches", "Crunches", ["bauch"], [], 2.5, "bw"],
  ["leg_raises", "Hanging Leg Raises", ["bauch"], [], 2.5, "bw"],
  ["kabel_crunches", "Kabel-Crunches", ["bauch"], [], 2.5, "kg"],
  // ab 0.7: Gesäß, Athletik, Kraftausdauer
  ["bulgarian", "Bulgarische Kniebeuge", ["quads", "gluteus"], ["hamstrings"], 2, "kg"],
  ["goblet", "Goblet Squat", ["quads", "gluteus"], ["bauch"], 2, "kg"],
  ["step_ups", "Step-ups", ["quads", "gluteus"], ["hamstrings"], 2, "kg"],
  ["glute_bridge", "Glute Bridge", ["gluteus"], ["hamstrings"], 5, "kg"],
  ["kickback", "Kabel-Kickback", ["gluteus"], ["hamstrings"], 2.5, "kg"],
  ["abduktoren", "Abduktoren-Maschine", ["gluteus"], [], 5, "kg"],
  ["kb_swing", "Kettlebell Swing", ["gluteus", "hamstrings"], ["lrs", "schultern"], 4, "kg"],
  ["box_jump", "Box Jumps", ["quads", "gluteus"], ["waden"], 2.5, "bw"],
  ["sprung_kb", "Sprungkniebeuge", ["quads", "gluteus"], ["waden"], 2.5, "bw"],
];
// Ausführung: [Bewegungsvorlage aus anim.js, Gerät, kurzer Technik-Hinweis]
export const INFO = {
  bankdruecken: ["bench", "Flachbank mit Langhantel", "Schulterblätter zusammen, Stange kontrolliert zur unteren Brust, Füße fest am Boden."],
  schraegbank: ["incline", "Schrägbank (30–45°) mit Langhantel", "Stange zur oberen Brust, Ellbogen etwa 45° vom Körper."],
  kh_bank: ["bench_db", "Flachbank mit Kurzhanteln", "Hanteln tief absenken, über der Brust zusammenführen, nicht klacken lassen."],
  dips: ["dips", "Barren", "Oberkörper leicht vor, bis die Oberarme etwa waagerecht sind, dann hochdrücken."],
  butterfly: ["fly", "Butterfly-Maschine", "Arme leicht gebeugt, Griffe vor der Brust zusammenführen, langsam zurück."],
  liegestuetze: ["pushup", "Boden, ohne Gerät", "Körper gerade wie ein Brett, Brust bis knapp über den Boden."],
  latziehen: ["latpull", "Latzug-Maschine", "Stange zur oberen Brust ziehen, Ellbogen nach unten, nicht nach hinten lehnen."],
  klimmzuege: ["pullup", "Klimmzugstange", "Aus dem Hang hochziehen, bis das Kinn über der Stange ist, kontrolliert ablassen."],
  tbar: ["row_tbar", "T-Bar-Rudern (Landmine)", "Rücken gerade, Griff zum Bauch ziehen, Schulterblätter zusammen."],
  lh_rudern: ["row_bb", "Langhantel", "Oberkörper weit vorgebeugt, Rücken gerade, Stange zum Bauchnabel."],
  enges_rudern: ["row_cable", "Kabelzug, sitzend", "Aufrecht sitzen, Griff zum Bauch ziehen, Brust raus."],
  kh_rudern: ["row_db", "Bank und Kurzhantel", "Eine Hand auf der Bank, Hantel zur Hüfte ziehen, Rumpf ruhig."],
  rueckenstrecker: ["hyperext", "Hyperextension-Bank", "Aus der Hüfte aufrichten bis zur geraden Linie, nicht überstrecken."],
  schulterdruecken: ["press", "Bank mit Lehne, Langhantel", "Rumpf fest, Stange senkrecht über den Kopf drücken."],
  seitheben: ["lateral", "Kurzhanteln", "Arme seitlich bis Schulterhöhe heben, Ellbogen leicht gebeugt."],
  butterfly_reverse: ["rearfly", "Butterfly-Maschine (umgekehrt)", "Brust ans Polster, Arme weit nach hinten öffnen."],
  face_pulls: ["facepull", "Kabelzug, Seil auf Kopfhöhe", "Seil zum Gesicht ziehen, Ellbogen hoch, Hände außen."],
  bizepscurls: ["curl", "Kurzhanteln", "Ellbogen am Körper, Hantel hochrollen, langsam ablassen."],
  hammercurls: ["curl", "Kurzhanteln, Neutralgriff", "Daumen zeigen nach oben, Ellbogen bleiben ruhig."],
  sz_curls: ["curl_bar", "SZ-Stange", "Ellbogen am Körper, nicht mit dem Rücken schwingen."],
  trizeps_pushdown: ["pushdown", "Kabelzug, oben", "Ellbogen fest an der Seite, Arme ganz strecken."],
  trizeps_overhead: ["overhead", "Kurzhantel oder Kabel", "Ellbogen zeigen nach oben, nur der Unterarm bewegt sich."],
  kniebeugen: ["squat", "Langhantel im Rack", "Hüfte nach hinten und unten, Knie folgen den Zehen, Rücken gerade."],
  beinpresse: ["legpress", "Beinpresse (45°)", "Rücken bleibt am Polster, Knie nicht ganz durchdrücken."],
  ausfallschritte: ["lunge", "Kurzhanteln", "Großer Schritt, hinteres Knie Richtung Boden, Oberkörper aufrecht."],
  beinstrecker: ["legext", "Beinstrecker-Maschine", "Beine ganz strecken, oben kurz halten, langsam ablassen."],
  rdl: ["rdl", "Langhantel", "Knie leicht gebeugt, Hüfte nach hinten schieben, Stange nah an den Beinen."],
  kreuzheben: ["deadlift", "Langhantel vom Boden", "Rücken gerade, aus den Beinen drücken, Stange am Körper."],
  beinbeuger: ["legcurl", "Beinbeuger-Maschine, liegend", "Fersen zum Gesäß ziehen, Hüfte bleibt am Polster."],
  hip_thrust: ["thrust", "Bank und Langhantel", "Schultern auf der Bank, Hüfte hochdrücken, oben Gesäß anspannen."],
  wadenheben: ["calf", "Stufe oder Wadenmaschine", "Ganz nach oben auf die Zehen, unten Ferse tief."],
  crunches: ["crunch", "Matte", "Schultern einrollen, unterer Rücken bleibt am Boden."],
  leg_raises: ["legraise", "Klimmzugstange", "Beine ohne Schwung nach vorne heben, Becken einrollen."],
  kabel_crunches: ["cablecrunch", "Kabelzug, kniend", "Seil am Kopf, Oberkörper einrollen, Hüfte bleibt ruhig."],
  bulgarian: ["bulgarian", "Bank und Kurzhanteln", "Hinterer Fuß auf der Bank, vorderes Bein trägt, Hüfte senkrecht absenken."],
  goblet: ["goblet", "Kurzhantel oder Kettlebell vor der Brust", "Hantel an der Brust, tief in die Hocke, Brust aufrecht."],
  step_ups: ["stepup", "Box oder Bank, Kurzhanteln", "Ganzer Fuß auf die Box, nur mit dem oberen Bein hochdrücken."],
  glute_bridge: ["bridge", "Matte, optional Gewicht", "Fersen nah am Gesäß, Hüfte hoch, oben anspannen."],
  kickback: ["kickback", "Kabelzug, unten, Fußschlaufe", "Bein gestreckt nach hinten, kein Hohlkreuz."],
  abduktoren: ["abduct", "Abduktoren-Maschine", "Knie gegen die Polster nach außen drücken, langsam zurück."],
  kb_swing: ["swing", "Kettlebell", "Explosiv aus der Hüfte, Arme sind nur Seile, Bell bis Brusthöhe."],
  box_jump: ["boxjump", "Sprungbox", "Mit Armschwung abspringen, weich und leise landen, heruntersteigen."],
  sprung_kb: ["jumpsquat", "Ohne Gerät", "Aus der Hocke explosiv hochspringen, weich landen."],
};
// Fallback für eigene Übungen: Vorlage nach Hauptmuskel
export const PATTERN_BY_MUSCLE = {brust: "bench", ruecken: "row_bb", schultern: "press", bizeps: "curl", trizeps: "pushdown", quads: "squat",
  hamstrings: "rdl", gluteus: "thrust", waden: "calf", bauch: "crunch", lrs: "hyperext"};

export const EXERCISES = RAW.map(([id, name, primary, secondary, step, unit]) =>
  ({id, name, primary, secondary, step, unit, custom: false}));

// Grundübungen (mehrgelenkig) als festes Merkmal. Eigene Übungen: mehrgelenkig, wenn mehr als ein Muskel beteiligt ist.
export const COMPOUND = new Set(["bulgarian", "goblet", "step_ups", "kb_swing", "box_jump", "sprung_kb", "bankdruecken", "schraegbank", "kh_bank", "dips", "liegestuetze", "latziehen", "klimmzuege", "tbar", "lh_rudern",
  "enges_rudern", "kh_rudern", "schulterdruecken", "kniebeugen", "beinpresse", "ausfallschritte", "rdl", "kreuzheben", "hip_thrust"]);
export const isCompound = e => e.custom ? (e.compound ?? e.primary.length + e.secondary.length > 1) : COMPOUND.has(e.id);
// Pausenstandard (Schoenfeld et al. 2016: 3 min > 1 min bei schweren Grundübungen; Grgic et al. 2018; Singer et al. 2024: ab ~90 s kaum Unterschied):
// schwere Grundübung (bis 8 Wdh.) 180 s, andere Grundübung 120 s, Isolationsübung 90 s.
export function defaultRest(e, maxReps) { return isCompound(e) ? (maxReps <= 8 ? 180 : 120) : 90; }

// Trainingsziele (ACSM Position Stand 2009, Ratamess et al.):
// Kraft/Muskelaufbau: 6–12 Wdh., 2–3 min Pause. Kraftausdauer: 15–25 Wdh., Pausen unter 1 min.
// Athletik (Schnellkraft): explosive Bewegungen, 3–6 Wdh. mit leichter bis mittlerer Last, 2–3 min Pause.
export const GOALS = [
  {id: "kraft", l: "Kraft & Muskeln", d: "6–12 Wiederholungen, 2–3 Minuten Pause. Für Kraft und Muskelaufbau."},
  {id: "ausdauer", l: "Kraftausdauer", d: "15–25 Wiederholungen, kurze Pausen unter einer Minute. Für Ausdauer der Muskeln und Fitness."},
  {id: "athletik", l: "Athletik", d: "Sprünge und explosive Übungen mit 3–6 Wiederholungen und langen Pausen, dazu Grundkraft. Für Schnellkraft und Sport."},
];

// Slot: [Übungs-ID, Sätze, Wdh. von, Wdh. bis, Pause in s (optional)]
export const TEMPLATES = [
  {
    id: "arnold", name: "Arnold Split", perWeek: 3, level: "Fortgeschritten", goal: "kraft",
    desc: "Klassischer Dreier-Split: Brust & Rücken, Schultern & Arme, Beine & Bauch, je 2 × 6–8. Bei 3 Trainings pro Woche ist das Volumen pro Muskel niedrig. Mit 6 Trainings pro Woche (Split zweimal) liegt es im empfohlenen Bereich.",
    days: [
      {name: "Brust & Rücken", slots: [["bankdruecken",2,6,8],["schraegbank",2,6,8],["latziehen",2,6,8],["tbar",2,6,8],["enges_rudern",2,6,8],["rueckenstrecker",2,6,8]]},
      {name: "Schultern & Arme", slots: [["schulterdruecken",2,6,8],["seitheben",2,6,8],["butterfly_reverse",2,6,8],["bizepscurls",2,6,8],["hammercurls",2,6,8],["trizeps_pushdown",2,6,8],["trizeps_overhead",2,6,8]]},
      {name: "Beine & Bauch", slots: [["beinstrecker",2,6,8],["beinbeuger",2,6,8],["beinpresse",2,6,8],["wadenheben",2,6,8],["crunches",2,6,8],["leg_raises",2,6,8]]},
    ],
  },
  {
    id: "ganzkoerper", name: "Ganzkörper A/B", perWeek: 3, level: "Einstieg", goal: "kraft",
    desc: "Zwei Ganzkörper-Tage im Wechsel, dreimal pro Woche. Jeder Muskel wird 1,5-mal pro Woche trainiert. Gut für den Einstieg und für wenig Zeit.",
    days: [
      {name: "Ganzkörper A", slots: [["kniebeugen",3,6,10],["bankdruecken",3,6,10],["lh_rudern",3,8,12],["rdl",3,8,12],["seitheben",2,12,15],["trizeps_pushdown",2,10,15],["kabel_crunches",2,10,15]]},
      {name: "Ganzkörper B", slots: [["beinpresse",3,10,15],["schraegbank",3,8,12],["latziehen",3,8,12],["hip_thrust",2,8,12],["schulterdruecken",2,8,12],["bizepscurls",2,10,15],["beinbeuger",2,10,15]]},
    ],
  },
  {
    id: "ok_uk", name: "Oberkörper / Unterkörper", perWeek: 4, level: "Fortgeschritten", goal: "kraft",
    desc: "Vier Tage pro Woche, jeder Muskel zweimal. Ein guter Mittelweg zwischen Volumen, Frequenz und Zeitaufwand.",
    days: [
      {name: "Oberkörper 1", slots: [["bankdruecken",3,6,8],["lh_rudern",3,6,10],["schulterdruecken",2,8,10],["latziehen",2,8,12],["bizepscurls",2,10,12],["trizeps_pushdown",2,10,12]]},
      {name: "Unterkörper 1", slots: [["kniebeugen",3,6,8],["rdl",3,8,10],["beinstrecker",2,10,15],["beinbeuger",2,10,15],["wadenheben",3,10,15],["kabel_crunches",2,10,15]]},
      {name: "Oberkörper 2", slots: [["schraegbank",3,8,10],["klimmzuege",3,6,10],["dips",3,8,12],["kh_rudern",2,8,12],["seitheben",3,12,15],["hammercurls",2,10,12],["trizeps_overhead",2,10,12]]},
      {name: "Unterkörper 2", slots: [["beinpresse",3,10,12],["hip_thrust",3,8,12],["ausfallschritte",2,10,12],["beinbeuger",2,10,15],["wadenheben",3,10,15],["leg_raises",2,8,15]]},
    ],
  },
  {
    id: "ppl", name: "Push / Pull / Beine", perWeek: 6, level: "Fortgeschritten", goal: "kraft",
    desc: "Drücken, Ziehen, Beine, zweimal pro Woche durchlaufen. Viel Volumen für erfahrene Leute. Mit 3 Trainings pro Woche halbiert sich das Volumen.",
    days: [
      {name: "Push", slots: [["bankdruecken",3,6,8],["schulterdruecken",3,8,10],["schraegbank",2,8,12],["seitheben",2,12,15],["trizeps_pushdown",2,10,12],["trizeps_overhead",2,10,12]]},
      {name: "Pull", slots: [["klimmzuege",3,6,10],["lh_rudern",3,8,10],["face_pulls",2,12,15],["bizepscurls",2,10,12],["hammercurls",2,10,12]]},
      {name: "Beine", slots: [["kniebeugen",3,6,8],["rdl",3,8,10],["beinpresse",2,10,15],["beinbeuger",2,10,15],["wadenheben",3,10,15],["kabel_crunches",2,10,15]]},
    ],
  },
  {
    id: "minimal", name: "Minimal: 2 × Ganzkörper", perWeek: 2, level: "Wenig Zeit", goal: "kraft",
    desc: "Zwei Trainings pro Woche à etwa 45 Minuten. Weniger als optimal, aber deutlich besser als nichts und leicht durchzuhalten.",
    days: [
      {name: "Ganzkörper", slots: [["kniebeugen",3,6,10],["bankdruecken",3,6,10],["latziehen",3,8,12],["rdl",2,8,12],["schulterdruecken",2,8,12],["lh_rudern",2,8,12]]},
    ],
  },
  {
    id: "glutes", name: "Gesäß & Beine Fokus", perWeek: 3, level: "Einstieg bis Fortgeschritten", goal: "kraft",
    desc: "Zwei Tage mit Schwerpunkt Gesäß und Beine, ein Oberkörper-Tag. Gesäß bekommt etwa 15 harte Sätze pro Woche, der Oberkörper bleibt mit dabei.",
    days: [
      {name: "Gesäß & Beinbeuger", slots: [["hip_thrust",4,8,12],["rdl",3,8,10],["bulgarian",3,8,12],["beinbeuger",3,10,15],["abduktoren",3,12,20]]},
      {name: "Oberkörper", slots: [["latziehen",3,8,12],["kh_bank",3,8,12],["enges_rudern",3,10,12],["seitheben",3,12,15],["face_pulls",2,12,15],["kabel_crunches",2,10,15]]},
      {name: "Gesäß & Quads", slots: [["goblet",3,8,12],["step_ups",3,10,12],["glute_bridge",3,12,15],["kickback",3,12,15],["beinstrecker",2,12,15],["wadenheben",3,10,15]]},
    ],
  },
  {
    id: "athletik", name: "Athletik Ganzkörper", perWeek: 3, level: "Fortgeschritten", goal: "athletik",
    desc: "Erst Sprünge und explosive Übungen ausgeruht, dann Grundkraft. Wenige Wiederholungen, volle Pausen. Für Schnellkraft, Sprungkraft und Sport.",
    days: [
      {name: "Athletik A", slots: [["box_jump",4,3,5,150],["kb_swing",3,6,8,120],["kniebeugen",4,3,6,180],["klimmzuege",3,4,6,150],["hip_thrust",3,6,8,120],["leg_raises",2,8,12,60]]},
      {name: "Athletik B", slots: [["sprung_kb",4,3,5,150],["kreuzheben",3,3,5,180],["schulterdruecken",3,4,6,150],["bulgarian",3,5,8,120],["lh_rudern",3,6,8,120],["kabel_crunches",2,10,12,60]]},
    ],
  },
  {
    id: "zirkel", name: "Kraftausdauer Ganzkörper", perWeek: 3, level: "Einstieg", goal: "ausdauer",
    desc: "Viele Wiederholungen, kurze Pausen von 45 Sekunden. Trainiert Kraftausdauer und Fitness, gut zum Einstieg und für zu Hause mit wenig Gerät.",
    days: [
      {name: "Zirkel A", slots: [["goblet",3,15,20,45],["liegestuetze",3,10,20,45],["latziehen",3,15,20,45],["step_ups",3,12,15,45],["glute_bridge",3,15,25,45],["crunches",3,15,25,30]]},
      {name: "Zirkel B", slots: [["ausfallschritte",3,12,16,45],["kh_bank",3,15,20,45],["enges_rudern",3,15,20,45],["kb_swing",3,15,20,45],["seitheben",3,15,20,30],["kabel_crunches",3,15,20,30]]},
    ],
  },
];

/* Körpermaße: Messstellen mit Anleitung. y = Höhe der Messlinie in der Figur (viewBox 0–200 × 0–420), x/w = Lage und Breite.
   Taille und Hüfte nach WHO (2008, Expert Consultation „Waist circumference and waist–hip ratio“),
   die übrigen Stellen nach gängigem anthropometrischen Vorgehen (ISAK). */
export const MEASURES = [
  {id: "hals", l: "Hals", y: 62, x: 91, w: 18, how: "Direkt unter dem Kehlkopf, Band leicht nach vorn unten geneigt. Kopf gerade, Schultern locker."},
  {id: "schulter", l: "Schultern", y: 90, x: 44, w: 112, how: "Um die breiteste Stelle der Schultermuskeln, Arme locker hängen lassen. Band waagerecht."},
  {id: "brust", l: "Brust", y: 112, x: 54, w: 92, how: "Auf Höhe der Brustwarzen, unter den Achseln durch. Nach normalem Ausatmen messen, nicht einziehen."},
  {id: "arm", l: "Oberarm", y: 126, x: 32, w: 22, side: true, how: "Rechter Arm, angespannt: Faust zur Schulter, an der dicksten Stelle des Bizeps. Immer denselben Arm messen."},
  {id: "taille", l: "Taille", y: 160, x: 66, w: 68, how: "Mitte zwischen unterster Rippe und Oberkante des Beckenknochens (WHO), meist knapp über dem Bauchnabel. Nach normalem Ausatmen, Bauch nicht einziehen."},
  {id: "huefte", l: "Hüfte", y: 200, x: 60, w: 80, how: "Um die breiteste Stelle des Gesäßes (WHO), Füße zusammen. Band waagerecht, von der Seite prüfen."},
  {id: "oberschenkel", l: "Oberschenkel", y: 246, x: 67, w: 26, side: true, how: "Rechtes Bein, knapp unter der Gesäßfalte an der dicksten Stelle. Gewicht auf beide Beine, Muskel locker."},
  {id: "wade", l: "Wade", y: 330, x: 65, w: 22, side: true, how: "Rechtes Bein, an der dicksten Stelle der Wade. Stehend, Gewicht auf beiden Beinen."},
];
