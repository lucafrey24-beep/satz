// Animierte Übungsausführung: selbst gezeichnete Strichfigur mit Gerät, eine Vorlage pro Bewegungsmuster.
// Jede Vorlage hat zwei Posen (Start A, Ende B). Arme und Beine werden per inverser Kinematik zwischen Gelenk und Zielpunkt gerechnet,
// so bleiben Hände an der Stange und Füße am Boden. Bei „Bewegung reduzieren“ zeigt die Grafik beide Posen still übereinander.

const L = {t: 30, ua: 15, fa: 14, th: 20, sh: 19, ft: 7};
const R = Math.PI / 180;
const dir = (deg, len) => [Math.cos(deg * R) * len, Math.sin(deg * R) * len];
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const lerp = (a, b, k) => a + (b - a) * k;
const lerpP = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
// Zwei-Glied-IK: Basis P, Ziel T, Längen a, b, Beugerichtung s (+1/-1). Gibt [Mittelgelenk, Endpunkt].
function ik(P, T, a, b, s) {
  let dx = T[0] - P[0], dy = T[1] - P[1], d = Math.hypot(dx, dy) || 0.001;
  const dd = Math.min(a + b - 0.01, Math.max(Math.abs(a - b) + 0.01, d));
  const base = Math.atan2(dy, dx), cosA = (a * a + dd * dd - b * b) / (2 * a * dd);
  const al = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const mid = [P[0] + Math.cos(base + s * al) * a, P[1] + Math.sin(base + s * al) * a];
  return [mid, [P[0] + Math.cos(base) * dd, P[1] + Math.sin(base) * dd]];
}

/* ---------- Seitenansicht ---------- */
function sideJoints(p) {
  const hip = p.hip, sho = add(hip, dir(p.t, L.t)), neck = add(sho, dir(p.t, 4)), head = add(neck, dir(p.t + (p.nod || 0), 6));
  const [elb, hand] = ik(sho, p.hand, L.ua, L.fa, p.hs ?? 1);
  const [knee, ank] = ik(hip, p.foot, L.th, L.sh, p.fs ?? -1);
  const toe = add(ank, dir(p.ft ?? 0, L.ft));
  const J = {hip, sho, neck, head, elb, hand, knee, ank, toe};
  if (p.foot2) { const [k2, a2] = ik(hip, p.foot2, L.th, L.sh, p.fs2 ?? p.fs ?? -1); J.knee2 = k2; J.ank2 = a2; J.toe2 = add(a2, dir(p.ft2 ?? 0, L.ft)); }
  return J;
}
function lerpPose(A, B, k) {
  const o = {};
  for (const key of Object.keys(B)) {
    const b = B[key], a = A[key] ?? b;
    o[key] = Array.isArray(a) ? lerpP(a, b, k) : typeof a === "number" ? lerp(a, b, k) : a;
  }
  return o;
}
const ln = (a, b, cls) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" class="${cls}"/>`;
const dot = (p, r, cls) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${r}" class="${cls}"/>`;
// Körper mit Volumen: jedes Glied hat eine eigene Dicke (Klassen w-…), aktive Muskeln in Akzentfarbe
const hi = (on, ...ms) => ms.some(m => on.includes(m)) ? " hi" : "";
function drawSide(J, on) {
  const torso = hi(on, "brust", "ruecken", "bauch", "lrs"), ua = hi(on, "bizeps", "trizeps", "schultern"), fa = "";
  const th = hi(on, "quads", "hamstrings"), shin = hi(on, "waden");
  // Rumpf als Brustkorb + Becken: Mitte etwas zur Brust hin verdickt
  const mid = lerpP(J.hip, J.sho, 0.62);
  let s = "";
  if (J.knee2) s += ln(J.hip, J.knee2, "b w-th far" + th) + ln(J.knee2, J.ank2, "b w-sh far" + shin) + ln(J.ank2, J.toe2, "b w-ft far");
  s += ln(J.hip, J.sho, "b w-tr" + torso) + ln(mid, J.sho, "b w-ch" + torso) + ln(J.sho, J.neck, "b w-nk") + dot(J.head, 6.2, "hd");
  s += ln(J.hip, J.knee, "b w-th" + th) + ln(J.knee, J.ank, "b w-sh" + shin) + ln(J.ank, J.toe, "b w-ft");
  if (on.includes("gluteus")) s += dot(J.hip, 5.2, "gl");
  s += ln(J.sho, J.elb, "b w-ua" + ua) + ln(J.elb, J.hand, "b w-fa" + fa) + dot(J.hand, 2.4, "hand");
  return s;
}

