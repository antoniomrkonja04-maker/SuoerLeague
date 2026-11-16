# Career Versuch 2

Lokaler WebApp-Prototyp für eine private Online-Fußballkarriere. Enthalten sind Liga-Setup mit 30 Teams, Manager- und CPU-Slots, lokaler CSV-Import für bis zu 900 bewertete Männer-Spieler, Snake Draft, Match-Lobby, Admin-Protokoll und eine stille Transferzentrale mit Anrufen und Angeboten.

## Starten

Benötigt Node.js 20 oder neuer. Im Projektordner ausführen:

```powershell
node src/server.mjs
```

Dann `http://127.0.0.1:8000` öffnen. Der Spielstand wird vom lokalen Server in `runtime-data/shared-state.json` gespeichert und zwischen Browsern synchronisiert, solange sie dieselbe URL auf demselben PC verwenden.

## Zwei Manager im selben PC-Test

1. Starte den Server einmal.
2. Öffne die URL in zwei getrennten Browsern oder Browserprofilen.
3. Wähle oben in jedem Browser einen anderen Manager-Slot. Die Auswahl gilt jeweils für die Browser-Sitzung.
4. Öffne **Transferzentrale**, rufe den anderen Manager an und hebe im zweiten Browser ab.
5. Sendet Angebote oder Gegenangebote; die Annahme verschiebt den gedrafteten Spieler und schreibt einen Transfer in den gemeinsamen Spielstand.

Die Anruffunktion ist absichtlich stumm: kein Klingelton und keine Audioübertragung. CPU-Anrufe werden nach Tabellenplatz und Kaderbedarf beantwortet. Der CPU-Verhandlungsteil ist noch ein einfacher Prototyp.

## CSV für den Draft-Pool

Beim ersten Start lädt Career automatisch den enthaltenen FM26-Shortlist-Pool aus `data/fm26-top-players.csv`. Er enthält 297 eindeutige Spieler aus zehn Positionsgruppen der [FM Blog FM26-Shortlist](https://www.footballmanagerblog.org/2025/10/fm26-best-players-shortlist-live-search-eu-age-filter.html). Mehrfachnennungen über Positionen hinweg sind zusammengeführt. Der Wert `fmb_abi` ist FM Blog Ability (1–99), kein offizieller FIFA-OVR-Wert.

Vor Draftbeginn kann der Host den Standardpool durch eine eigene CSV ersetzen. Im laufenden Draft kann eine weitere CSV an den bestehenden Pool angehängt werden; bisherige Picks und Spieler bleiben erhalten, Duplikate werden ausgelassen und die neuen Spieler werden als weitere Snake-Runden verfügbar. Unterstützt werden `player_name` oder `name`; optionale Felder sind `club`, `position`, `overall` (oder `rating`, `ca` bzw. `current ability`), `gender` und `coach`. Komma-, Semikolon- und Tab-getrennte CSVs werden gelesen. Bei mehr als 900 Spielern wählt Career die höchstbewerteten 900 aus; ohne Bewertungen wird ein zu großer Import abgelehnt. Ist eine Geschlechtsspalte vorhanden, werden als weiblich markierte Einträge ausgeschlossen. Der Host kann CPU-Züge bis zum nächsten menschlichen Pick simulieren; jeder Manager darf nur für sein eigenes Team draften. Die importierten Spieler werden im gemeinsamen lokalen Spielstand gespeichert.

Nach dem letzten Pick wird der gemeinsame Saisonkalender im Hauptmenü freigeschaltet. Er ergänzt 58 Ligaspieltage (Hin- und Rückrunde), gemeinsame Transfertermine und eine Host-Steuerung, die CPU-Spiele bis zu einem gewählten Datum simuliert. Mensch-gegen-Mensch-Ergebnisse trägt der Host nach dem lokalen Match im Kalender ein. Der aktuell mitgelieferte FMB-Shortlistpool umfasst 297 Spieler; eine zweite verifizierte FM26-Liste ist nicht im Repository enthalten. Mit „Spielerpool erweitern“ lässt sich die fehlende zweite Hälfte später anhängen, ohne den bestehenden Draft zurückzusetzen.

## Grenzen

- Der Server bindet nur an `127.0.0.1`. Ein anderer Browser auf demselben PC zählt für den Test als eigener Manager-Slot. Andere PCs, LAN und Internet-Multiplayer sind damit noch nicht verbunden.
- Manager-Slots sind für den lokalen Test auswählbar; es gibt noch keine Nutzerkonten, Zugangskontrolle oder geschützten Einladungen.
- Der Match Hub startet Football Life nicht und testet keinen Tunnel. Ergebnisse trägt der Host ein.
- Admin-Protokoll und lokaler Spielstand sind nicht manipulationssicher.
- Die Teamliste ist ein Startpool, keine offizielle Top-30-Rangliste.

## Tests

```powershell
node --test
```

## FM26 CSV-Exporter

Hinweise zum bereitgestellten Exporter unter `tools/fm26-player-export-v5.1/README.md`. Das ist ein separates Drittanbieter-Plugin, kein Bestandteil der WebApp.
