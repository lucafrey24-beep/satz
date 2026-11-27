# SATZ – Trainingsheft

Installierbare Web-App (PWA) fürs Krafttraining mit Ernährungstagebuch. Live: https://lucafrey24-beep.github.io/satz/ Läuft im Browser, offline, ohne Konto. Alle Daten bleiben auf dem Gerät (localStorage), Sicherung als JSON-Datei unter „Mehr“.

## Starten (lokal)
```
cd satz
python3 -m http.server 8000
```
Dann http://localhost:8000 öffnen. Direkt per Doppelklick (file://) funktioniert es nicht, weil ES-Module und Service Worker einen Webserver brauchen.

## Aufs Handy
Die App muss über HTTPS erreichbar sein, z. B. über GitHub Pages. Danach im Browser öffnen und „Zum Home-Bildschirm“ wählen (iPhone: Safari > Teilen; Android: Chrome-Menü > App installieren).

## Aufbau
- `index.html` – Gerüst mit Navigation
- `css/app.css` – iOS-Look nach Apple Human Interface Guidelines (Systemschrift mit Dynamic Type, gruppierte Listen, schwebende Tab-Bar), hell/dunkel/erhöhter Kontrast
- `js/data.js` – Muskeln, 101 Übungen mit Gerät, Gerätefilter (Studio, zu Hause, Kurzhanteln, Band, ohne Gerät, Mobility) und Ausführungshinweis, 12 fertige Pläne (auch für zu Hause und Mobility) mit Trainingsziel (Kraft & Muskeln, Kraftausdauer, Athletik)
- `js/store.js` – Speicherung, Volumen pro Muskel, doppelte Progression
- `js/nutrition.js` – Energiebedarf (Mifflin-St Jeor × PAL), Makroziele mit Quellen, Open-Food-Facts-Abfragen
- `js/vendor/zxing.min.js` – Barcode-Erkennung (ZXing 0.21.3, Apache-2.0, siehe `zxing-LICENSE`), wird nur geladen, wenn der Browser keinen eigenen BarcodeDetector hat
- `js/onboarding.js` – Einstieg für neue Nutzer: fünf Fragen, Planvorschlag aus den Vorlagen, Satzzahl passend zur Zeit
- `js/anim.js` – selbst gezeichnete Bewegungsabläufe (SVG-Strichfiguren mit Gerät). Ähnliche Übungen teilen sich eine Vorlage, eigene Übungen bekommen die Vorlage ihres Hauptmuskels. Bei „Bewegung reduzieren“ Start- und Endposition als Standbild
- `js/bell.js` – Pausenende: selbst synthetisierte Ringglocke (Web Audio, mischt sich mit Musik; optional als Audiodatei auch im Hintergrund) und Ansage „Next Round“ über die Sprachausgabe des Geräts
- `js/body3d.js` – 3D-Körperkarte aus einfachen Formen, Muskeln antippbar, Drehen per Ziehen. Liste als gleichwertige Alternative
- `js/vendor/three.module.min.js` – three.js r170 (MIT, siehe `three-LICENSE`), wird nur auf der Körperkarte geladen
- `js/app.js` – Screens und Bedienung
- `js/i18n.js`, `js/lang/*.js` – Sprachen (Deutsch als Ausgangssprache, Englisch). Anleitung für eine neue Sprache steht oben in `js/i18n.js`; `node tools/i18n-check.js` meldet fehlende Übersetzungen
- `icons/icon.svg` – einzige Quelle für das App-Icon. Ändern: SVG bearbeiten, `node tools/make-icons.js` erzeugt alle PNGs, dann veröffentlichen
- `sw.js`, `manifest.webmanifest`, `icons/` – Offline-Betrieb und Installation; `icons/splash/` iOS-Startbilder (`node tools/make-splash.js`), `icons/screens/` Screenshots fürs Manifest (`node tools/make-screens.js`)
- `fonts/archivo-satz.woff2` – Wortmarken-Schrift Archivo (SIL OFL), auf „SATZ.“ reduziert (1 KB), selbst gehostet
- `docs/aufbau.md` – Aufbau der App: Bildschirme, Navigation, Darstellung, Technik

