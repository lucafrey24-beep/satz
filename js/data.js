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
  // ab 0.10: Studio-Varianten (Maschinen, Kabel)
  ["brustpresse", "Brustpresse (Maschine)", ["brust"], ["trizeps", "schultern"], 5, "kg"],
  ["kabel_crossover", "Kabel-Crossover", ["brust"], [], 2.5, "kg"],
  ["schulterpresse", "Schulterpresse (Maschine)", ["schultern"], ["trizeps"], 5, "kg"],
  ["kabel_seitheben", "Kabel-Seitheben", ["schultern"], [], 1.25, "kg"],
  ["rudermaschine", "Rudermaschine, brustgestützt", ["ruecken"], ["bizeps"], 5, "kg"],
  ["latziehen_eng", "Latziehen eng, Untergriff", ["ruecken"], ["bizeps"], 2.5, "kg"],
  ["ueberzuege_kabel", "Überzüge am Kabel", ["ruecken"], [], 2.5, "kg"],
  ["scottcurls", "Scottcurls", ["bizeps"], [], 2.5, "kg"],
  ["kabelcurls", "Kabelcurls", ["bizeps"], [], 2.5, "kg"],
  ["trizeps_seil_overhead", "Trizeps über Kopf am Seil", ["trizeps"], [], 2.5, "kg"],
  ["french_press", "French Press (SZ-Stange)", ["trizeps"], [], 2.5, "kg"],
  ["hackenschmidt", "Hackenschmidt-Kniebeuge", ["quads"], ["gluteus"], 5, "kg"],
  ["frontkniebeuge", "Frontkniebeuge", ["quads", "gluteus"], ["bauch"], 2.5, "kg"],
  ["beinbeuger_sitzend", "Beinbeuger sitzend", ["hamstrings"], [], 2.5, "kg"],
  // ab 0.10: zu Hause mit Kurzhanteln
  ["kh_schraegbank", "Kurzhantel-Schrägbankdrücken", ["brust"], ["schultern", "trizeps"], 2, "kg"],
  ["kh_floorpress", "Kurzhantel-Bodendrücken", ["brust"], ["trizeps"], 2, "kg"],
  ["kh_fliegende", "Kurzhantel-Fliegende", ["brust"], [], 1, "kg"],
  ["kh_pullover", "Kurzhantel-Pullover", ["ruecken"], ["brust"], 2, "kg"],
  ["kh_rudern_beid", "Kurzhantelrudern vorgebeugt", ["ruecken"], ["bizeps", "lrs"], 2, "kg"],
  ["kh_schulterdruecken", "Kurzhantel-Schulterdrücken", ["schultern"], ["trizeps"], 2, "kg"],
  ["arnold_press", "Arnold Press", ["schultern"], ["trizeps"], 2, "kg"],
  ["kh_reverse_fly", "Reverse Flys vorgebeugt", ["schultern"], ["ruecken"], 1, "kg"],
  ["kh_rdl", "Rumänisches Kreuzheben mit Kurzhanteln", ["hamstrings", "gluteus"], ["lrs"], 2, "kg"],
  ["kh_rdl_einbeinig", "Einbeiniges Kreuzheben", ["hamstrings", "gluteus"], [], 2, "kg"],
  ["rueckw_ausfall", "Rückwärts-Ausfallschritte", ["quads", "gluteus"], ["hamstrings"], 2, "kg"],
  // ab 0.10: ohne Gerät oder mit Klimmzugstange
  ["chinups", "Klimmzüge im Untergriff", ["ruecken", "bizeps"], [], 2.5, "bw"],
  ["kniebeuge_kg", "Kniebeuge ohne Gewicht", ["quads", "gluteus"], [], 2.5, "bw"],
  ["split_squat", "Split Squat", ["quads", "gluteus"], ["hamstrings"], 2, "bw"],
  ["bridge_einbeinig", "Glute Bridge einbeinig", ["gluteus"], ["hamstrings"], 2.5, "bw"],
  ["waden_einbeinig", "Wadenheben einbeinig", ["waden"], [], 2.5, "bw"],
  ["liegestuetze_eng", "Enge Liegestütze", ["trizeps", "brust"], ["schultern"], 2.5, "bw"],
  ["liegestuetze_erhoeht", "Liegestütze mit erhöhten Händen", ["brust"], ["trizeps", "schultern"], 2.5, "bw"],
  ["pike_liegestuetze", "Pike-Liegestütze", ["schultern"], ["trizeps"], 2.5, "bw"],
  ["bank_dips", "Dips an der Bank", ["trizeps"], ["brust", "schultern"], 2.5, "bw"],
  ["tischrudern", "Rudern unter dem Tisch", ["ruecken"], ["bizeps"], 2.5, "bw"],
  ["superman", "Superman", ["lrs"], ["gluteus"], 2.5, "bw"],
  ["reverse_crunch", "Reverse Crunches", ["bauch"], [], 2.5, "bw"],
];
// Wo geht die Übung? studio = braucht Studio-Geräte, kh = Kurzhanteln oder Kettlebell (zu Hause möglich),
// stange = Klimmzugstange, ohne = ohne Gerät (Boden, Stufe, Stuhl). Eigene Übungen haben kein Merkmal.
// Nur ein Filter beim Suchen: gespeicherte Übungen bekommen dafür kein neues Feld.
export const KIT_LABEL = {studio: "Studio", kh: "Kurzhanteln", stange: "Klimmzugstange", ohne: "Ohne Gerät"};
export const KIT_FILTERS = [
  {id: "", l: "Alle Geräte"}, {id: "studio", l: "Studio"}, {id: "zuhause", l: "Zu Hause"},
  {id: "kh", l: "Kurzhanteln"}, {id: "ohne", l: "Ohne Gerät"},
];
const KIT_GROUPS = {
  kh: "kh_bank seitheben kh_rudern bizepscurls hammercurls trizeps_overhead ausfallschritte bulgarian goblet step_ups kb_swing kh_schraegbank kh_floorpress kh_fliegende kh_pullover kh_rudern_beid kh_schulterdruecken arnold_press kh_reverse_fly kh_rdl kh_rdl_einbeinig rueckw_ausfall",
  stange: "klimmzuege leg_raises chinups",
  ohne: "liegestuetze wadenheben crunches glute_bridge box_jump sprung_kb kniebeuge_kg split_squat bridge_einbeinig waden_einbeinig liegestuetze_eng liegestuetze_erhoeht pike_liegestuetze bank_dips tischrudern superman reverse_crunch",
};
export const KIT = {};
for (const [k, ids] of Object.entries(KIT_GROUPS)) ids.split(" ").forEach(id => KIT[id] = k);
RAW.forEach(r => { if (!KIT[r[0]]) KIT[r[0]] = "studio"; });
export function kitMatch(e, f) {
  if (!f) return true;
  const k = e.custom ? "" : KIT[e.id];
  if (!k) return false;
  return f === "zuhause" ? k !== "studio" : k === f;
}
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
  brustpresse: ["chestpress", "Brustpresse-Maschine", "Griffe auf Brusthöhe, Schulterblätter am Polster, Arme nicht ganz durchdrücken."],
  kabel_crossover: ["crossover", "Kabelzug, beide Seiten oben", "Leicht vorgebeugt, Arme leicht gebeugt in einem Bogen vor dem Körper zusammenführen."],
  schulterpresse: ["press_machine", "Schulterpresse-Maschine", "Rücken an der Lehne, Griffe senkrecht nach oben drücken, langsam ablassen."],
  kabel_seitheben: ["lateral_cable", "Kabelzug, unten", "Seitlich zum Kabel stehen, Arm bis Schulterhöhe heben, ohne Schwung."],
  rudermaschine: ["row_machine", "Rudermaschine mit Brustpolster", "Brust am Polster, Ellbogen nah am Körper nach hinten ziehen."],
  latziehen_eng: ["latpull", "Latzug-Maschine, enger Griff", "Handflächen zu dir, Stange zur Brust, Ellbogen eng nach unten."],
  ueberzuege_kabel: ["straightarm", "Kabelzug, oben, Stange oder Seil", "Arme fast gestreckt, Griff in einem Bogen bis zu den Oberschenkeln ziehen."],
  scottcurls: ["preacher", "Scottbank mit SZ-Stange", "Oberarme ganz auf dem Polster, unten nicht ganz durchstrecken."],
  kabelcurls: ["curl_cable", "Kabelzug, unten", "Ellbogen am Körper, Griff hochrollen, langsam ablassen."],
  trizeps_seil_overhead: ["overhead_cable", "Kabelzug mit Seil, Rücken zum Turm", "Ellbogen zeigen nach vorn oben, nur die Unterarme strecken."],
  french_press: ["skull", "Flachbank mit SZ-Stange", "Ellbogen bleiben über der Schulter, Stange zur Stirn senken."],
  hackenschmidt: ["hack", "Hackenschmidt-Maschine", "Rücken am Polster, tief beugen, Knie folgen den Zehen."],
  frontkniebeuge: ["frontsquat", "Langhantel vorn auf den Schultern", "Ellbogen hoch, Oberkörper aufrecht, tief in die Hocke."],
  beinbeuger_sitzend: ["legcurl_seat", "Beinbeuger-Maschine, sitzend", "Oberschenkel fixiert, Fersen unter den Sitz ziehen, langsam zurück."],
  kh_schraegbank: ["incline_db", "Schrägbank mit Kurzhanteln", "Bank auf 30–45°, Hanteln zur oberen Brust absenken."],
  kh_floorpress: ["floorpress", "Boden und Kurzhanteln", "Auf dem Rücken, Knie gebeugt. Oberarme bis zum Boden, dann hochdrücken."],
  kh_fliegende: ["fly_db", "Flachbank oder Boden, Kurzhanteln", "Arme leicht gebeugt weit öffnen, bis Dehnung in der Brust, dann zusammenführen."],
  kh_pullover: ["pullover", "Flachbank, eine Kurzhantel", "Hantel mit beiden Händen hinter den Kopf senken, Arme fast gestreckt, zurück über die Brust."],
  kh_rudern_beid: ["row_dbs", "Zwei Kurzhanteln", "Oberkörper vorgebeugt, Rücken gerade, Hanteln zur Hüfte ziehen."],
  kh_schulterdruecken: ["press_db", "Bank mit Lehne oder Stuhl, Kurzhanteln", "Hanteln von Schulterhöhe senkrecht nach oben drücken, Rumpf fest."],
  arnold_press: ["press_db", "Bank mit Lehne, Kurzhanteln", "Unten Handflächen zu dir, beim Drücken nach außen drehen."],
  kh_reverse_fly: ["rearfly_db", "Kurzhanteln, vorgebeugt", "Oberkörper fast waagerecht, Arme seitlich bis Schulterhöhe öffnen."],
  kh_rdl: ["rdl_db", "Kurzhanteln", "Knie leicht gebeugt, Hüfte nach hinten, Hanteln nah an den Beinen."],
  kh_rdl_einbeinig: ["rdl_db", "Eine oder zwei Kurzhanteln", "Auf einem Bein, das andere geht gestreckt nach hinten. Hüfte bleibt gerade."],
  rueckw_ausfall: ["lunge", "Kurzhanteln", "Großer Schritt nach hinten, vorderes Knie über dem Fuß, zurück in den Stand."],
  chinups: ["pullup", "Klimmzugstange, Untergriff", "Handflächen zu dir, Brust zur Stange, kontrolliert ablassen."],
  kniebeuge_kg: ["airsquat", "Ohne Gerät", "Arme nach vorn, Hüfte nach hinten und unten, Fersen bleiben am Boden."],
  split_squat: ["splitsquat", "Ohne Gerät", "Füße versetzt, hinteres Knie Richtung Boden, Gewicht auf dem vorderen Bein."],
  bridge_einbeinig: ["bridge", "Matte", "Ein Bein angewinkelt, das andere gestreckt. Hüfte hoch, Becken gerade."],
  waden_einbeinig: ["calf_bw", "Stufe, an der Wand festhalten", "Auf einem Fuß, Ferse tief unter die Stufe, dann ganz hoch."],
  liegestuetze_eng: ["pushup", "Boden, ohne Gerät", "Hände eng unter der Brust, Ellbogen nah am Körper."],
  liegestuetze_erhoeht: ["pushup_incline", "Bank, Tisch oder Stuhl", "Hände auf der Erhöhung, Körper gerade. Leichter als Liegestütze am Boden."],
  pike_liegestuetze: ["pike", "Boden, ohne Gerät", "Hüfte hoch wie ein umgedrehtes V, Kopf zwischen die Hände senken."],
  bank_dips: ["benchdip", "Bank oder stabiler Stuhl", "Hände hinter dir auf der Kante, Oberarme bis etwa waagerecht senken."],
  tischrudern: ["invrow", "Stabiler Tisch oder tiefe Stange", "Körper gerade unter der Kante, Brust zur Kante ziehen."],
  superman: ["superman", "Matte", "Auf dem Bauch, Arme und Beine gleichzeitig leicht anheben, kurz halten."],
  reverse_crunch: ["revcrunch", "Matte", "Knie zur Brust ziehen, Becken vom Boden einrollen, langsam ablassen."],
};
// Fallback für eigene Übungen: Vorlage nach Hauptmuskel
export const PATTERN_BY_MUSCLE = {brust: "bench", ruecken: "row_bb", schultern: "press", bizeps: "curl", trizeps: "pushdown", quads: "squat",
  hamstrings: "rdl", gluteus: "thrust", waden: "calf", bauch: "crunch", lrs: "hyperext"};

export const EXERCISES = RAW.map(([id, name, primary, secondary, step, unit]) =>
  ({id, name, primary, secondary, step, unit, custom: false}));

// Grundübungen (mehrgelenkig) als festes Merkmal. Eigene Übungen: mehrgelenkig, wenn mehr als ein Muskel beteiligt ist.
export const COMPOUND = new Set(["brustpresse", "schulterpresse", "rudermaschine", "latziehen_eng", "hackenschmidt", "frontkniebeuge", "kh_schraegbank", "kh_floorpress",
  "kh_rudern_beid", "kh_schulterdruecken", "arnold_press", "kh_rdl", "kh_rdl_einbeinig", "rueckw_ausfall", "chinups", "kniebeuge_kg", "split_squat",
  "liegestuetze_eng", "liegestuetze_erhoeht", "pike_liegestuetze", "bank_dips", "tischrudern", "bulgarian", "goblet", "step_ups", "kb_swing", "box_jump", "sprung_kb", "bankdruecken", "schraegbank", "kh_bank", "dips", "liegestuetze", "latziehen", "klimmzuege", "tbar", "lh_rudern",
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
