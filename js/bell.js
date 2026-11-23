// Pausenende: Ringglocke (selbst synthetisiert, keine fremden Aufnahmen) und Ansage „Next Round“.
// Zwei Wege:
// 1. Standard (Web Audio, „ambient“): Glocke wird im Audio-Takt vorgeplant und mischt sich mit Musik. Läutet nur, solange SATZ offen ist.
// 2. Hintergrund: Die Glocke steckt am Ende einer Audiodatei aus Stille, die beim Speichern des Satzes startet. Ein <audio>-Element
//    spielt wie Musik auch im Hintergrund und bei gesperrtem Bildschirm weiter, unterbricht dafür aber andere Musik während der Pause.
const SR = 11025, STRIKES = [0, 0.42, 0.84], BELL_LEN = 3.0, MAX_SEC = 600;

let bellPcm = null;
function bell() {
  if (bellPcm) return bellPcm;
  const n = Math.round(SR * BELL_LEN), out = new Float32Array(n);
  // Glockenteiltöne (unharmonisch wie bei einer Metallglocke): Frequenzverhältnis, Lautstärke, Abklingzeit
  const f0 = 640, parts = [[1, 1, 1.5], [2.0, 0.45, 0.9], [2.76, 0.6, 0.75], [4.07, 0.28, 0.45], [5.4, 0.18, 0.3]];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
  STRIKES.forEach((t0, k) => {
    const s0 = Math.round(t0 * SR), amp = k === 2 ? 1 : 0.85;
    for (let i = s0; i < n; i++) {
      const t = (i - s0) / SR;
      let v = 0;
      for (const [r, a, d] of parts) v += a * Math.exp(-t / d) * Math.sin(2 * Math.PI * f0 * r * t);
      if (t < 0.006) v += rnd() * 1.5 * (1 - t / 0.006);    // Anschlag
      out[i] += amp * v * Math.min(1, t / 0.002);
    }
  });
  let peak = 0; for (const v of out) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < n; i++) out[i] = out[i] / peak * 0.9;
  return (bellPcm = out);
}
function wav(silenceSec) {
  const b = bell(), pre = Math.round(Math.max(0, silenceSec) * SR), n = pre + b.length;
  const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < b.length; i++) v.setInt16(44 + (pre + i) * 2, Math.round(b[i] * 32767), true);
  return new Blob([buf], {type: "audio/wav"});
}

const el = typeof Audio !== "undefined" ? new Audio() : null;
let url = "";
export let scheduledUntil = 0;   // Zeitpunkt, zu dem die geplante Glocke läutet (0 = keine)
function setSrc(blob) { if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(blob); el.src = url; }

let ctx = null, node = null, abuf = null;
function session(type) { try { if (navigator.audioSession) navigator.audioSession.type = type; } catch (e) {} }
function webBell(sec) {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  if (!abuf) { const b = bell(); abuf = ctx.createBuffer(1, b.length, SR); abuf.getChannelData(0).set(b); }
  node = ctx.createBufferSource(); node.buffer = abuf; node.connect(ctx.destination); node.start(ctx.currentTime + Math.max(0, sec));
}
// Im Tipp aufrufen (Speichern, +30 s): plant die Glocke in `sec` Sekunden
export function schedule(sec, background) {
  cancel();
  if (sec <= 0) return;
  unlockVoice();
  if (!background || !el || sec > MAX_SEC) {
    session("ambient");
    try { webBell(sec); scheduledUntil = Date.now() + sec * 1000; } catch (e) {}
    return;
  }
  session("playback");
  try {
    setSrc(wav(sec)); el.currentTime = 0;
    const p = el.play(); if (p && p.catch) p.catch(() => {});
    scheduledUntil = Date.now() + sec * 1000;
    if ("mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({title: "Satzpause", artist: "SATZ"});
  } catch (e) {}
}
export function cancel() {
  scheduledUntil = 0;
  if (node) { try { node.stop(); } catch (e) {} node = null; }
  if (el && !el.paused) { try { el.pause(); } catch (e) {} }
}
// Sofort läuten (Probe, Ersatz ohne geplante Glocke)
export function ring() { session("ambient"); try { webBell(0); } catch (e) {} }

/* ---------- Ansage ---------- */
// Tiefe englische Männerstimme, soweit das Gerät eine hat (iPhone: Daniel, Arthur, Aaron, Fred)
const MALE = /daniel|arthur|aaron|fred|alex|ralph|albert|reed|rocko|grandpa|oliver|george|guy|david|mark|james|ryan|male/i;
function voice() {
  const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  const en = vs.filter(v => /^en[-_]/i.test(v.lang));
  return en.find(v => /en[-_]GB/i.test(v.lang) && MALE.test(v.name)) || en.find(v => MALE.test(v.name)) || en[0] || null;
}
let voiceReady = false;
function unlockVoice() {
  // iOS spricht erst, nachdem einmal in einem Tipp gesprochen wurde: stille Äußerung als Freischaltung
  if (voiceReady || !window.speechSynthesis) return;
  try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); voiceReady = true; } catch (e) {}
}
export function announce() {
  if (!window.speechSynthesis) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("Next round!"), v = voice();
    if (v) u.voice = v; u.lang = v ? v.lang : "en-GB"; u.pitch = 0.4; u.rate = 0.85; u.volume = 1;
    speechSynthesis.speak(u);
  } catch (e) {}
}
export function preview(withVoice) { unlockVoice(); ring(); if (withVoice) setTimeout(announce, 1400); }
if (window.speechSynthesis) speechSynthesis.getVoices();
