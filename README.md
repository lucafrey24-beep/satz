# SATZ – Trainingsheft (Version 0.9.2)

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
- Doppelte Progression pro Übung: alle Sätze am oberen Ende der Spanne, dann Gewicht um den Steigerungsschritt erhöhen. Alle Sätze unter der Spanne: einen Schritt leichter. Über 14 Tage Pause: Start mit ca. 90 %.
- Wochenvolumen pro Muskel: Hauptmuskel 1 Satz, mitarbeitender Muskel 0,5 Satz. Bereich 10–20 Sätze für große Muskelgruppen.
- Pausen-Standard: schwere Grundübungen (bis 8 Wdh.) 180 s, andere Grundübungen 120 s, Isolationsübungen 90 s. Grundübungen sind fest markiert.
- Plateau: dreimal in Folge kein neuer Bestwert beim geschätzten 1RM (Epley) → ein leichteres Training mit 90 %, danach neu steigern.
- Volumen zählt nur harte Sätze (Arbeits- und Drop-Sätze, nicht 4+ in Reserve, keine Aufwärmsätze).
- Satzziel zählt nur Arbeitssätze. Aufwärm- und Drop-Sätze kommen zusätzlich dazu und stehen in der Satz-Tabelle vor bzw. unter ihrem Satz.
- Verlauf hängt an festen Übungs-IDs: Umbenennen und Tauschen verändern alte Trainings nicht. Trainings speichern Plan- und Tagesnamen als Kopie.
- Ernährung: Grundumsatz nach Mifflin-St Jeor, Aktivitätsfaktor nach FAO/WHO/UNU 2004, Ziel −0,5 % / 0 / +0,25 % Körpergewicht pro Woche, Protein 2,0 / 1,6 / 1,8 g/kg (Abnehmen / Halten / Aufbauen), Fett 25 % der Energie, Rest Kohlenhydrate. Quellen in der App unter Ernährung → Ziel.
- Trainingsziele nach ACSM Position Stand 2009: Kraft & Muskeln 6–12 Wdh. und 2–3 min Pause, Kraftausdauer 15–25 Wdh. und unter 1 min Pause, Athletik explosive Übungen mit 3–6 Wdh. und langen Pausen. Übungen aus der Körperkarte starten mit dem Satzschema des Plan-Ziels.
- Datenschutz Ernährung: An Open Food Facts gehen nur Barcode oder Suchbegriff. Profil, Gewicht und Tagebuch bleiben auf dem Gerät.

## Sprachen
- Deutscher Text im Code ist zugleich der Schlüssel: `tx("Training starten")`, Mehrzahl mit `txn(n, "{n} Satz", "{n} Sätze")`. Fehlt eine Übersetzung, erscheint Deutsch.
- Beim allerersten Start (noch keine Daten auf dem Gerät) zeigt der Ladebildschirm die Sprachauswahl, vorbelegt nach Gerätesprache. Bestehende Nutzer behalten Deutsch ohne Auswahl. Ändern unter Mehr → Anzeige → Sprache.
- Gespeicherte Namen (Pläne, Tage, eigene Übungen, Trainings) werden nie übersetzt.

## Veröffentlichen
1. Änderung machen, in `sw.js` die `CACHE`-Version und in `js/app.js` `APP_VERSION` erhöhen.
2. Nach `main` pushen. GitHub Pages veröffentlicht in etwa einer Minute; installierte Apps laden die neue Version beim nächsten Öffnen.
3. Ein neues App-Icon übernimmt iOS erst nach Entfernen und erneutem Hinzufügen zum Home-Bildschirm.
