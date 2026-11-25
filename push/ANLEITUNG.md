# Push-Erinnerung einrichten

SATZ schickt dir an Trainingstagen eine Mitteilung aufs iPhone, auch wenn die App zu ist. Es gibt keinen eigenen Server: Ein GitHub-Ablauf in diesem Repo (`.github/workflows/push-erinnerung.yml`) prüft alle 15 Minuten, ob heute Training ist, und schickt die Nachricht über Apples Push-Dienst.

Du brauchst das einmal, dauert etwa 5 Minuten. Alles geht direkt am iPhone.

## 1. In der App aktivieren
1. SATZ **vom Home-Bildschirm** öffnen (nicht in Safari, sonst gibt es kein Push). iOS 16.4 oder neuer.
2. **Mehr** → **Erinnerung im Kalender**: Uhrzeit und Vorlauf einstellen (z. B. 18:00, 15 Min. vorher).
3. Darunter **Push-Erinnerung** → **Erinnerungen aktivieren** → bei der Frage **Erlauben** tippen.
4. **Code kopieren** tippen.

Der Code ist wie ein Passwort. Schick ihn dir nicht per Mail oder Messenger, sondern füg ihn direkt im nächsten Schritt ein.

## 2. Code als Secret in GitHub ablegen
1. Diesen Link öffnen (du musst bei GitHub angemeldet sein): https://github.com/lucafrey24-beep/satz/settings/secrets/actions/new
2. Bei **Name** eintragen: `SATZ_PUSH`
3. Bei **Secret** den kopierten Code einfügen (lange tippen → Einsetzen).
4. **Add secret** tippen.

GitHub zeigt den Inhalt danach nie wieder an, auch dir nicht. Das ist so gewollt.

## 3. Testen
1. https://github.com/lucafrey24-beep/satz/actions/workflows/push-erinnerung.yml öffnen.
2. Rechts **Run workflow** → Haken bei „Sofort eine Test-Nachricht senden“ lassen → grünes **Run workflow**.
3. Nach etwa einer Minute kommt „Test: Push-Erinnerungen funktionieren.“

Kommt nichts: Den Lauf in der Liste antippen und die rote Meldung lesen. Die Meldungen sind auf Deutsch und sagen, was zu tun ist.

## Wenn du etwas änderst
Uhrzeit, Trainingstage, verschobene Trainings, Ruhetage und Pausen stecken im Code. GitHub sieht deine Änderungen in der App nicht von selbst. SATZ zeigt unter Push-Erinnerung „Plan geändert seit dem letzten Kopieren“, sobald das nötig ist. Dann:
1. In SATZ **Code kopieren**.
2. https://github.com/lucafrey24-beep/satz/settings/secrets/actions öffnen → bei `SATZ_PUSH` auf den Stift → neuen Code einfügen → **Update secret**.

## Ausschalten
In SATZ **Erinnerungen ausschalten**. Danach das Secret unter https://github.com/lucafrey24-beep/satz/settings/secrets/actions löschen. Ohne Secret läuft der Ablauf weiter, tut aber nichts. Ganz abschalten: auf der Seite aus Schritt 3 oben rechts **···** → **Disable workflow**.

## Was du wissen solltest
- **Uhrzeit ist ungenau.** GitHub startet zeitgesteuerte Abläufe oft 5 bis 30 Minuten zu spät, bei hoher Last auch später, selten gar nicht. Die Mitteilung kommt frühestens zur eingestellten Zeit und nie doppelt. Ist sie 90 Minuten nach der Zeit noch nicht raus, fällt sie für den Tag aus. Wer es minutengenau braucht, nimmt die Kalenderdatei.
- **Nach 60 Tagen ohne Änderung im Repo** schaltet GitHub zeitgesteuerte Abläufe in öffentlichen Repos ab und schickt dir vorher eine Mail. Dann auf der Seite aus Schritt 3 **Enable workflow** tippen.
- **Schon trainiert?** GitHub weiß nicht, ob du heute schon trainiert hast. An einem Trainingstag kommt die Mitteilung trotzdem.
- **Abo abgelaufen:** Wenn du die Mitteilungen für SATZ in den iPhone-Einstellungen ausschaltest oder SATZ vom Home-Bildschirm löschst, endet das Abo. Der nächste Lauf schlägt dann fehl und GitHub schickt dir eine Mail. In SATZ neu aktivieren und den Code im Secret ersetzen.
- **Fokus / Nicht stören** auf dem iPhone kann die Mitteilung stummschalten.
- **Datenschutz:** Der Code enthält die Adresse deines Push-Abos, einen selbst erzeugten Schlüssel und deinen Trainingsplan (Tage, Uhrzeit), keine Trainings, Gewichte oder Körperdaten. Er liegt nur als verschlüsseltes Secret bei GitHub. Die Nachricht selbst ist Ende-zu-Ende verschlüsselt; Apple sieht nur, dass eine Mitteilung kommt.
