# SATZ – Trainingsheft (Version 0.1)

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
- `css/app.css` – Design-Tokens (Papier, Tinte, Signalrot), hell/dunkel/hoher Kontrast
- `js/data.js` – Muskeln, 34 Übungen, 5 fertige Pläne
- `js/store.js` – Speicherung, Volumen pro Muskel, doppelte Progression
- `js/app.js` – Screens und Bedienung
- `sw.js`, `manifest.webmanifest`, `icons/`, `fonts/` – Offline-Betrieb und Installation (Schriften selbst gehostet, keine Anfragen an Google)

## Regeln hinter der App
- Doppelte Progression pro Übung: alle Sätze am oberen Ende der Spanne, dann Gewicht um den Steigerungsschritt erhöhen. Alle Sätze unter der Spanne: einen Schritt leichter. Über 14 Tage Pause: Start mit ca. 90 %.
- Wochenvolumen pro Muskel: Hauptmuskel 1 Satz, mitarbeitender Muskel 0,5 Satz. Bereich 10–20 Sätze für große Muskelgruppen.
- Pausen-Standard: Grundübungen 120 s, Isolationsübungen 90 s.
- Verlauf hängt an festen Übungs-IDs: Umbenennen und Tauschen verändern alte Trainings nicht. Trainings speichern Plan- und Tagesnamen als Kopie.
