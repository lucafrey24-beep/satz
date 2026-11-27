// 3D-Körperkarte: stilisierte Figur aus einfachen Formen (three.js, lokal, offline).
// Arme 45° abgespreizt, Muskelgruppen als eigene Flächen. Ziehen dreht, Tippen wählt einen Muskel.
import * as THREE from "./vendor/three.module.min.js";

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export function mountBody(el, {onPick, selected = null, label = () => ""} = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({antialias: true, alpha: true}); }
  catch (e) { el.innerHTML = `<p class="meta">3D wird auf diesem Gerät nicht unterstützt. Nutze die Liste darunter.</p>`; return null; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  el.append(renderer.domElement);
  renderer.domElement.setAttribute("aria-hidden", "true");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 1.0, 3.85); camera.lookAt(0, 0.9, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.8); rim.position.set(-2, 2, -4); scene.add(rim);

  const fig = new THREE.Group(); scene.add(fig);
  const mats = {}, meshes = [];
  const colors = () => ({neutral: new THREE.Color(css("--fig-neutral") || "#C7C7CC"), muscle: new THREE.Color(css("--fig-muscle") || "#8FA89A"), sel: new THREE.Color(css("--tint") || "#0B6B46")});
  let C = colors();
  const mat = id => mats[id] || (mats[id] = new THREE.MeshStandardMaterial({color: id === "neutral" ? C.neutral : C.muscle, roughness: 0.65, metalness: 0.0, side: THREE.DoubleSide}));
  const put = (geo, id, pos, rot, parent = fig, scale) => {
    const m = new THREE.Mesh(geo, mat(id)); m.position.set(...pos); if (rot) m.rotation.set(...rot); if (scale) m.scale.set(...scale);
    m.userData.muscle = id === "neutral" ? null : id; parent.add(m); meshes.push(m); return m;
  };
  // Formen: Ellipsoid (skalierte Kugel), Kapsel, gedrehter Umriss (Lathe) für den Rumpf
  const ell = (r, sc) => { const g = new THREE.SphereGeometry(r, 28, 20); g.scale(...sc); return g; };
  const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 16);
  const V = (x, y) => new THREE.Vector2(x, y);

  // Grundkörper (neutral): Kopf, Hals, Rumpf als Umriss, darauf die Muskeln als leicht erhabene Flächen
  put(ell(0.1, [0.86, 1.08, 0.95]), "neutral", [0, 1.665, 0]);
  put(cap(0.045, 0.06), "neutral", [0, 1.535, 0]);
  const torso = new THREE.LatheGeometry([V(0.0, 0.84), V(0.12, 0.85), V(0.15, 0.9), V(0.145, 0.98), V(0.13, 1.06), V(0.128, 1.12), V(0.145, 1.22), V(0.17, 1.32), V(0.178, 1.4), V(0.165, 1.46), V(0.11, 1.5), V(0.05, 1.52), V(0.0, 1.52)], 32);
  torso.scale(1, 1, 0.62);
  put(torso, "neutral", [0, 0, 0]).userData.region = q => q.y > 1.49 ? null : q.y > 1.23 ? (q.z > 0 ? "brust" : "ruecken") : q.y > 0.97 ? (q.z > 0 ? "bauch" : "lrs") : q.z < 0 ? "gluteus" : null;
  put(ell(0.14, [1, 0.5, 0.64]), "neutral", [0, 0.86, 0]);
  // Brust: zwei Brustmuskeln
  for (const s of [1, -1]) put(ell(0.085, [1.05, 0.72, 0.42]), "brust", [s * 0.074, 1.36, 0.088], [0, s * 0.25, s * -0.12]);
  // Bauch
  put(ell(0.085, [0.9, 1.45, 0.38]), "bauch", [0, 1.11, 0.068]);
  // Rücken: breiter Rückenmuskel beidseitig und oberer Rücken
  for (const s of [1, -1]) put(ell(0.09, [0.95, 1.55, 0.42]), "ruecken", [s * 0.075, 1.3, -0.082], [0, s * -0.2, s * 0.12]);
  put(ell(0.08, [1.5, 0.55, 0.42]), "ruecken", [0, 1.42, -0.078]);
  // Trapez: oberer Rücken und Nacken
  put(ell(0.07, [1.5, 0.6, 0.45]), "trapez", [0, 1.49, -0.06]);
  // Unterer Rücken
  put(ell(0.07, [1.1, 1.0, 0.4]), "lrs", [0, 1.07, -0.065]);
  // Gesäß
  for (const s of [1, -1]) put(ell(0.08, [0.92, 1.0, 0.78]), "gluteus", [s * 0.064, 0.9, -0.058]);

  // Arme: Gruppe am Schultergelenk, 45° abgespreizt
  for (const s of [1, -1]) {
    // Schulter dreigeteilt: vorne, seitlich, hinten
    put(ell(0.05, [1, 1.15, 0.75]), "schultern", [s * 0.19, 1.43, 0.034]);
    put(ell(0.05, [0.8, 1.15, 0.95]), "delt_seite", [s * 0.222, 1.43, 0]);
    put(ell(0.05, [1, 1.15, 0.75]), "delt_hinten", [s * 0.19, 1.43, -0.034]);
    const arm = new THREE.Group(); arm.position.set(s * 0.205, 1.42, 0); arm.rotation.z = s * (Math.PI / 4); fig.add(arm);
    put(cap(0.042, 0.2), "neutral", [0, -0.16, 0], null, arm).userData.region = q => q.z > 0 ? "bizeps" : "trizeps";
    put(ell(0.042, [0.95, 2.1, 0.8]), "bizeps", [0, -0.15, 0.022], null, arm);
    put(ell(0.042, [0.95, 2.2, 0.8]), "trizeps", [0, -0.14, -0.022], null, arm);
    put(cap(0.034, 0.2), "unterarme", [0, -0.43, 0], null, arm);
    put(ell(0.04, [0.75, 1.25, 0.5]), "neutral", [0, -0.6, 0], null, arm);
    // Beine
    const leg = new THREE.Group(); leg.position.set(s * 0.085, 0.86, 0); leg.rotation.z = s * 0.04; fig.add(leg);
    put(cap(0.068, 0.3), "neutral", [0, -0.22, 0], null, leg).userData.region = q => q.z > 0 ? "quads" : "hamstrings";
    put(ell(0.066, [1.0, 2.7, 0.72]), "quads", [0, -0.21, 0.03], null, leg);
    put(ell(0.064, [0.95, 2.6, 0.72]), "hamstrings", [0, -0.23, -0.03], null, leg);
    put(ell(0.04, [0.7, 2.2, 0.8]), "adduktoren", [-s * 0.045, -0.17, 0], null, leg);
    put(cap(0.043, 0.32), "neutral", [0, -0.64, 0], null, leg).userData.region = q => q.z < 0 && q.y > -0.2 ? "waden" : null;
    put(ell(0.046, [0.95, 2.3, 0.85]), "waden", [0, -0.58, -0.026], null, leg);
    put(new THREE.BoxGeometry(0.075, 0.045, 0.18, 2, 1, 2), "neutral", [0, -0.855, 0.045], null, leg);
  }

  let sel = selected;
  function paint() {
    for (const [id, m] of Object.entries(mats)) m.color.copy(id === "neutral" ? C.neutral : id === sel ? C.sel : C.muscle);
    render();
  }
  const ray = new THREE.Raycaster(), v2 = new THREE.Vector2();
  function pick(x, y) {
    const r = renderer.domElement.getBoundingClientRect();
    v2.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v2, camera);
    // nur die vorderste Fläche zählt, sonst träfe man durch den Rumpf hindurch die Rückseite
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit) return null;
    const o = hit.object;
    // Grundkörper unter den Muskeln: Treffer der nächstliegenden Muskelgruppe zuordnen (vorne/hinten, Höhe)
    if (!o.userData.muscle && o.userData.region) return o.userData.region(o.worldToLocal(hit.point.clone()));
    return o.userData.muscle;
  }

  // Drehen per Ziehen, Tippen wählt
  let down = null, rotY = 0, target = 0, anim = 0;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cv = renderer.domElement;
  cv.style.touchAction = "pan-y";
  cv.addEventListener("pointerdown", e => { down = {x: e.clientX, y: e.clientY, r: rotY, moved: false}; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", e => {
    if (!down) return;
    const dx = e.clientX - down.x;
    if (Math.abs(dx) > 6) down.moved = true;
    if (down.moved) { rotY = target = down.r + dx * 0.012; fig.rotation.y = rotY; render(); }
  });
  cv.addEventListener("pointerup", e => {
    if (down && !down.moved) { const m = pick(e.clientX, e.clientY); if (m) { sel = m; paint(); onPick && onPick(m); } }
    down = null;
  });
  cv.addEventListener("pointercancel", () => { down = null; });
  function turnTo(a) {
    target = a;
    if (reduce) { rotY = a; fig.rotation.y = a; render(); return; }
    cancelAnimationFrame(anim);
    const step = () => { rotY += (target - rotY) * 0.15; fig.rotation.y = rotY; render(); if (Math.abs(target - rotY) > 0.002) anim = requestAnimationFrame(step); };
    step();
  }

  function size() {
    const w = el.clientWidth || 300, h = el.clientHeight || 360;
    renderer.setSize(w, h, false); cv.style.width = w + "px"; cv.style.height = h + "px";
    camera.aspect = w / h; camera.updateProjectionMatrix(); render();
  }
  function render() { renderer.render(scene, camera); }
  const ro = new ResizeObserver(size); ro.observe(el);
  size(); paint();
  // kleine Drehung zum Start, damit klar ist, dass die Figur 3D ist
  if (!reduce) { rotY = -0.6; fig.rotation.y = rotY; turnTo(0); }

  return {
    select(m) { sel = m; paint(); },
    front() { const n = Math.round(rotY / (2 * Math.PI)) * 2 * Math.PI; turnTo(n); },
    back() { const n = Math.round((rotY - Math.PI) / (2 * Math.PI)) * 2 * Math.PI + Math.PI; turnTo(n); },
    recolor() { C = colors(); paint(); },
    destroy() { ro.disconnect(); cancelAnimationFrame(anim); renderer.dispose(); Object.values(mats).forEach(m => m.dispose()); meshes.forEach(m => m.geometry.dispose()); el.innerHTML = ""; },
  };
}
