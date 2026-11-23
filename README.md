# SATZ – Trainingsheft (Version 0.3)

Installierbare Web-App (PWA) fürs Krafttraining. Läuft im Browser, offline, ohne Konto. Alle Daten bleiben auf dem Gerät (localStorage), Sicherung als JSON-Datei unter „Mehr“.

## Starten (lokal)
```
cd satz-app
python3 -m http.server 8000
```
Dann http://localhost:8000 öffnen. Direkt per Doppelklick (file://) funktioniert es nicht, weil ES-Module und Service Worker einen Webserver brauchen.

## Aufs Handy
Die App muss über HTTPS erreichbar sein, z. B. über GitHub Pages. Danach im Browser öffnen und „Zum Home-Bildschirm“ wählen (iPhone: Safari > Teilen; Android: Chrome-Menü > App installieren).

## Aufbau
- `index.html` – Gerüst mit Navigation
- `css/app.css` – iOS-Look nach Apple Human Interface Guidelines (Systemschrift mit Dynamic Type, gruppierte Listen, schwebende Tab-Bar), hell/dunkel/erhöhter Kontrast
- `js/data.js` – Muskeln, 34 Übungen, 5 fertige Pläne
- `js/store.js` – Speicherung, Volumen pro Muskel, doppelte Progression
- `js/nutrition.js` – Energiebedarf (Mifflin-St Jeor × PAL), Makroziele mit Quellen, Open-Food-Facts-Abfragen
- `js/vendor/zxing.min.js` – Barcode-Erkennung (ZXing 0.21.3, Apache-2.0, siehe `zxing-LICENSE`), wird nur geladen, wenn der Browser keinen eigenen BarcodeDetector hat
- `js/app.js` – Screens und Bedienung
- `sw.js`, `manifest.webmanifest`, `icons/`, `fonts/` – Offline-Betrieb und Installation (Wortmarken-Schrift selbst gehostet, keine Anfragen an Google)

## Regeln hinter der App
- Doppelte Progression pro Übung: alle Sätze am oberen Ende der Spanne, dann Gewicht um den Steigerungsschritt erhöhen. Alle Sätze unter der Spanne: einen Schritt leichter. Über 14 Tage Pause: Start mit ca. 90 %.
- Wochenvolumen pro Muskel: Hauptmuskel 1 Satz, mitarbeitender Muskel 0,5 Satz. Bereich 10–20 Sätze für große Muskelgruppen.
- Pausen-Standard: Grundübungen 120 s, Isolationsübungen 90 s.
- Verlauf hängt an festen Übungs-IDs: Umbenennen und Tauschen verändern alte Trainings nicht. Trainings speichern Plan- und Tagesnamen als Kopie.
- Ernährung: Grundumsatz nach Mifflin-St Jeor, Aktivitätsfaktor nach FAO/WHO/UNU 2004, Ziel −0,5 % / 0 / +0,25 % Körpergewicht pro Woche, Protein 2,0 bzw. 1,6 g/kg, Fett 25 % der Energie, Rest Kohlenhydrate. Quellen in der App unter Ernährung → Ziel.
- Datenschutz Ernährung: An Open Food Facts gehen nur Barcode oder Suchbegriff. Profil, Gewicht und Tagebuch bleiben auf dem Gerät.