/* ---------- Frontansicht ---------- */
function frontJoints(p) {
  const c = p.cx ?? 80, hipY = p.hipY ?? 70, shoY = hipY - 28;
  const J = {pel: [c, hipY], neck: [c, shoY - 3], head: [c, shoY - 11], shoL: [c - 11, shoY], shoR: [c + 11, shoY], hipL: [c - 6, hipY], hipR: [c + 6, hipY]};
  const hand = p.hand, foot = p.foot;
  [J.elbR, J.handR] = ik(J.shoR, [c + hand[0], hand[1]], L.ua, L.fa, p.hs ?? 1);
  [J.elbL, J.handL] = ik(J.shoL, [c - hand[0], hand[1]], L.ua, L.fa, -(p.hs ?? 1));
  [J.kneeR, J.ankR] = ik(J.hipR, [c + foot[0], foot[1]], L.th, L.sh, p.fs ?? -1);
  [J.kneeL, J.ankL] = ik(J.hipL, [c - foot[0], foot[1]], L.th, L.sh, -(p.fs ?? -1));
  return J;
}
function drawFront(J, on) {
  const torso = hi(on, "brust", "ruecken", "bauch"), sh = hi(on, "schultern"), leg = hi(on, "quads", "hamstrings", "gluteus");
  const chest = [J.pel[0], J.pel[1] - 16];
  return ln(J.pel, J.neck, "b w-tr" + torso) + ln(chest, J.neck, "b w-chf" + torso) + ln(J.shoL, J.shoR, "b w-ua" + torso) + ln(J.hipL, J.hipR, "b w-th") + dot(J.head, 6.2, "hd")
    + ln(J.shoR, J.elbR, "b w-ua" + sh) + ln(J.elbR, J.handR, "b w-fa") + ln(J.shoL, J.elbL, "b w-ua" + sh) + ln(J.elbL, J.handL, "b w-fa")
    + dot(J.handR, 2.4, "hand") + dot(J.handL, 2.4, "hand")
    + ln(J.hipR, J.kneeR, "b w-th" + leg) + ln(J.kneeR, J.ankR, "b w-sh") + ln(J.hipL, J.kneeL, "b w-th" + leg) + ln(J.kneeL, J.ankL, "b w-sh");
}

/* ---------- Geräte und Gewichte ---------- */
const rect = (x, y, w, h, cls = "eq") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" class="${cls}"/>`;
const line = (x1, y1, x2, y2, cls = "eql") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}"/>`;
const plate = (p, r = 6.5) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${r}" class="ld"/><circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="1.5" class="hub"/>`;
const db = p => `<rect x="${(p[0] - 5).toFixed(1)}" y="${(p[1] - 2.5).toFixed(1)}" width="10" height="5" rx="2" class="ld"/>`;
const kb = p => `<circle cx="${p[0].toFixed(1)}" cy="${(p[1] + 5).toFixed(1)}" r="5" class="ld"/>`;
const cable = (from, p) => line(from[0], from[1], p[0].toFixed(1), p[1].toFixed(1), "cbl") + `<circle cx="${from[0]}" cy="${from[1]}" r="3" class="eq"/>`;
const stack = (x, top) => rect(x - 4, top, 8, 108 - top, "eq2");
const bench = (x1, x2, y) => rect(x1, y, x2 - x1, 4) + line(x1 + 4, y + 4, x1 + 4, 108) + line(x2 - 4, y + 4, x2 - 4, 108);
const floor = (y = 108) => line(4, y, 156, y, "fl");
const band = (a, b) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" class="bnd"/>`;
const wall = x => rect(x, 4, 5, 104, "eq2");

