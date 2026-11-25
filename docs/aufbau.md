# SATZ – Aufbau der App

Dieses Dokument beschreibt, **wie die App gebaut ist und wie man sich in ihr bewegt**. Die Fitness-Inhalte (Pläne, Übungen, Trainingsregeln, Ernährungsformeln) beschreibt es nicht. Stand: Version 0.7.2.

---

## 1. Was SATZ technisch ist

| Punkt | Umsetzung |
|---|---|
| Art | Progressive Web App (PWA): eine Webseite, die sich wie eine App auf den Home-Bildschirm legen lässt |
| Adresse | https://lucafrey24-beep.github.io/satz/ |
| Technik | Reines HTML, CSS und JavaScript (ES-Module). Kein Framework und kein Build-Schritt |
| Hosting | GitHub Pages, veröffentlicht direkt aus dem Branch `main` |
| Daten | Bleiben nur auf dem Gerät (localStorage). Es gibt kein Konto und keinen Server |
| Offline | Ein Service Worker speichert alle Dateien, danach läuft die App ohne Netz |
| Netz nötig für | Nur die Produktsuche bei Open Food Facts (Barcode oder Suchbegriff) |

### Dateien

```
index.html              Gerüst: Kopfleiste, Inhaltsbereich, Tab-Bar, Dialog, Ladebildschirm
css/app.css             Gesamtes Aussehen (Farben, Schrift, Komponenten, hell/dunkel)
js/app.js               Bildschirme, Navigation, Bedienung (Router + alle Ansichten)
js/store.js             Speichern, Laden, Migration, Import-Prüfung, Rechenlogik
js/data.js              Feste Daten (Muskeln, Übungen, Vorlagen)
js/nutrition.js         Ernährungsrechnung, Open-Food-Facts-Abfragen
js/anim.js              Bewegungsabläufe als animierte SVG-Strichfiguren
js/body3d.js            3D-Körperkarte (three.js)
js/vendor/              Fremdbibliotheken lokal: three.js (MIT), ZXing (Apache-2.0)
sw.js                   Service Worker (Offline, Updates)
manifest.webmanifest    App-Name, Farben, Icons für die Installation
icons/icon.svg          Einzige Quelle des App-Icons; tools/make-icons.js erzeugt die PNGs
fonts/archivo.woff2     Schrift der Wortmarke, selbst gehostet
```

---

## 2. Bildschirmaufbau

Jeder Bildschirm hat drei feste Schichten:

1. **Kopfleiste oben** (durchscheinend mit Unschärfe, wie in iOS)
   - Auf Hauptseiten steht links die Wortmarke **SATZ.**. Tippen führt zu „Heute“.
   - Auf Unterseiten steht links ein Zurück-Knopf, z. B. „‹ Pläne“.
   - Beim Scrollen klappt der große Seitentitel in die Mitte der Leiste (iOS „Large Title“).
   - Im Training zeigt die Leiste „Beenden“ links, den Trainingstag in der Mitte und „Übersicht“ rechts.
2. **Inhaltsbereich** in der Mitte, scrollbar.
   - Er beginnt mit einem großen Titel (`h1`) und darunter Abschnitte mit kleinen grauen Überschriften in Großbuchstaben.
   - Er ist seitlich fest: Man kann nur nach oben und unten scrollen.
3. **Tab-Bar unten**: eine schwebende, abgerundete Leiste mit 5 Tabs. Eine „Pille“ markiert den aktiven Tab.

Für die wichtigste Aktion eines Bildschirms (z. B. „Training starten“, „Satz speichern“) gibt es eine **feste Aktionsleiste** über der Tab-Bar. Der Inhalt bekommt unten so viel Abstand, dass nichts verdeckt wird.

---

## 3. Navigation

### 3.1 Tabs (oberste Ebene)

| Tab | Inhalt (grob) |
|---|---|
| **Heute** | Startseite: Trainingstag von heute, Start-Knopf. Ohne Plan: Willkommen und Auswahl einer Vorlage |
| **Pläne** | Eigene Pläne, fertige Vorlagen, Körperkarte, Übungsverwaltung |
| **Verlauf** | Gewicht, Fortschritt, Wochenübersicht, vergangene Trainings |
| **Ernährung** | Tagebuch mit Tagesbilanz, Mahlzeiten, Gewicht |
| **Mehr** | Profil, Anzeige-Einstellungen, Training-Einstellungen, Datensicherung, Über |

