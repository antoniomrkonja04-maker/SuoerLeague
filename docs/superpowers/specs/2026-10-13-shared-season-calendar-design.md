# Gemeinsamer Saisonkalender und Simulation

## Ziel

Die bestehende Career-Liga bekommt einen gemeinsamen Saisonkalender. Der Host kann ein Datum auswählen und alle bis dahin offenen CPU-Spiele simulieren. Spiele zwischen zwei menschlichen Managern bleiben offen und sind im Kalender erkennbar. Ergebnisse und Kalenderfortschritt sind im lokalen Mehrbrowser-Spielstand für alle Sitzungen gleich.

## Bestätigte Regeln

- Die Liga umfasst 30 Teams.
- Die Ligaphase spielt jeden Gegner einmal zuhause und einmal auswärts: 58 Spieltage je Club.
- Der Spielplan wird als Rundenturnier erzeugt. Jede Runde hat 15 Begegnungen.
- Der erste Spieltag ist der 1. August 2026. Die Runden liegen im Abstand von vier Tagen.
- Die besten acht Teams qualifizieren sich für Playoffs.
- Viertel- und Halbfinale werden mit Hin- und Rückspiel ausgetragen; das Finale ist ein einzelnes Spiel.
- Der Host wählt ein Kalenderdatum. Die Simulation verarbeitet jedes noch offene Spiel bis einschließlich dieses Datums.
- Spiele, bei denen beide Teams menschliche Manager haben, werden nicht automatisch simuliert. Sie bleiben offen, blockieren aber den globalen Kalenderfortschritt nicht.
- Für alle 30 Teams gelten gemeinsame Transferfenster: 1. Juli bis einschließlich 31. August und 1. bis einschließlich 31. Januar.
- Der Kalender zeigt neben dem Monatsraster eine chronologische Übersicht der nächsten Spiele und des nächsten Transfertermins.
- Angebote dürfen außerhalb eines Transferfensters verhandelt werden; ein Transfer kann nur innerhalb eines offenen Fensters abgeschlossen werden.
- Diese menschlichen Begegnungen erhalten eine eigene Akzentfarbe und eine sanfte Aura. `prefers-reduced-motion` deaktiviert die Bewegung.
- Ergebnisse, Kalenderdatum, Spielstatus und Admin-Protokoll werden im vorhandenen gemeinsamen lokalen Server-Spielstand gespeichert.
- Es gibt keinen Klingelton, keine Audioübertragung und keinen zusätzlichen Dienst.

## Kalender und Spielplan

Der Spielplan wird beim Nachrüsten der vorhandenen Liga einmalig angelegt und bei Wiederholung nicht dupliziert. Ein Rundenturnieralgorithmus erzeugt 29 Begegnungen pro Team; der Rückrundenblock wiederholt dieselben Paarungen mit vertauschter Heim- und Auswärtsseite. Die Runden erhalten feste Datumswerte in ISO-Form.

Der Kalender zeigt eine Monatsübersicht ähnlich der vom Nutzer bereitgestellten MyNBA-Referenz: kompakte Tageskacheln, Teamkennzeichen und Statusfarben. Ein Tag mit einem offenen menschlichen Duell wird sichtbar hervorgehoben. Transferfenster und Deadline-Daten erscheinen als eigene Kalenderereignisse. Neben dem Raster stehen die nächsten Spiele und die nächste Transferdeadline in zeitlicher Reihenfolge. Ein gewähltes Datum aktualisiert erst die Auswahl; erst die Schaltfläche „Bis zu diesem Datum simulieren“ startet die Aktion.

Für alle Teams gelten dieselben Transferfenster, unabhängig vom Herkunftsland des ausgewählten Clubs. Das Sommerfenster läuft vom 1. Juli bis einschließlich 31. August, das Winterfenster vom 1. bis einschließlich 31. Januar. Der Kalender kennzeichnet jeweils Fensterbeginn und Deadline. Verhandlungen können vorbereitet werden, aber der Transfer wird nur innerhalb eines offenen Fensters abgeschlossen. Nicht abgeschlossene Angebote verfallen nicht automatisch; Manager können sie nach Wiederöffnung erneut annehmen oder ablehnen.

## Simulationsverhalten

Eine reine Kernfunktion nimmt Liga und Zieldatum entgegen und gibt eine neue Liga samt Ergebniszusammenfassung zurück. Sie verarbeitet Fixtures höchstens einmal und lässt menschliche Duelle unverändert offen. Spiele mit mindestens einem CPU-Team erhalten ein reproduzierbares Ergebnis aus einem fixierten Seed und Teamstärken, damit ein erneut gesendeter Request keine abweichenden Resultate produziert.

Wenn gedraftete Kader mit Bewertungen vorhanden sind, nutzt die Simulation daraus die Teamstärke. Solange Kaderwerte fehlen, verwendet sie für alle Teams ein neutrales Ausgangsniveau mit begrenztem Zufall; sie erfindet keine Spieler und bevorzugt keinen Club.

