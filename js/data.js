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
];
export const EXERCISES = RAW.map(([id, name, primary, secondary, step, unit]) =>
  ({id, name, primary, secondary, step, unit, custom: false}));

// Grundübungen (mehrgelenkig) als festes Merkmal. Eigene Übungen: mehrgelenkig, wenn mehr als ein Muskel beteiligt ist.
export const COMPOUND = new Set(["bankdruecken", "schraegbank", "kh_bank", "dips", "liegestuetze", "latziehen", "klimmzuege", "tbar", "lh_rudern",
  "enges_rudern", "kh_rudern", "schulterdruecken", "kniebeugen", "beinpresse", "ausfallschritte", "rdl", "kreuzheben", "hip_thrust"]);
export const isCompound = e => e.custom ? (e.compound ?? e.primary.length + e.secondary.length > 1) : COMPOUND.has(e.id);
// Pausenstandard (Schoenfeld et al. 2016: 3 min > 1 min bei schweren Grundübungen; Grgic et al. 2018; Singer et al. 2024: ab ~90 s kaum Unterschied):
// schwere Grundübung (bis 8 Wdh.) 180 s, andere Grundübung 120 s, Isolationsübung 90 s.
export function defaultRest(e, maxReps) { return isCompound(e) ? (maxReps <= 8 ? 180 : 120) : 90; }

// Slot: [Übungs-ID, Sätze, Wdh. von, Wdh. bis]
export const TEMPLATES = [
  {
    id: "arnold", name: "Arnold Split", perWeek: 3, level: "Fortgeschritten",
    desc: "Klassischer Dreier-Split: Brust & Rücken, Schultern & Arme, Beine & Bauch, je 2 × 6–8. Bei 3 Trainings pro Woche ist das Volumen pro Muskel niedrig. Mit 6 Trainings pro Woche (Split zweimal) liegt es im empfohlenen Bereich.",
    days: [
      {name: "Brust & Rücken", slots: [["bankdruecken",2,6,8],["schraegbank",2,6,8],["latziehen",2,6,8],["tbar",2,6,8],["enges_rudern",2,6,8],["rueckenstrecker",2,6,8]]},
      {name: "Schultern & Arme", slots: [["schulterdruecken",2,6,8],["seitheben",2,6,8],["butterfly_reverse",2,6,8],["bizepscurls",2,6,8],["hammercurls",2,6,8],["trizeps_pushdown",2,6,8],["trizeps_overhead",2,6,8]]},
      {name: "Beine & Bauch", slots: [["beinstrecker",2,6,8],["beinbeuger",2,6,8],["beinpresse",2,6,8],["wadenheben",2,6,8],["crunches",2,6,8],["leg_raises",2,6,8]]},
    ],
  },
  {
    id: "ganzkoerper", name: "Ganzkörper A/B", perWeek: 3, level: "Einstieg",
    desc: "Zwei Ganzkörper-Tage im Wechsel, dreimal pro Woche. Jeder Muskel wird 1,5-mal pro Woche trainiert. Gut für den Einstieg und für wenig Zeit.",
    days: [
      {name: "Ganzkörper A", slots: [["kniebeugen",3,6,10],["bankdruecken",3,6,10],["lh_rudern",3,8,12],["rdl",3,8,12],["seitheben",2,12,15],["trizeps_pushdown",2,10,15],["kabel_crunches",2,10,15]]},
      {name: "Ganzkörper B", slots: [["beinpresse",3,10,15],["schraegbank",3,8,12],["latziehen",3,8,12],["hip_thrust",2,8,12],["schulterdruecken",2,8,12],["bizepscurls",2,10,15],["beinbeuger",2,10,15]]},
    ],
  },
  {
    id: "ok_uk", name: "Oberkörper / Unterkörper", perWeek: 4, level: "Fortgeschritten",
    desc: "Vier Tage pro Woche, jeder Muskel zweimal. Ein guter Mittelweg zwischen Volumen, Frequenz und Zeitaufwand.",
    days: [
      {name: "Oberkörper 1", slots: [["bankdruecken",3,6,8],["lh_rudern",3,6,10],["schulterdruecken",2,8,10],["latziehen",2,8,12],["bizepscurls",2,10,12],["trizeps_pushdown",2,10,12]]},
      {name: "Unterkörper 1", slots: [["kniebeugen",3,6,8],["rdl",3,8,10],["beinstrecker",2,10,15],["beinbeuger",2,10,15],["wadenheben",3,10,15],["kabel_crunches",2,10,15]]},
      {name: "Oberkörper 2", slots: [["schraegbank",3,8,10],["klimmzuege",3,6,10],["dips",3,8,12],["kh_rudern",2,8,12],["seitheben",3,12,15],["hammercurls",2,10,12],["trizeps_overhead",2,10,12]]},
      {name: "Unterkörper 2", slots: [["beinpresse",3,10,12],["hip_thrust",3,8,12],["ausfallschritte",2,10,12],["beinbeuger",2,10,15],["wadenheben",3,10,15],["leg_raises",2,8,15]]},
    ],
  },
  {
    id: "ppl", name: "Push / Pull / Beine", perWeek: 6, level: "Fortgeschritten",
    desc: "Drücken, Ziehen, Beine, zweimal pro Woche durchlaufen. Viel Volumen für erfahrene Leute. Mit 3 Trainings pro Woche halbiert sich das Volumen.",
    days: [
      {name: "Push", slots: [["bankdruecken",3,6,8],["schulterdruecken",3,8,10],["schraegbank",2,8,12],["seitheben",2,12,15],["trizeps_pushdown",2,10,12],["trizeps_overhead",2,10,12]]},
      {name: "Pull", slots: [["klimmzuege",3,6,10],["lh_rudern",3,8,10],["face_pulls",2,12,15],["bizepscurls",2,10,12],["hammercurls",2,10,12]]},
      {name: "Beine", slots: [["kniebeugen",3,6,8],["rdl",3,8,10],["beinpresse",2,10,15],["beinbeuger",2,10,15],["wadenheben",3,10,15],["kabel_crunches",2,10,15]]},
    ],
  },
  {
    id: "minimal", name: "Minimal: 2 × Ganzkörper", perWeek: 2, level: "Wenig Zeit",
    desc: "Zwei Trainings pro Woche à etwa 45 Minuten. Weniger als optimal, aber deutlich besser als nichts und leicht durchzuhalten.",
    days: [
      {name: "Ganzkörper", slots: [["kniebeugen",3,6,10],["bankdruecken",3,6,10],["latziehen",3,8,12],["rdl",2,8,12],["schulterdruecken",2,8,12],["lh_rudern",2,8,12]]},
    ],
  },
];
