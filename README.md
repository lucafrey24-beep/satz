# SATZ – Trainingsheft (Version 0.7)

Installierbare Web-App (PWA) fürs Krafttraining. Läuft im Browser, offline, ohne Konto. Alle Daten bleiben auf dem Gerät (localStorage), Sicherung als JSON-Datei unter „Mehr“.

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
- `js/data.js` – Muskeln, 43 Übungen mit Gerät und Ausführungshinweis, 8 fertige Pläne mit Trainingsziel (Kraft & Muskeln, Kraftausdauer, Athletik)
- `js/store.js` – Speicherung, Volumen pro Muskel, doppelte Progression
- `js/nutrition.js` – Energiebedarf (Mifflin-St Jeor × PAL), Makroziele mit Quellen, Open-Food-Facts-Abfragen
- `js/vendor/zxing.min.js` – Barcode-Erkennung (ZXing 0.21.3, Apache-2.0, siehe `zxing-LICENSE`), wird nur geladen, wenn der Browser keinen eigenen BarcodeDetector hat
- `js/anim.js` – selbst gezeichnete Bewegungsabläufe (SVG-Strichfiguren mit Gerät). Ähnliche Übungen teilen sich eine Vorlage, eigene Übungen bekommen die Vorlage ihres Hauptmuskels. Bei „Bewegung reduzieren“ Start- und Endposition als Standbild
- `js/body3d.js` – 3D-Körperkarte aus einfachen Formen, Muskeln antippbar, Drehen per Ziehen. Liste als gleichwertige Alternative
- `js/vendor/three.module.min.js` – three.js r170 (MIT, siehe `three-LICENSE`), wird nur auf der Körperkarte geladen
- `js/app.js` – Screens und Bedienung
- `sw.js`, `manifest.webmanifest`, `icons/`, `fonts/` – Offline-Betrieb und Installation (Wortmarken-Schrift selbst gehostet, keine Anfragen an Google)

## Regeln hinter der App
- Doppelte Progression pro Übung: alle Sätze am oberen Ende der Spanne, dann Gewicht um den Steigerungsschritt erhöhen. Alle Sätze unter der Spanne: einen Schritt leichter. Über 14 Tage Pause: Start mit ca. 90 %.
- Wochenvolumen pro Muskel: Hauptmuskel 1 Satz, mitarbeitender Muskel 0,5 Satz. Bereich 10–20 Sätze für große Muskelgruppen.
- Pausen-Standard: schwere Grundübungen (bis 8 Wdh.) 180 s, andere Grundübungen 120 s, Isolationsübungen 90 s. Grundübungen sind fest markiert.
- Plateau: dreimal in Folge kein neuer Bestwert beim geschätzten 1RM (Epley) → ein leichteres Training mit 90 %, danach neu steigern.
- Volumen zählt nur harte Sätze (Arbeits- und Drop-Sätze, nicht 4+ in Reserve, keine Aufwärmsätze).
- Verlauf hängt an festen Übungs-IDs: Umbenennen und Tauschen verändern alte Trainings nicht. Trainings speichern Plan- und Tagesnamen als Kopie.
- Ernährung: Grundumsatz nach Mifflin-St Jeor, Aktivitätsfaktor nach FAO/WHO/UNU 2004, Ziel −0,5 % / 0 / +0,25 % Körpergewicht pro Woche, Protein 2,0 bzw. 1,6 g/kg, Fett 25 % der Energie, Rest Kohlenhydrate. Quellen in der App unter Ernährung → Ziel.
- Trainingsziele nach ACSM Position Stand 2009: Kraft & Muskeln 6–12 Wdh. und 2–3 min Pause, Kraftausdauer 15–25 Wdh. und unter 1 min Pause, Athletik explosive Übungen mit 3–6 Wdh. und langen Pausen. Übungen aus der Körperkarte starten mit dem Satzschema des Plan-Ziels.
- Datenschutz Ernährung: An Open Food Facts gehen nur Barcode oder Suchbegriff. Profil, Gewicht und Tagebuch bleiben auf dem Gerät.