Nach Abschluss werden Tabellenstand, Matchhistorie, globales Datum und Admin-Protokoll gemeinsam aktualisiert. Ein Zieldatum vor dem bereits erreichten Kalenderdatum oder außerhalb der Saison wird abgewiesen. Eine erneut gesendete Aktion darf bereits abgeschlossene Fixtures nicht verändern.

## Gemeinsamer Zustand und Rechte

Die bestehende lokale JSON-Datei des Career-Servers bleibt die Quelle für Teams, Kalender und Ergebnisse. Kalenderaktionen verwenden die bestehende Revisionskontrolle, sodass veraltete Browserstände keinen neueren Zustand überschreiben. Bei einem Revisionskonflikt lädt der Client den aktuellen Stand und zeigt eine Meldung, statt Ergebnisse zu überschreiben.

Die Simulationsschaltfläche erscheint nur für den ausgewählten Host-/Admin-Manager. Da der aktuelle Prototyp keine Anmeldung oder Server-Authentifizierung hat, ist dies eine UI-Rolle und keine Sicherheitsgrenze. Der Server bleibt ausschließlich an `127.0.0.1` gebunden.

## Playoffs

Die Ligatabelle nach Spieltag 58 bestimmt die Top acht. Viertelfinalpaarungen: 1–8, 4–5, 2–7 und 3–6; Rückspiele finden beim jeweils höher platzierten Club statt. Das Halbfinale folgt dem festen Bracket 1/8 gegen 4/5 und 2/7 gegen 3/6. Bei Gleichstand nach beiden Spielen sowie im Einzelspiel-Finale entscheidet ein reproduzierbares Elfmeterschießen, dessen Seed aus der Fixture-ID abgeleitet wird. Playoff-Daten werden nach Abschluss der Ligaphase an die letzten Ligaspieltage angehängt.

## Spielerdaten

Der Kalender speichert keine zusätzlichen Kaderdaten. Wenn der Kaderimport in einem getrennten Arbeitsschritt abgeschlossen ist, lesen die Simulationsfunktionen dessen bewertete Draft-Picks. Die derzeitige Liga enthält keine Spieler oder Picks. Im Repository gibt es keine exportierte FM26-Kader-CSV; der vorhandene Exporter-Ordner enthält nur das Plugin und seine Konfiguration. Daher umfasst diese Spezifikation keine Spieler-Datensätze.

## Fehlerfälle

- Liga ohne 30 gültige Teams: keine Spielplanerzeugung.
- Unbekanntes oder ungültiges Datum: keine Zustandsänderung.
- Bereits simuliertes Spiel: unverändert lassen.
- Mensch-gegen-Mensch-Spiel: als offen markieren und überspringen.
- Transferabschluss außerhalb des Sommer- oder Winterfensters: ablehnen und den gemeinsamen Spielstand unverändert lassen.
- Gleichzeitige Kalenderänderung: Revisionskonflikt anzeigen und aktuellen gemeinsamen Stand übernehmen.
- Fehlende Kaderwerte: neutrale, reproduzierbare Ersatzsimulation nutzen.

## Abnahmekriterien

1. Die bestehende 30-Team-Liga erhält genau 58 gültige Spielrunden, und jedes Team trifft jeden Gegner zweimal mit vertauschter Heim-/Auswärtsseite.
2. Ein Datumssprung simuliert alle CPU-beteiligten offenen Spiele bis einschließlich des gewählten Datums und lässt spätere Spiele unberührt.
3. Mensch-gegen-Mensch-Spiele bleiben ohne Ergebnis, erscheinen aber mit sichtbarer Aura; reduzierte Bewegung deaktiviert die Aura-Bewegung.
4. Der Kalender zeigt die nächsten Spiele sowie gemeinsame Sommer-/Winterfenster und deren Deadlines an.
5. Transfers werden nur innerhalb eines offenen Transferfensters abgeschlossen.
6. Nach dem Simulationssprung sehen zwei Browser dieselbe globale Kalenderzeit, dieselben Ergebnisse und dieselbe Tabelle.
7. Doppelte Simulationsrequests ändern keine abgeschlossenen Ergebnisse.
8. Die UI weist einen Rücksprung des Datums zurück und protokolliert die Admin-Simulation.
9. Die bestehende Liga wird migriert, ohne Teams, Manager, Kader oder Draftpicks zu löschen.

## Offene Nachfolgearbeit

Die Spieler-CSV ist ein separater Importblock. Er benötigt die tatsächliche FM26-Exportdatei, damit Spieleridentität, Vereinszuordnung, Positionen und Bewertungen geprüft werden können. Der Import soll die bestehende Liga als Draft-Pool bestücken und keine Kaderdaten erfinden.

