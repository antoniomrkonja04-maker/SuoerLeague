# Squad Hub und gemeinsamer Saisonkalender

## Ziel

Career erhält einen Squad Hub zur Verwaltung der gedrafteten Mannschaft und einen ligaweit synchronisierten Saisonkalender. Der bestehende Liga-, Draft- und Transfer-Spielstand bleibt erhalten. Login, Football Life-Integration und automatische Übertragung realer Spielergebnisse liegen außerhalb dieses Arbeitspakets.

## Aktueller Stand

- Career ist eine Vanilla-JavaScript-WebApp mit Node-HTTP-Server.
- Liga und Draft leben im gemeinsamen JSON-Spielstand und werden über `/api/state` synchronisiert.
- Eine Mannschaft hat eine Managerart (`human` oder `cpu`). Die Spielerzuordnung entsteht über `league.draft.picks`; Transfers ändern diese Zuordnung.
- Ergebnisse werden derzeit als einzelne Lobby plus `matchHistory` gepflegt.
- Es gibt noch keine Aufstellungen, Spielpläne oder Kalenderdaten.

## Umsetzung in zwei Produktinkrementen

### 1. Squad Hub

- Neue Ansicht „Squad Hub“ mit Spielfeld in der Mitte und Bankliste rechts, visuell an der mitgelieferten Taktikansicht orientiert.
- Die Kaderliste eines Teams wird aus dessen aktuellen Draft-Picks gebildet; abgeschlossene Transfers werden berücksichtigt.
- Elf Starterplätze werden auf einem Standard-4-3-3-Pitch dargestellt. Spieler können per Drag-and-drop zwischen Starterplätzen verschoben oder mit einem Bankspieler getauscht werden. Eine schlichte Tastatur-/Klickauswahl ergänzt Drag-and-drop.
- Startelf und Formation werden je Team in `league.squads[teamId]` gespeichert. Nicht belegte Plätze bleiben offen, falls das Team weniger als elf Spieler hat. Es werden keine Spieler erfunden oder automatisch zugewiesen.
- Jede menschliche Managerrolle bearbeitet nur das eigene Team. Der Host kann CPU-Aufstellungen anpassen.
- Bestandsspielstände ohne `squads` bleiben gültig; leere Aufstellungen werden beim Lesen als Standard behandelt und beim ersten Speichern ergänzt.

### 2. Kalender und Saisonfortschritt

- Round-robin-Spielplan für 30 Teams mit 29 Gegnern je Team, Heim- und Rückspiel, insgesamt 58 Spieltagen pro Team und 870 Saisonspielen.
- Ein Kalenderdatum und der Fortschritt gehören zum Liga-Spielstand, damit alle Browser denselben Saisonstand sehen.
- Der Host wählt ein Kalenderdatum; Career verarbeitet offene Ereignisse bis einschließlich dieses Datums in zeitlicher Reihenfolge. CPU-CPU- und Mensch-CPU-Partien werden mit der vorhandenen Barebones-Simulation abgeschlossen.
- Begegnungen zweier menschlich verwalteter Teams werden sichtbar mit eigener Farbe und dezenter Aura markiert. Die Datumssimulation überspringt diese Partien und lässt sie als „manuell zu spielen“ offen; das Ergebnis kann anschließend durch den Host eingetragen werden.
- Bereits abgeschlossene Spiele werden nicht erneut simuliert. Die Simulation muss wiederholbar und idempotent sein, damit erneute Anfragen keine doppelten Ergebnisse erzeugen.
- Der Kalender zeigt nächste Partien, Ergebnisse, Fortschritt und gemeinsame Transferfristen am 31. August und 31. Januar. Diese Fristen werden als Ligaereignisse angezeigt; sie ändern allein keine Transferregeln.
- UI und Status verwenden den gemeinsamen JSON-Spielstand und dessen Revisionen. Veraltete gleichzeitige Schreibversuche dürfen den neueren Zustand nicht überschreiben.

## Spielsimulation und Tabellen

- Für CPU-Partien wird eine einfache deterministische Ergebnisberechnung mit einem stabilen Seed aus Saison, Spiel-ID und Teamdaten verwendet. Damit ergibt dieselbe Partie nach Refresh dasselbe Ergebnis.
- Ergebnisse werden an `matchHistory` angefügt und referenzieren eine stabile Spiel-ID. Vorhandene manuelle Lobby-/Ergebniswege bleiben nutzbar.
- Tabellen werden aus den gespielten Ergebnissen berechnet; nicht gespielte Mensch-Mensch-Spiele zählen nicht.
- Das ist eine lokale Barebones-Hostsimulation, kein Echtzeit-Multiplayer-Protokoll und keine authentifizierte Admin-Sicherheitsgrenze.

## Daten- und Kompatibilitätsregeln

- Keine neue Datenbank oder kostenpflichtige Abhängigkeit.
- Neue optionale Felder unter `league`: `squads`, `schedule`, `currentDate`; bestehende Zustandsleser verwenden sichere Defaults.
- Spiel-ID wird deterministisch aus Liga-/Saisonkennung, Spieltag, Heimteam und Auswärtsteam gebildet.
- Keine vorhandenen Draft-Picks, Transfers, Teams oder Logs werden beim Ergänzen des Schemas gelöscht oder ersetzt.
- Ein Liga-Reset bleibt nur der bestehende ausdrücklich ausgelöste lokale Reset; der Feature-Code setzt keine Liga automatisch zurück.

## Fehlerfälle und Rechte

- Drag-and-drop auf ungültige Ziele ändert den Spielstand nicht.
- Spieler darf in einer Aufstellung höchstens einmal vorkommen; unbekannte oder nicht im Teamkader befindliche IDs werden abgelehnt.
- Nur der Host darf das Datum fortschreiben und automatische Spiele simulieren. Menschliche Manager dürfen die Aufstellung ihres eigenen Teams ändern.
- Simulation validiert Ziel-Datum, Spiel-IDs und Score-Werte vor dem Speichern.
- Falls ein gemeinsamer Schreibkonflikt auftritt, wird der neuere Spielstand geladen und der Nutzer erhält eine verständliche Meldung.

## Testplan

- Squad-Kernlogik: Kader aus Draft-Picks/Transfers, Starter-Bank-Tausch, Positionswechsel, doppelte/unbekannte Spieler und unterschiedliche Managerrechte.
- Spielplan: 30 Teams ergeben 870 eindeutige Spiele, jedes Team spielt 58 Mal und jedes Gegnerpaar spielt je einmal zuhause.
- Simulation: Zieltag inklusive, frühere und wiederholte Simulation erzeugen keine doppelten Resultate; Mensch-Mensch-Spiele bleiben offen; CPU-Partien sind deterministisch.
- Regression: bestehende Draft-, Transfer-, Shared-State-, Tabelle- und Match-Tests bleiben erfolgreich.
- UI-Verifikation in zwei Browser-Sitzungen: gemeinsame Aufstellung und Kalenderfortschritt; menschliche Paarung wird korrekt hervorgehoben.

## Annahmen

- Die zuvor festgelegten 58 Spieltage und Transferfristen (31. August/31. Januar) gelten weiterhin.
- Die 4-3-3-Formation dient als Startdarstellung; spätere Formationseditoren gehören nicht zum ersten Squad-Inkrement.
- Ein Team mit weniger als elf Kader-Spielern zeigt freie Starterplätze; der aktuelle Pool mit 297 Spielern garantiert bei 30 Teams keine volle 11er-Elf je Team.
