// Ernährung: Energiebedarf, Makroziele und Lebensmittel-Rechnungen.
// Jede Zahl hier hat eine Quelle, siehe SOURCES unten und die Anzeige in der App.

export const PAL = [
  {v: 1.4, l: "Wenig aktiv", d: "Sitzende Arbeit, kaum Bewegung in der Freizeit"},
  {v: 1.55, l: "Leicht aktiv", d: "Sitzende Arbeit, 2–3 Trainings pro Woche"},
  {v: 1.7, l: "Aktiv", d: "Gehende oder stehende Arbeit, oder 4–5 Trainings pro Woche"},
  {v: 1.9, l: "Sehr aktiv", d: "Körperliche Arbeit und tägliches Training"},
];

// Wochenrate in % des Körpergewichts, Protein in g pro kg Körpergewicht
export const GOALS = {
  lose: {l: "Abbauen", rate: -0.005, protein: 2.0, why: "−0,5 % Körpergewicht pro Woche erhält Muskulatur besser als schnelles Abnehmen (Helms et al. 2014). Höheres Protein im Defizit schützt die Muskelmasse (Helms et al. 2014; Jäger et al. 2017)."},
  maintain: {l: "Halten", rate: 0, protein: 1.6, why: "Gewicht halten. 1,6 g Protein pro kg ist der Wert, ab dem zusätzliche Mengen den Muskelaufbau kaum noch steigern (Morton et al. 2018)."},
  gain: {l: "Aufbauen", rate: 0.0025, protein: 1.6, why: "+0,25 % Körpergewicht pro Woche hält den Fettzuwachs bei Trainierten gering (Iraki et al. 2019). 1,6 g Protein pro kg nach Morton et al. 2018."},
};
export const FAT_SHARE = 0.25;        // 25 % der Energie, innerhalb von 20–35 % (IOM 2005, DGE)
export const KCAL_PER_KG = 7700;      // Faustregel Energie pro kg Körpermasse (Näherung, Hall 2008)
export const SOURCES = [
  ["Mifflin et al. (1990)", "A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr 51(2)", "https://pubmed.ncbi.nlm.nih.gov/2305711/"],
  ["Frankenfield et al. (2005)", "Comparison of predictive equations for resting metabolic rate in healthy adults. J Am Diet Assoc 105(5): Mifflin-St Jeor am genauesten", "https://pubmed.ncbi.nlm.nih.gov/15883556/"],
  ["FAO/WHO/UNU (2004)", "Human energy requirements: PAL-Werte 1,40–2,40", "https://www.fao.org/4/y5686e/y5686e00.htm"],
  ["Morton et al. (2018)", "Protein supplementation and resistance training: meta-analysis. Br J Sports Med 52(6): Plateau bei ca. 1,6 g/kg", "https://pubmed.ncbi.nlm.nih.gov/28698222/"],
  ["Jäger et al. (2017)", "ISSN Position Stand: protein and exercise. J Int Soc Sports Nutr 14: 1,4–2,0 g/kg", "https://pubmed.ncbi.nlm.nih.gov/28642676/"],
  ["Helms et al. (2014)", "Evidence-based recommendations for natural bodybuilding contest preparation. J Int Soc Sports Nutr 11: 0,5–1 %/Woche, mehr Protein im Defizit", "https://pubmed.ncbi.nlm.nih.gov/24864135/"],
  ["Iraki et al. (2019)", "Nutrition recommendations for bodybuilders in the off-season. Sports 7(7): 0,25–0,5 %/Woche Zunahme", "https://pubmed.ncbi.nlm.nih.gov/31247944/"],
  ["Institute of Medicine (2005)", "Dietary Reference Intakes for Energy and Macronutrients: Fett 20–35 % der Energie", "https://nap.nationalacademies.org/catalog/10490"],
  ["Hall (2008)", "What is the required energy deficit per unit weight loss? Int J Obes 32(3): 7700 kcal/kg nur als Näherung", "https://pubmed.ncbi.nlm.nih.gov/17848938/"],
];