/* ---------- Vorlagen ---------- */
// A/B: hip, t (Rumpfwinkel, -90 = aufrecht), hand, foot (Knöchel), hs/fs Beugerichtung, ft Fußwinkel, foot2 zweites Bein
const P = {
  bench: {A: {hip: [72, 76], t: 180, hand: [40, 68], hs: -1, foot: [96, 106], fs: -1, ft: 0}, B: {hand: [42, 46]},
    eq: J => bench(26, 84, 80) + line(36, 108, 36, 40, "eql") + plate(J.hand)},
  bench_db: {base: "bench", eq: J => bench(26, 84, 80) + db(J.hand)},
  incline: {A: {hip: [76, 80], t: 215, hand: [54, 56], hs: -1, foot: [98, 106], fs: -1}, B: {hand: [48, 32]},
    eq: J => line(78, 84, 46, 62, "eqt") + bench(66, 90, 84) + plate(J.hand)},
  fly: {front: true, A: {hand: [34, 50], hs: 1, foot: [10, 106], hipY: 74}, B: {hand: [6, 56]},
    eq: () => rect(64, 34, 32, 42, "eq2") + line(46, 18, 46, 108) + line(114, 18, 114, 108)},
  pushup: {A: {hip: [74, 96], t: -8, hand: [106, 106], hs: -1, foot: [40, 106], fs: 1, ft: 90}, B: {hip: [76, 88], t: -24}, eq: () => ""},
  dips: {floorY: 119, A: {hip: [83, 76], t: -95, hand: [86, 70], hs: 1, foot: [76, 108], fs: 1, ft: 80}, B: {hip: [88, 90], t: -108, foot: [80, 120], ft: 70},
    eq: () => line(66, 70, 106, 70, "eqt") + line(70, 70, 70, 120) + line(102, 70, 102, 120)},
  pullup: {floorY: 119, A: {hip: [84, 76], t: -91, hand: [86, 16], hs: 1, foot: [72, 104], fs: 1}, B: {hip: [84, 58], foot: [72, 86]},
    eq: () => line(60, 14, 112, 14, "eqt") + line(64, 14, 64, 120) + line(108, 14, 108, 120)},
  latpull: {A: {hip: [76, 82], t: -92, hand: [82, 22], hs: 1, foot: [100, 106], fs: -1}, B: {hand: [80, 50]},
    eq: J => rect(60, 84, 30, 4) + line(66, 88, 66, 108) + rect(84, 66, 14, 5, "eq2") + stack(40, 14) + line(40, 8, 90, 8) + cable([90, 8], J.hand) + line(J.hand[0] - 14, J.hand[1], J.hand[0] + 6, J.hand[1], "eqt")},
  row_bb: {A: {hip: [84, 66], t: -32, hand: [110, 92], hs: -1, foot: [90, 106], fs: -1}, B: {hand: [100, 70]}, eq: J => plate(J.hand, 8)},
  row_tbar: {base: "row_bb", eq: J => line(30, 106, J.hand[0].toFixed(1), J.hand[1].toFixed(1), "eqt") + plate(J.hand, 8)},
  row_db: {A: {hip: [80, 64], t: -18, hand: [104, 90], hs: -1, foot: [84, 106], fs: -1}, B: {hand: [94, 70]},
    eq: J => bench(100, 140, 78) + db(J.hand)},
  row_cable: {A: {hip: [60, 92], t: -86, hand: [98, 76], hs: -1, foot: [96, 98], fs: -1}, B: {t: -96, hand: [72, 74]},
    eq: J => rect(40, 94, 40, 4) + rect(98, 90, 6, 18, "eq2") + stack(132, 40) + cable([128, 76], J.hand)},
  hyperext: {A: {hip: [80, 60], t: 100, hand: [74, 82], hs: 1, foot: [42, 80], fs: 1, ft: 90}, B: {t: -12, hand: [104, 58]},
    eq: () => line(84, 64, 50, 86, "eqt") + rect(76, 60, 12, 6, "eq2") + rect(38, 82, 8, 6, "eq2") + line(60, 76, 60, 108) + line(46, 86, 46, 108)},
  press: {A: {hip: [70, 82], t: -90, hand: [76, 50], hs: 1, foot: [94, 106], fs: -1}, B: {hand: [72, 18]},
    eq: J => rect(56, 84, 28, 4) + line(62, 88, 62, 108) + line(60, 84, 60, 40, "eqt") + plate(J.hand)},
  lateral: {front: true, A: {hand: [10, 72], hs: 1, foot: [8, 108]}, B: {hand: [29, 44]}, eq: J => db(J.handR) + db(J.handL)},
  rearfly: {front: true, A: {hand: [6, 56], hs: 1, foot: [10, 106], hipY: 74}, B: {hand: [34, 50]},
    eq: () => rect(64, 34, 32, 42, "eq2") + line(46, 18, 46, 108) + line(114, 18, 114, 108)},
  facepull: {A: {hip: [76, 70], t: -92, hand: [112, 40], hs: -1, foot: [80, 108], fs: -1}, B: {hand: [88, 34]},
    eq: J => stack(140, 20) + cable([136, 38], J.hand)},
  curl: {A: {hip: [76, 70], t: -90, hand: [80, 70], hs: 1, foot: [78, 108], fs: -1}, B: {hand: [88, 44]}, eq: J => db(J.hand)},
  curl_bar: {base: "curl", eq: J => plate(J.hand, 5)},
  pushdown: {A: {hip: [76, 70], t: -96, hand: [90, 46], hs: 1, foot: [80, 108], fs: -1}, B: {hand: [86, 70]},
    eq: J => stack(120, 6) + line(120, 6, 98, 6) + cable([98, 6], J.hand)},
  overhead: {A: {hip: [76, 70], t: -90, hand: [70, 28], hs: 1, foot: [78, 108], fs: -1}, B: {hand: [80, 12]}, eq: J => db(J.hand)},
  squat: {A: {hip: [78, 68], t: -88, hand: [70, 40], hs: 1, foot: [84, 106], fs: -1}, B: {hip: [66, 87], t: -58, hand: [80, 60]},
    eq: J => plate(J.sho, 8)},
  goblet: {base: "squat", A: {hand: [88, 46]}, B: {hand: [96, 70]}, eq: J => db(J.hand)},
  jumpsquat: {A: {hip: [66, 88], t: -55, hand: [60, 92], hs: 1, foot: [84, 106], fs: -1}, B: {hip: [80, 58], t: -88, hand: [96, 22], foot: [82, 98]}, eq: () => ""},
  legpress: {A: {hip: [60, 88], t: -125, hand: [62, 86], hs: 1, foot: [86, 76], fs: -1}, B: {foot: [104, 62]},
    eq: J => line(66, 94, 40, 60, "eqt") + rect(50, 90, 24, 5) + line(80, 104, 130, 54, "eql") + line(J.ank[0] - 6, J.ank[1] - 6, J.ank[0] + 6, J.ank[1] + 6, "eqt")},
  lunge: {A: {hip: [80, 68], t: -90, hand: [80, 70], hs: -1, foot: [86, 106], fs: -1, foot2: [74, 106], fs2: -1}, B: {hip: [80, 84], hand: [80, 86], foot: [102, 106], foot2: [56, 106], ft2: 50},
    eq: J => db(J.hand)},
  bulgarian: {A: {hip: [80, 70], t: -88, hand: [80, 72], hs: -1, foot: [98, 106], fs: -1, foot2: [52, 84], fs2: 1, ft2: 20}, B: {hip: [78, 86], hand: [78, 88]},
    eq: J => bench(36, 60, 86) + db(J.hand)},
  stepup: {A: {hip: [80, 72], t: -86, hand: [80, 72], hs: -1, foot: [102, 86], fs: -1, foot2: [70, 106], fs2: -1}, B: {hip: [98, 50], hand: [98, 52], foot: [102, 86], foot2: [98, 74]},
    eq: J => rect(90, 86, 34, 22, "eq2") + db(J.hand)},
  legext: {A: {hip: [70, 80], t: -96, hand: [72, 84], hs: 1, foot: [90, 104], fs: -1, ft: 0}, B: {foot: [106, 80]},
    eq: J => rect(52, 82, 32, 5) + line(54, 82, 52, 46, "eqt") + line(60, 87, 60, 108) + `<circle cx="${J.ank[0].toFixed(1)}" cy="${J.ank[1].toFixed(1)}" r="3.5" class="eq2"/>`},
  legcurl: {A: {hip: [72, 76], t: 180, hand: [34, 80], hs: 1, foot: [110, 78], fs: 1, ft: -90}, B: {foot: [92, 54]},
    eq: J => bench(28, 104, 80) + `<circle cx="${J.ank[0].toFixed(1)}" cy="${(J.ank[1] - 3).toFixed(1)}" r="3.5" class="eq2"/>`},
  rdl: {A: {hip: [80, 68], t: -90, hand: [82, 72], hs: -1, foot: [84, 106], fs: -1}, B: {hip: [72, 70], t: -12, hand: [100, 96]}, eq: J => plate(J.hand, 8)},
  deadlift: {A: {hip: [72, 84], t: -38, hand: [98, 98], hs: -1, foot: [86, 106], fs: -1}, B: {hip: [80, 68], t: -90, hand: [82, 72]}, eq: J => plate(J.hand, 9)},
  swing: {A: {hip: [72, 72], t: -28, hand: [82, 96], hs: -1, foot: [84, 106], fs: -1}, B: {hip: [80, 68], t: -92, hand: [112, 42]}, eq: J => kb(J.hand)},
  thrust: {A: {hip: [72, 100], t: -150, hand: [72, 94], hs: 1, foot: [100, 106], fs: -1, nod: 30}, B: {hip: [76, 78], t: 178, hand: [76, 72], nod: 60},
    eq: J => bench(16, 50, 80) + line(J.hip[0] - 2, J.hip[1] - 8, J.hip[0] + 4, J.hip[1] - 8, "eqt") + plate([J.hip[0] + 1, J.hip[1] - 8], 7.5)},
  bridge: {A: {hip: [72, 103], t: 180, hand: [56, 106], hs: 1, foot: [94, 106], fs: -1}, B: {hip: [72, 86], t: 150, hand: [56, 106]}, eq: () => ""},
  kickback: {A: {hip: [82, 68], t: -78, hand: [104, 48], hs: 1, foot: [84, 106], fs: -1, foot2: [80, 106], fs2: -1}, B: {foot2: [52, 88]},
    eq: J => stack(130, 20) + line(110, 30, 110, 108) + cable([34, 104], J.ank2 || [0, 0])},
  calf: {A: {hip: [80, 63], t: -90, hand: [81, 66], hs: -1, foot: [80, 101.5], fs: -1, ft: 0}, B: {hip: [80, 57], hand: [81, 60], foot: [80, 95.5], ft: 50},
    eq: J => rect(70, 102, 30, 6, "eq2") + db(J.hand)},
  crunch: {A: {hip: [82, 102], t: 180, hand: [50, 100], hs: 1, foot: [102, 104], fs: -1}, B: {t: 208, hand: [58, 86]}, eq: () => ""},
  legraise: {floorY: 119, A: {hip: [84, 76], t: -91, hand: [86, 16], hs: 1, foot: [86, 114], fs: 1}, B: {foot: [122, 74]},
    eq: () => line(60, 14, 112, 14, "eqt") + line(64, 14, 64, 120) + line(108, 14, 108, 120)},
  cablecrunch: {A: {hip: [80, 82], t: -84, hand: [82, 44], hs: 1, foot: [56, 104], fs: -1, ft: 180}, B: {t: -18, hand: [104, 72]},
    eq: J => stack(70, 4) + line(70, 4, 86, 4) + cable([86, 4], J.hand)},
  boxjump: {A: {hip: [62, 88], t: -52, hand: [50, 84], hs: 1, foot: [72, 106], fs: -1}, B: {hip: [104, 64], t: -62, hand: [128, 52], foot: [114, 84]},
    eq: () => rect(98, 84, 36, 24, "eq2")},
  abduct: {front: true, A: {hand: [16, 70], hs: 1, foot: [9, 104], fs: -1}, B: {foot: [26, 104]},
    eq: () => rect(64, 68, 32, 8, "eq2") + rect(66, 30, 28, 38, "eq2")},
  // ab 0.10: Varianten und Übungen für zu Hause
  chestpress: {A: {hip: [62, 82], t: -92, hand: [84, 58], hs: 1, foot: [92, 106], fs: -1}, B: {hand: [104, 60]},
    eq: J => rect(48, 84, 28, 4) + line(52, 84, 50, 36, "eqt") + line(58, 88, 58, 108) + stack(132, 30) + line(J.hand[0], J.hand[1] - 6, J.hand[0], J.hand[1] + 6, "eqt")},
  crossover: {front: true, A: {hand: [36, 34], hs: 1, foot: [12, 106], hipY: 72}, B: {hand: [8, 76]},
    eq: J => line(6, 8, 6, 108) + line(154, 8, 154, 108) + cable([10, 10], J.handL) + cable([150, 10], J.handR)},
  press_machine: {base: "press", eq: J => rect(56, 84, 28, 4) + line(62, 88, 62, 108) + line(60, 84, 60, 40, "eqt") + stack(110, 8) + line(J.hand[0] - 6, J.hand[1], J.hand[0] + 6, J.hand[1], "eqt")},
  lateral_cable: {base: "lateral", eq: J => stack(150, 40) + cable([146, 104], J.handR)},
  row_machine: {A: {hip: [64, 84], t: -60, hand: [106, 64], hs: -1, foot: [96, 106], fs: -1}, B: {hand: [80, 70]},
    eq: J => rect(50, 86, 26, 4) + line(56, 90, 56, 108) + rect(86, 40, 6, 30, "eq2") + line(92, 70, 92, 108) + line(J.hand[0], J.hand[1] - 6, J.hand[0], J.hand[1] + 6, "eqt")},
  straightarm: {A: {hip: [76, 70], t: -78, hand: [118, 30], hs: -1, foot: [80, 108], fs: -1}, B: {hand: [96, 76]},
    eq: J => stack(140, 6) + line(140, 6, 126, 6) + cable([126, 6], J.hand)},
  preacher: {A: {hip: [66, 82], t: -84, hand: [104, 76], hs: 1, foot: [84, 106], fs: -1}, B: {hand: [86, 46]},
    eq: J => line(78, 56, 98, 76, "eqt") + line(86, 70, 86, 108) + rect(56, 84, 24, 4) + plate(J.hand, 5)},
  curl_cable: {base: "curl", eq: J => stack(132, 40) + cable([128, 104], J.hand)},
  overhead_cable: {A: {hip: [70, 70], t: -70, hand: [102, 30], hs: -1, foot: [80, 108], fs: -1}, B: {hand: [116, 10]},
    eq: J => stack(30, 6) + cable([34, 20], J.hand)},
  skull: {base: "bench", A: {hand: [44, 44], hs: 1}, B: {hand: [28, 56]}, eq: J => bench(26, 84, 80) + plate(J.hand, 5)},
  hack: {A: {hip: [84, 70], t: -100, hand: [80, 46], hs: 1, foot: [88, 104], fs: -1}, B: {hip: [72, 88], t: -112, hand: [68, 62]},
    eq: J => line(J.hip[0] - 6, J.hip[1] + 6, J.sho[0] - 6, J.sho[1] - 8, "eqt") + rect(80, 104, 22, 4, "eq2")},
  frontsquat: {base: "squat", A: {hand: [92, 40]}, B: {hand: [94, 60]}, eq: J => plate([J.sho[0] + 5, J.sho[1] + 1], 8)},
  legcurl_seat: {base: "legext", A: {foot: [106, 80]}, B: {foot: [84, 108]}},
  incline_db: {base: "incline", eq: J => line(78, 84, 46, 62, "eqt") + bench(66, 90, 84) + db(J.hand)},
  floorpress: {A: {hip: [74, 102], t: 180, hand: [44, 80], hs: -1, foot: [100, 106], fs: -1}, B: {hand: [44, 60]}, eq: J => db(J.hand)},
  fly_db: {base: "bench", A: {hand: [46, 96], hs: -1}, B: {hand: [42, 46]}, eq: J => bench(26, 84, 80) + db(J.hand)},
  pullover: {base: "bench", A: {hand: [8, 74], hs: 1}, B: {hand: [40, 46]}, eq: J => bench(26, 84, 80) + db(J.hand)},
  row_dbs: {base: "row_bb", eq: J => db(J.hand)},
  press_db: {base: "press", eq: J => rect(56, 84, 28, 4) + line(62, 88, 62, 108) + line(60, 84, 60, 40, "eqt") + db(J.hand)},
  rearfly_db: {A: {hip: [84, 66], t: -18, hand: [102, 96], hs: -1, foot: [90, 106], fs: -1}, B: {hand: [96, 52]}, eq: J => db(J.hand)},
  rdl_db: {base: "rdl", eq: J => db(J.hand)},
  airsquat: {base: "squat", A: {hand: [104, 46]}, B: {hand: [106, 66]}, eq: () => ""},
  splitsquat: {base: "lunge", A: {foot: [100, 106], foot2: [56, 106], ft2: 50}, B: {foot: [100, 106], foot2: [56, 106]}, eq: () => ""},
  calf_bw: {base: "calf", A: {hand: [108, 50], hs: -1}, B: {hand: [108, 46]}, eq: () => rect(70, 102, 30, 6, "eq2") + line(118, 10, 118, 108, "eql")},
  pushup_incline: {A: {hip: [74, 86], t: -28, hand: [112, 84], hs: -1, foot: [36, 106], fs: 1, ft: 90}, B: {hip: [76, 80], t: -42},
    eq: () => rect(104, 84, 40, 5) + line(110, 89, 110, 108) + line(138, 89, 138, 108)},
  pike: {A: {hip: [82, 62], t: 120, hand: [62, 106], hs: -1, foot: [106, 106], fs: 1, ft: 90}, B: {hip: [82, 70], t: 145}, eq: () => ""},
  benchdip: {A: {hip: [70, 76], t: -94, hand: [60, 80], hs: -1, foot: [118, 106], fs: -1}, B: {hip: [70, 96], hand: [60, 80]},
    eq: () => bench(36, 66, 80)},
  invrow: {A: {hip: [92, 92], t: 192, hand: [58, 62], hs: 1, foot: [130, 106], fs: 1, ft: -90}, B: {hip: [92, 82], t: 200},
    eq: () => rect(26, 58, 72, 4) + line(32, 62, 32, 108) + line(92, 62, 92, 108)},
  superman: {A: {hip: [84, 102], t: 180, hand: [34, 104], hs: 1, foot: [130, 104], fs: 1, ft: 90}, B: {t: 172, hand: [32, 94], foot: [130, 96]}, eq: () => ""},
  // ab 0.10: Widerstandsband
  row_band: {base: "row_cable", eq: J => band(J.toe, J.hand)},
  pullapart: {front: true, A: {hand: [8, 46], hs: 1, foot: [10, 106]}, B: {hand: [36, 46]}, eq: J => band(J.handL, J.handR)},
  facepull_band: {base: "facepull", eq: J => rect(142, 34, 6, 8, "eq2") + band([142, 38], J.hand)},
  press_band: {A: {hip: [76, 70], t: -90, hand: [84, 44], hs: 1, foot: [78, 108], fs: -1}, B: {hand: [80, 14]}, eq: J => band(J.toe, J.hand)},
  pushdown_band: {base: "pushdown", eq: J => wall(100) + band([100, 8], J.hand)},
  curl_band: {base: "curl", eq: J => band(J.toe, J.hand)},
  sidestep_band: {front: true, A: {hand: [18, 66], hs: 1, foot: [10, 106], fs: -1, hipY: 74}, B: {foot: [24, 106]}, eq: J => band(J.kneeL, J.kneeR)},
  // ab 0.10: Halten und Mobility. Zwei nahe Posen: die Figur „atmet“ in der Haltung.
  plank: {A: {hip: [76, 96], t: -6, hand: [116, 106], hs: 1, foot: [40, 106], fs: 1, ft: 90}, B: {hip: [76, 95]}, eq: () => ""},
  wallsit: {A: {hip: [66, 84], t: -90, hand: [80, 82], hs: 1, foot: [88, 106], fs: -1}, B: {hip: [66, 85]}, eq: () => wall(56)},
  kneelstretch: {A: {hip: [76, 84], t: -88, hand: [80, 86], hs: -1, foot: [100, 106], fs: -1, foot2: [56, 106], fs2: -1, ft2: 180}, B: {hip: [82, 86], t: -84},
    eq: () => ""},
  pigeon: {A: {hip: [76, 98], t: -70, hand: [92, 104], hs: -1, foot: [92, 104], fs: -1, ft: 0, foot2: [40, 106], fs2: 1, ft2: 180}, B: {t: -24, hand: [116, 104]}, eq: () => ""},
  fold: {A: {hip: [80, 68], t: -40, hand: [96, 92], hs: -1, foot: [84, 106], fs: -1}, B: {t: -14, hand: [104, 102]}, eq: () => ""},
  chestwall: {A: {hip: [84, 70], t: -90, hand: [62, 40], hs: -1, foot: [86, 108], fs: -1}, B: {hip: [88, 70], t: -86}, eq: () => wall(52)},
  child: {A: {hip: [62, 98], t: -12, hand: [124, 104], hs: 1, foot: [44, 106], fs: 1, ft: 180}, B: {t: -6, hand: [132, 104]}, eq: () => ""},
  catcow: {A: {hip: [58, 82], t: 4, hand: [92, 106], hs: 1, foot: [36, 106], fs: 1, ft: 180}, B: {hip: [58, 78], t: -8}, eq: () => ""},
  quadrot: {base: "catcow", B: {hip: [58, 82], t: 0, hand: [94, 54]}},
  calfwall: {A: {hip: [80, 72], t: -66, hand: [114, 44], hs: 1, foot: [98, 106], fs: -1, foot2: [52, 106], fs2: -1}, B: {hip: [86, 72], t: -62}, eq: () => wall(118)},
  deepsquat: {A: {hip: [72, 98], t: -66, hand: [100, 78], hs: 1, foot: [88, 106], fs: -1}, B: {hip: [72, 97], t: -70}, eq: () => ""},
  crossarm: {front: true, A: {hand: [-8, 48], hs: -1, foot: [10, 106]}, B: {hand: [-12, 46]}, eq: () => ""},
  revcrunch: {A: {hip: [80, 102], t: 180, hand: [70, 106], hs: 1, foot: [118, 104], fs: -1}, B: {hip: [82, 98], foot: [88, 76]}, eq: () => ""},
};
for (const k of Object.keys(P)) { const p = P[k]; if (p.base) { const b = P[p.base]; P[k] = {...b, ...p, A: {...b.A, ...(p.A || {})}, B: {...b.B, ...(p.B || {})}}; } }
for (const p of Object.values(P)) p.B = {...p.A, ...p.B};