## Regeln hinter der App
- Doppelte Progression pro Übung: Alle Sätze in der Spanne und der erste Satz am oberen Ende, dann Gewicht um den Steigerungsschritt erhöhen (ein verpatzter letzter Satz blockiert nicht). Ist der Schritt größer als 10 % der Last (leichte Übungen wie Seitheben), muss der erste Satz 2 Wdh. über die Spanne kommen. Prozentuale Schritte gibt es bewusst nicht: Kurzhanteln und Scheiben haben feste Abstufungen. Alle Sätze unter der Spanne: einen Schritt leichter. Über 14 Tage Pause: Start mit ca. 90 %.
- Wochenvolumen pro Muskel: Hauptmuskel 1 Satz, mitarbeitender Muskel 0,5 Satz. Bereich 10–20 Sätze für große Muskelgruppen.
- Pausen-Standard: schwere Grundübungen (bis 8 Wdh.) 180 s, andere Grundübungen 120 s, Isolationsübungen 90 s. Grundübungen sind fest markiert.
- Plateau: dreimal in Folge kein Fortschritt (weder höheres Spitzengewicht noch mehr Wdh. mit dem gleichen Gewicht) → ein leichteres Training mit 90 %, danach neu steigern. Bewusst ohne geschätztes 1RM, weil Epley über etwa 10 Wdh. ungenau wird.
- Aufwärmrampe: Bei Grundübungen ab 30 kg bietet SATZ vor dem ersten Satz etwa 50/70/85 % des Arbeitsgewichts mit 8/5/3 Wdh. an. Ein Tipp übernimmt sie, jedes Speichern trägt den nächsten Aufwärmsatz ein.
- Geführte Gewichtsfindung bei neuen Übungen mit Gewicht: Testsätze (zählen als Aufwärmsätze) mit Angabe der Wdh. in Reserve. Aus Gewicht × (Wdh. + RIR) schätzt SATZ nach Epley das Gewicht für das obere Ende der Spanne mit etwa 3 in Reserve. „4+“ zählt als 6, ohne Angabe rechnet SATZ mit 1. Gefunden, wenn die Reserve 1–3 ist und das Gewicht höchstens einen Schritt abweicht; spätestens nach 4 Testsätzen. Kein Raten mehr am Übungsnamen.
- Entlastung: Für neue Pläne ab 0.11.4 standardmäßig aus (bestehende Pläne behalten ihren Rhythmus, umstellbar unter Plan bearbeiten → Rhythmus). Stattdessen reaktiv: Stehen mindestens 2 Übungen des Plans seit 3 Trainings still oder lagen in 14 Tagen mindestens 60 % der Arbeitssätze mit RIR-Angabe (mind. 8) bei 0, schlägt „Heute“ eine Entlastungswoche vor (nicht, wenn in den letzten 4 Wochen schon entlastet wurde). Der feste Rhythmus alle 4–8 Wochen (Bell et al. 2023) ist ein Expertenkonsens, kein Wirksamkeitsbeleg.
- Volumen zählt nur harte Sätze (Arbeits- und Drop-Sätze, nicht 4+ in Reserve, keine Aufwärmsätze).
- Satzziel zählt nur Arbeitssätze. Aufwärm- und Drop-Sätze kommen zusätzlich dazu und stehen in der Satz-Tabelle vor bzw. unter ihrem Satz.
- Verlauf hängt an festen Übungs-IDs: Umbenennen und Tauschen verändern alte Trainings nicht. Trainings speichern Plan- und Tagesnamen als Kopie.
- Ernährung: Grundumsatz nach Mifflin-St Jeor, Aktivitätsfaktor nach FAO/WHO/UNU 2004, Ziel −0,5 % / 0 / +0,25 % Körpergewicht pro Woche, Protein 2,0 / 1,6 / 1,8 g/kg (Abnehmen / Halten / Aufbauen), Fett 25 % der Energie, Rest Kohlenhydrate. Quellen in der App unter Ernährung → Ziel.
- Trainingsziele, abgeglichen mit dem ACSM Position Stand 2026 zum Krafttraining gesunder Erwachsener (Medicine & Science in Sports & Exercise, 137 Übersichtsarbeiten, ersetzt den Stand von 2009; Kernaussagen laut ACSM: https://acsm.org/resistance-training-guidelines-update-2026/). Kraft: schwere Lasten um 80 % 1RM, 2–3 Sätze pro Übung. Muskelaufbau: etwa 10 Sätze pro Muskel und Woche. Schnellkraft: 30–70 % 1RM, schnell bewegt. Regelmäßigkeit zählt mehr als Versagen, Geräteart oder Periodisierung.
  - Kraft & Muskeln: 6–12 Wdh., 2–3 min Pause (passt zu beiden Zielen).
  - Kraftausdauer: 15–25 Wdh., unter 1 min Pause. Die Pausenlänge ist eine Praxisregel; der Volltext des Position Stand wurde dafür nicht geprüft.
  - Athletik: explosive Übungen mit 3–6 Wdh., 30–70 % Last, lange Pausen.
  - Übungen aus der Körperkarte starten mit dem Satzschema des Plan-Ziels.
- Datenschutz Ernährung: An Open Food Facts gehen nur Barcode oder Suchbegriff. Profil, Gewicht und Tagebuch bleiben auf dem Gerät.

## Sprachen
- Deutscher Text im Code ist zugleich der Schlüssel: `tx("Training starten")`, Mehrzahl mit `txn(n, "{n} Satz", "{n} Sätze")`. Fehlt eine Übersetzung, erscheint Deutsch.
- Beim allerersten Start (noch keine Daten auf dem Gerät) zeigt der Ladebildschirm die Sprachauswahl, vorbelegt nach Gerätesprache. Bestehende Nutzer behalten Deutsch ohne Auswahl. Ändern unter Mehr → Sprache.
- Gespeicherte Namen (Pläne, Tage, eigene Übungen, Trainings) werden nie übersetzt oder umgeschrieben. Mitgelieferte Übungen und Vorlagen bleiben auf Deutsch gespeichert und werden nur in der Anzeige übersetzt (`exName()`, `lib()` in `js/app.js`); hat der Nutzer etwas umbenannt, erscheint sein Name.

## Veröffentlichen
1. Änderung machen, in `sw.js` die `CACHE`-Version und in `js/app.js` `APP_VERSION` erhöhen.
2. Nach `main` pushen. GitHub Pages veröffentlicht in etwa einer Minute; installierte Apps laden die neue Version beim nächsten Öffnen.
3. Ein neues App-Icon übernimmt iOS erst nach Entfernen und erneutem Hinzufügen zum Home-Bildschirm.