Bedienung der Tab-Bar:
- Ein Tipp auf einen Tab wechselt den Bereich.
- Man kann die Pille seitlich auf einen anderen Tab ziehen und dort loslassen.

### 3.2 Unterseiten

Unterseiten gehören zu einem Tab, der in der Tab-Bar aktiv bleibt. Zurück geht es mit dem Knopf links oben.

| Unterseite | Gehört zu | Zurück nach |
|---|---|---|
| Vorlage ansehen | Pläne | Pläne |
| Plan bearbeiten | Pläne | Pläne |
| Übungen verwalten | Pläne | Pläne |
| Körperkarte | Pläne | Pläne |

### 3.3 Adressen (Router)

Jeder Bildschirm hat eine eigene Adresse mit `#`. Dadurch funktionieren die Zurück-Taste und die Wisch-Geste des Browsers, und Lesezeichen sind möglich.

```
#/heute   #/plaene   #/verlauf   #/ernaehrung   #/mehr
#/vorlage/<id>   #/plan/<id>   #/uebungen   #/koerper   #/training
```

Der Router in `js/app.js` liest die Adresse, baut den passenden Bildschirm neu auf, setzt den Fokus auf den Titel und schreibt den Seitentitel. Änderungen innerhalb eines Bildschirms bauen ihn neu auf und behalten dabei die Scrollposition.

### 3.4 Training als Vollbild-Modus

- Wer ein Training startet, kommt nach `#/training`. Die Tab-Bar verschwindet, die Kopfleiste zeigt nur „Beenden“ und „Übersicht“.
- Solange ein Training läuft, führt **jede** andere Adresse zurück ins Training. Man kann es also nicht aus Versehen verlassen.
- Raus kommt man nur über „Beenden“. Danach folgt eine Zusammenfassung mit Speichern, Weitertrainieren oder Verwerfen.
- Der Bildschirm bleibt im Training an (Wake Lock).

### 3.5 Sheets (Dialoge)

Bearbeiten, Auswählen und Bestätigen passiert in **Sheets**, die von unten hereinfahren (iOS-Stil):

- Beispiele: Übung wählen, Satzschema ändern, Lebensmittel hinzufügen, Menge eingeben, Gewicht eintragen, Ziele und Quellen.
- Schließen geht auf drei Wegen:
  - mit dem Knopf „Abbrechen“ oder „Fertig“,
  - durch Tippen neben das Sheet,
  - durch Wischen nach unten, wenn das Sheet ganz nach oben gescrollt ist.
- Enter in einem Eingabefeld löst die Hauptaktion des Sheets aus.
- Nach dem Schließen springt der Fokus auf den Knopf zurück, der das Sheet geöffnet hat.

### 3.6 Rückmeldungen

- **Toast** (kleine Meldung unten), z. B. „Training gelöscht.“
  - Mit „Rückgängig“-Knopf bleibt er 30 Sekunden stehen, ohne Knopf 6 Sekunden.
  - Löschen und ähnliche Aktionen fragen vorher nicht nach, sondern bieten danach „Rückgängig“ an.
- **Hinweis-Kästen** im Inhalt für wichtige Lagen, z. B. „Zeit für eine Sicherung“.
- **Fehler** erscheinen direkt im Sheet über den Feldern, mit klarer Handlungsanweisung.
- Nur „Alle Daten löschen“ verlangt eine Bestätigung durch Eintippen von LÖSCHEN.

### 3.7 Gesten im Überblick

| Geste | Wirkung |
|---|---|
| Tippen | Alles Bedienbare, mindestens 44 × 44 Punkte groß |
| Gedrückt halten auf − / + | Wert läuft immer schneller weiter |
| Pille in der Tab-Bar ziehen | Tab wechseln |
| Sheet nach unten wischen | Sheet schließen |
| Seitlich ziehen auf der 3D-Figur | Figur drehen; kurzes Tippen wählt einen Muskel |
| Browser-Zurück / Wischen vom Rand | Vorherige Adresse |

---

## 4. Start, Zustände, Updates