export const PATTERNS = Object.keys(P);
const ease = k => 0.5 - Math.cos(k * Math.PI) / 2;
// Bewegungsspur: der Punkt, der sich am weitesten bewegt (Hand, Hüfte oder Fuß), als feine gestrichelte Bahn
const TRAIL = {};
function trail(p) {
  if (p.front) return "";
  if (TRAIL[p.key] != null) return TRAIL[p.key];
  const pts = [], keys = ["hand", "hip", "ank", "ank2", "sho"];
  const js = Array.from({length: 13}, (_, i) => sideJoints(lerpPose(p.A, p.B, ease(i / 12))));
  let best = null, dmax = 0;
  for (const k of keys) { if (!js[0][k]) continue; const d = Math.hypot(js[12][k][0] - js[0][k][0], js[12][k][1] - js[0][k][1]); if (d > dmax) { dmax = d; best = k; } }
  if (!best || dmax < 8) return (TRAIL[p.key] = "");
  js.forEach(j => pts.push(j[best].map(v => v.toFixed(1)).join(",")));
  return (TRAIL[p.key] = `<polyline points="${pts.join(" ")}" class="trail"/>`);
}
for (const [k, p] of Object.entries(P)) p.key = k;
// Tempo wie im Training: kurz halten, zügig hin (1 s), kurz halten, langsam zurück (1,6 s)
const CYCLE = 3600, SEG = [[0, 300, 0, 0], [300, 1300, 0, 1], [1300, 1650, 1, 1], [1650, 3600, 1, 0]];
function phase(ts) {
  const t = ts % CYCLE;
  for (const [a, b, from, to] of SEG) if (t < b) { const k = (t - a) / (b - a); return from + (to - from) * k; }
  return 0;
}