export function age(birth, now = new Date()) {
  if (!birth) return null;
  const b = new Date(birth + "T00:00:00");
  if (isNaN(b)) return null;
  let a = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
  return a;
}

export const missing = (p, kg) => [
  !p.birth && "Geburtsdatum", !p.sex && "Geschlecht", !p.height && "Größe", !kg && "Gewicht",
].filter(Boolean);

// Grundumsatz nach Mifflin-St Jeor. Bei „keine Angabe“ der Mittelwert beider Formeln.
export function bmr(sex, kg, cm, years) {
  const base = 10 * kg + 6.25 * cm - 5 * years;
  return sex === "m" ? base + 5 : sex === "w" ? base - 161 : base - 78;
}

export function computeTargets(p, kg) {
  const years = age(p.birth);
  if (missing(p, kg).length || years == null) return null;
  const g = GOALS[p.goal] || GOALS.maintain;
  const b = bmr(p.sex, kg, p.height, years);
  const tdee = b * p.pal;
  const delta = kg * g.rate * KCAL_PER_KG / 7;
  const kcal = Math.round((tdee + delta) / 10) * 10;
  const protein = Math.round(kg * g.protein);
  const fat = Math.round(kcal * FAT_SHARE / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return {kcal, p: protein, c: carbs, f: fat,
    steps: {years, bmr: Math.round(b), pal: p.pal, tdee: Math.round(tdee), delta: Math.round(delta), goal: g, kg}};
}

export function activeTargets(p, kg) {
  if (p.manual && p.kcal) return {kcal: p.kcal, p: p.p || 0, c: p.c || 0, f: p.f || 0, manual: true};
  const t = computeTargets(p, kg);
  return t ? {...t, manual: false} : null;
}

export const macrosFor = (per100, grams) => ({
  kcal: per100.kcal * grams / 100, p: per100.p * grams / 100, c: per100.c * grams / 100, f: per100.f * grams / 100,
});
export function sumEntries(entries) {
  return entries.reduce((a, e) => { const m = macrosFor(e.per100, e.grams); a.kcal += m.kcal; a.p += m.p; a.c += m.c; a.f += m.f; return a; }, {kcal: 0, p: 0, c: 0, f: 0});
}
// Plausibilität: Energie aus Makros (4/4/9 kcal pro g, Atwater) gegen angegebene kcal
export const atwater = m => m.p * 4 + m.c * 4 + m.f * 9;

export const MEALS = [["fruehstueck", "Frühstück"], ["mittag", "Mittagessen"], ["abend", "Abendessen"], ["snack", "Snacks"]];

/* ---------- Open Food Facts ----------
   Die Textsuche ist bei Open Food Facts auf etwa 10 Anfragen pro Minute begrenzt, darum nur auf Knopfdruck. */
const OFF = "https://world.openfoodfacts.org";
function fromOff(p) {
  const n = p.nutriments || {};
  const kcal = n["energy-kcal_100g"] ?? (n["energy_100g"] != null ? n["energy_100g"] / 4.184 : null);
  if (kcal == null) return null;
  return {name: p.product_name_de || p.product_name || "Unbenanntes Produkt", brand: (p.brands || "").split(",")[0].trim(), barcode: p.code || "",
    per100: {kcal: +kcal, p: +(n.proteins_100g || 0), c: +(n.carbohydrates_100g || 0), f: +(n.fat_100g || 0)},
    serving: +p.serving_quantity || 0, source: "off"};
}
const FIELDS = "code,product_name,product_name_de,brands,nutriments,serving_quantity";
export async function offProduct(code) {
  const r = await fetch(`${OFF}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  if (!r.ok && r.status !== 404) throw new Error("netz");
  const j = await r.json();
  return j.status === 1 && j.product ? fromOff({...j.product, code}) : null;
}
export async function offSearch(q) {
  const r = await fetch(`${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&json=1&page_size=25&cc=de&sort_by=unique_scans_n&fields=${FIELDS}`);
  if (!r.ok) throw new Error("netz");
  const j = await r.json();
  return (j.products || []).map(fromOff).filter(Boolean);
}