- **Ladebildschirm**:
  - Erscheint 2 Sekunden lang mit Wortmarke, Ladebalken und Versionsnummer, aber nur beim ersten Öffnen nach dem Schließen der App.
  - Beim Zurückkehren aus dem Hintergrund oder beim Neuladen nach einem Update kommt er nicht.
  - Tippen überspringt ihn.
  - Läuft gerade ein Training, entfällt er.
- **Erster Start** ohne Plan: Willkommensseite mit fertigen Plänen zur Auswahl oder einem leeren Plan.
- **Leere Zustände**: Jede leere Liste erklärt in einem Satz, was hier erscheinen wird und wie man anfängt.
- **Updates**:
  - Der Service Worker holt Dateien bevorzugt frisch aus dem Netz. Nach 3 Sekunden ohne Antwort nimmt er die gespeicherte Version.
  - Kommt eine neue Version an, lädt die App einmal neu, aber nie mitten im Training.
  - Jede Veröffentlichung erhöht die Cache-Version in `sw.js`.

---

## 5. Darstellung

### 5.1 Stil
- Angelehnt an Apples **Human Interface Guidelines**: Systemschrift, gruppierte Listen auf grauem Grund, weiße Karten, große Titel, durchscheinende Leisten.
- Eigenständig wird die App durch:
  - die schmale, fette Wortmarke „SATZ.“ in der Schrift Archivo,
  - die Akzentfarbe Grün,
  - Zahlen mit fester Breite.

### 5.2 Farben
Alle Farben sind als Variablen definiert (`:root` in `css/app.css`) und gelten in Hell und Dunkel:

| Rolle | Hell | Dunkel |
|---|---|---|
| Hintergrund | #F2F2F7 | #000000 |
| Karte | #FFFFFF | #1C1C1E |
| Text | #000000 | #FFFFFF |
| Text sekundär | #6C6C70 | #AEAEB2 |
| Akzent (Grün, Standard) | #00703A | #00C46A |

- Es gibt acht weitere Akzentfarben zur Wahl: Petrol, Kobalt, Violett, Beere, Signal, Kupfer, Ocker und Graphit. Jede erreicht in Hell und Dunkel mindestens 4,5:1 (Akzent auf Hintergrund und Schrift auf Akzent).
- Das Erscheinungsbild lässt sich auf Automatisch, Hell oder Dunkel stellen.
- „Kontrast erhöhen“ macht sekundären Text und Trennlinien kräftiger.

### 5.3 Schrift
- Fließtext in der Systemschrift (auf dem iPhone SF Pro), die der Textgröße aus den iOS-Einstellungen folgt (Dynamic Type).
- Zusätzlich kann man die Schrift in der App vergrößern: A+, A++ und A+++, bis 150 %.
- Die Wortmarke ist in Archivo gesetzt und liegt in der App. Es gehen keine Anfragen an Google Fonts.

### 5.4 Komponenten (wiederkehrende Bausteine)

| Baustein | Wofür |
|---|---|
| Karte | Abgegrenzte Einheit, z. B. ein Plan, die Tagesbilanz, das Gewicht |
| Gruppierte Liste | Zeilen mit Trennlinien, z. B. Einstellungen, Mahlzeiten |
| Segment-Schalter | Auswahl aus 2–4 Optionen, z. B. Satztyp, Vorne/Hinten, Trainingsziel |
| Stepper | Großer Zahlenwert mit − und +, antippen zum Eintippen (Gewicht, Wiederholungen) |
| Chips | Runde Auswahlknöpfe, z. B. Muskelgruppen |
| Schalter | Ein/Aus im iOS-Stil |
| Knöpfe | Primär (grün gefüllt), normal (grau), zerstörerisch (rote Schrift) |
| Diagramme | Schlichte SVG-Linien mit Trend, darunter immer eine Tabelle mit denselben Werten |
| Bewegungsablauf | Animierte Strichfigur mit Gerät und Ausführungshinweis |
| 3D-Figur | Drehbare Körperkarte, Muskeln als antippbare Flächen |

### 5.5 Barrierefreiheit
- Bildschirmleser (VoiceOver):
  - Jeder Bildschirm hat einen Titel, der nach dem Wechsel den Fokus bekommt.
  - Knöpfe haben sprechende Namen.
  - Statusmeldungen werden vorgelesen, z. B. „Satz 2 gespeichert“ oder „Pause vorbei“.