function frame(p, k, on) {
  const pose = lerpPose(p.A, p.B, ease(k));
  const J = p.front ? frontJoints(pose) : sideJoints(pose);
  return trail(p) + (p.eq ? p.eq(J) : "") + (p.front ? drawFront(J, on) : drawSide(J, on));
}
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function svgFor(pattern, on = [], label = "") {
  const p = P[pattern]; if (!p) return "";
  const still = reduce();
  return `<svg class="exanim" viewBox="0 0 160 120" role="img" aria-label="${label}" data-pat="${pattern}" data-on="${on.join(" ")}">
    ${floor(p.floorY)}${still ? `<g class="ghost">${frame(p, 0, on)}</g>` : ""}<g class="fig">${frame(p, still ? 1 : 0, on)}</g></svg>`;
}

// Eine gemeinsame Animationsschleife für alle sichtbaren Grafiken
let raf = 0;
function tick(ts) {
  raf = 0;
  if (document.hidden || reduce()) return;
  const els = document.querySelectorAll("svg.exanim");
  if (!els.length) return;
  const k = phase(ts);
  els.forEach(el => { const p = P[el.dataset.pat]; const g = el.querySelector(".fig"); if (p && g) g.innerHTML = frame(p, k, (el.dataset.on || "").split(" ")); });
  raf = requestAnimationFrame(tick);
}
export function startAnim() { if (!raf && !reduce()) raf = requestAnimationFrame(tick); }
document.addEventListener("visibilitychange", () => { if (!document.hidden) startAnim(); });