- Mindestgröße für alles Bedienbare: 44 × 44 Punkte.
- Die App ist vollständig mit der Tastatur bedienbar und hat sichtbare Fokusrahmen.
- „Bewegung reduzieren“ in iOS stoppt alle Animationen. Bewegungsabläufe erscheinen dann als Standbild mit Start- und Endposition, und die 3D-Figur dreht sich nicht von selbst.
- Zur 3D-Figur gibt es eine gleichwertige Liste der Muskelgruppen.
- Diagramme haben immer eine Tabelle als Alternative.
- Toasts mit „Rückgängig“ bleiben 30 Sekunden stehen (WCAG 2.2.1).

---

## 6. Daten und Sicherheit (Überblick)

- Alle Daten liegen als ein JSON-Objekt im localStorage unter `satz-data`.
- Beim Laden ergänzt eine Migration neue Felder automatisch. Alte Sicherungen bleiben so lesbar.
- Ist der Speicher beschädigt, wird er nicht überschrieben, sondern beiseitegelegt und lässt sich herunterladen.
- **Sicherung**: Unter Mehr exportiert man alle Daten als Datei und lädt sie wieder. Beim Laden wird jede Datei streng geprüft und neu aufgebaut.
- Die App erinnert alle 14 Tage an eine Sicherung, sobald es Trainings gibt.
- Eine Content-Security-Policy erlaubt nur eigene Skripte. Netzwerkverbindungen sind nur zu Open Food Facts erlaubt.

---

## 7. Veröffentlichen

1. Änderung im Code machen und in `sw.js` die Cache-Version erhöhen (`APP_VERSION` in `js/app.js` mitziehen).
2. Nach `main` pushen. GitHub Pages veröffentlicht automatisch in etwa einer Minute.
3. Installierte Apps holen sich die neue Version beim nächsten Öffnen von selbst.
4. Ausnahme App-Icon: iOS übernimmt ein neues Icon erst, wenn man die App vom Home-Bildschirm entfernt und neu hinzufügt.

## Datenschutz bei Updates (feste Regel ab 0.8.2)

Gespeicherte Trainings dürfen durch ein App-Update nie verloren gehen oder verändert werden.

- Vor dem ersten Start einer neuen App-Version legt `store.js` den kompletten alten Stand unter `satz-data-vor-update-<Zeit>` ab. Die letzten drei Kopien bleiben.
- `migrate()` ergänzt nur Felder und fasst `sessions` nicht an. Ändert sich die Trainingsliste beim Laden trotzdem, schreibt `load()` die geladenen Trainings unverändert zurück.
- Unter Mehr → Deine Daten lässt sich der Stand vor dem letzten Update wiederherstellen (mit Rückgängig).
- Für jede künftige Änderung gilt: Datenformat nur verlustfrei erweitern, nie Felder in Trainings umbenennen oder löschen.

## Neu in 0.9

- **Entlastungsrhythmus** (`store.js`: `cycleWeek`, `deloadNow`): Jeder Plan hat `cycle = {weeks, start}`. Standard 6 Wochen (5 Aufbau + 1 Entlastung), wählbar 4/5/6/8 oder aus, im Plan-Editor unter „Rhythmus“. In der Entlastungswoche halbiert `startSession` die Sätze, `suggest` schlägt ca. 90 % Last vor, das Training wird mit `deload: true` gespeichert und zählt nicht als Grundlage für die nächste Steigerung. Heute-Ansicht zeigt Woche x von n.
- **Adaptiver Bedarf** (`nutrition.js`: `adaptiveTdee`): Energiebilanz aus 14–28 Tagen Tagebuch (mind. 80 % der Tage eingetragen) und Gewichtstrend (Regression, mind. 5 Wiegungen über 10+ Tage). Übernommen landet er in `profile.tdeeAdj` und ersetzt Grundumsatz × PAL. Karte in Ernährung (heute), Rückweg im Ziel-Dialog.
- **Körpermaße** (`data.js`: `MEASURES`, Verlauf): `measures = [{date, m: {taille: 82, …}}]`, Eingabe von Hand in cm, Figur mit Messlinie und Anleitung zum fokussierten Feld, Verlauf als Liste und Diagramm, Taille ÷ Größe. Keine Fotos.
