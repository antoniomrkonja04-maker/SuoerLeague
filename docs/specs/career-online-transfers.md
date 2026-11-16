# Career: Online-Transferverhandlungen und Standardkader

**Status:** Entwurf zur Prüfung  
**Freigabe:** Konzept vom Nutzer bestätigt; diese Spezifikation wartet auf Prüfung.  
**Geltungsbereich:** Online-Kader, Manager-Anrufe, Verhandlungen, CPU-Reaktionen und die Datenbasis für Tabellenpositionen.

## Ziel

Freunde verwalten dieselbe private Liga auf mehreren Geräten. Ein Manager kann den Manager eines anderen Teams anrufen. Ein eingehender Anruf klingelt in Career und zeigt eine Annahme-/Ablehnen-Oberfläche. Nach Annahme verhandeln die Manager über Spielertransfers und Ablöse. CPU-Teams reagieren abhängig von Tabellenlage und Kaderbedarf.

Der FM26-Exporter soll einen gebündelten Standardkader erzeugen können; eine eigene CSV bleibt als Alternative verfügbar. Der Nutzer bereitete das Export-Plugin vor, aber eine tatsächliche exportierte Kader-CSV liegt dem Repository derzeit nicht bei.

## Ist-Zustand

- Die WebApp besteht aus Vanilla JavaScript und einem kleinen Node-HTTP-Server.
- Liga, Manager, Draft-Picks, genau ein Match und Admin-Protokoll werden in `localStorage` gespeichert.
- Die Liga hat 30 Team-Slots. Menschliche Manager werden beim Setup lediglich als Namen Team-Slots zugeordnet; es gibt keine Geräteidentität oder Einladung.
- Der Draft weist Spieler Team-Slots zu. Spieler besitzen derzeit keine kanonische, getrennte Eigentums-/Vertrags-/Marktwertstruktur.
- Der Match Hub speichert ein Matchobjekt; es gibt keine Match-Historie, Spielplan oder Tabelle.
- Eine CSV kann manuell importiert werden. Es gibt keine mitgelieferte Kaderdatei und keinen Auto-Load.
- Der FM26-Exporter im Ordner `tools/` ist ein Drittanbieter-Plugin, nicht die Exportdatei und nicht Teil der Laufzeit der WebApp.

## Vorgeschlagene technische Form

- **Gemeinsamer Zustand:** Supabase Postgres als dauerhafte Liga-/Spielerdatenbank und Supabase Realtime für Anruf-, Angebots- und Präsenzänderungen. Supabase wird vor Implementierung anhand aktueller Produktdokumentation geprüft; keine Service-Rolle oder geheime Schlüssel im Browser.
- **Managerzugang ohne sichtbare Registrierung:** Ein Liga-Einladungslink oder Einmal-Code ordnet einen Browser einer Manager-Rolle und einem Team zu. Intern ist eine stabile Sitzung nötig, damit Anrufe an den richtigen Manager geroutet und Aktionen autorisiert werden können. Kein E-Mail-/Passwort-Login und kein Registrierungsbildschirm. Wiederherstellung nach Löschen von Browserdaten ist im ersten Release nicht garantiert.
- **Zugriffsschutz:** Jede Liga und Manageraktion muss serverseitig autorisiert sein. Tabellen erhalten Row-Level Security. Transferannahme und -verbuchung erfolgen atomar über validierte Datenbankoperationen. Der öffentliche Client enthält nur den dafür vorgesehenen Publishable/Anon-Schlüssel.
- **Legacy-Daten:** Bestehende `localStorage`-Daten werden beim Umstieg nicht stillschweigend gelöscht. Ein einmaliger, validierter Import überträgt sie in die neue Liga; nach erfolgreichem Abgleich bleibt der lokale Stand bis zu einer bestätigten Bereinigung erhalten.

## Standardkader und CSV-Override

1. Career lädt den Standardspielerpool aus einer versionierten `data/default-roster.csv` und importiert ihn in eine neue Liga, sofern noch kein eigener Pool gewählt wurde.
2. Ein Nutzer kann im Setup eine eigene CSV wählen. Für diese Liga ersetzt sie den Standardpool; ein sichtbarer Befehl stellt den Standardpool wieder her.
3. Nach dem ersten Draft-Pick ist der Pool gesperrt, damit Spieler-IDs und Pick-Historie stabil bleiben.
4. Der Import normalisiert die vorhandenen FM-CSV-Spalten (Name, Club, Position, Alter, Nation, Rolle/Attribute und Bewertung, soweit vorhanden), validiert Duplikate und weist unbekannte Clubs zur manuellen Zuordnung aus.
5. Coaches werden als Club-/Staffdaten importiert, soweit der Export sie enthält; sie sind nicht Draft-Spieler.
6. Die WebApp erstellt keine fiktiven aktuellen Kaderdaten. Die echte FM26-Exportdatei fehlt noch. Ohne sie zeigt Career einen verständlichen Hinweis und erlaubt einen eigenen CSV-Import.
7. Da FM-Spielerdaten aus einem Drittanbieter-Spiel stammen, bleiben die Standarddatei und ihre Weitergabe privat. Vor Veröffentlichung oder Einchecken in ein öffentliches Repository sind Rechte und Nutzungsbedingungen zu klären.

## Anruf- und Verhandlungsablauf

1. Der Kontaktbildschirm listet die Manager und ihre Teams der aktiven Liga.
2. Anruf starten legt einen Anruf mit Absender, Empfänger, Teambezug und Zeitstempel an. Beim Empfänger erscheint bei geöffneter App ein eingehender Anruf mit Klingelton, Abheben und Ablehnen.
3. Für die erste Simulation gibt es keinen Klingelton. Der eingehende Anruf wird als sichtbares Dialogfenster mit Abheben/Ablehnen gezeigt. Ein späteres Audio-Signal ist optional.
4. Statuswerte sind `ringing`, `accepted`, `declined`, `missed` und `ended`. Nur eine aktive Verhandlung zwischen demselben Managerpaar ist gleichzeitig zulässig.
5. Abheben öffnet einen gemeinsamen Verhandlungsraum. Ein Angebot enthält abzugebenden Spieler, Ablöse und optional einen Tauschspieler. Die Gegenseite kann annehmen, ablehnen oder ein Gegenangebot senden.
6. Angebotsversionen bleiben nachvollziehbar. Der letzte offene Vorschlag kann nur von der jeweils anderen Seite beantwortet werden.
7. Annehmen prüft Spielerbesitz, Transferfenster, Kaderzugehörigkeit und ausreichendes Budget. Spielerbesitz und Geldbewegung werden in einer atomaren Transaktion geändert; bei jeder fehlgeschlagenen Prüfung bleibt der Zustand unverändert.
8. Abbrechen, Auflegen, Ablehnen, Gegenangebot und vollzogener Transfer werden dem Liga- und Admin-Protokoll hinzugefügt.

## Transferökonomie

- Transfers benötigen eine nachvollziehbare Kontowährung und ein Budget je Team.
- Team-Reputation und Startbudget sollen stärkere Startclubs besser ausstatten, wie in der bisherigen Produktvorgabe gewünscht.
- FM-CSV-Felder wie Gehalt oder Bewertung werden nur dann zur Bewertung herangezogen, wenn sie vorhanden und korrekt zugeordnet sind. Marktwert/Angebotsbewertung wird nicht als echter Marktwert ausgegeben, sofern die Quelldatei das nicht liefert.
- Das genaue Startbudget, die Reputationstabelle und Transferfenster müssen im Umsetzungsplan als kleine, konfigurierbare Erstversion festgelegt werden; keine Team- oder Finanzdaten werden dabei stillschweigend überschrieben.

## CPU-Reaktion

- Ein Anruf an ein CPU-Team wird nach kurzer, simulierter Klingelzeit beantwortet, abgelehnt oder nicht angenommen.
- Niedrige Tabellenposition und erkennbare Kaderlücken erhöhen die Wahrscheinlichkeit der Annahme; eine gute Tabellenlage und ein ausgeglichener Kader senken sie. Ein plausibles Angebot kann die Bereitschaft erhöhen.
- CPU-Angebote und Gegenangebote verwenden dieselben Besitz-, Budget- und Fensterregeln wie menschliche Transfers.
- Die Entscheidung wird mit einem gespeicherten Zufallswert je Anruf reproduzierbar gemacht, damit Refresh/Reconnect das Ergebnis nicht neu auswürfelt.
- Aktuell fehlt eine Tabelle. Als Voraussetzung wird aus gespeicherten Ergebnissen eine Rangliste (Punkte, Tordifferenz, erzielte Tore, stabiler Tie-Break) berechnet. Vorhandene Matchdaten werden dabei in eine Historie migriert; neue Resultate ergänzen die Historie, statt das vorige Match zu überschreiben.
- Wenn noch keine Spiele gespielt sind, reagieren CPUs anhand ihres Kaderbedarfs und nutzen eine neutrale Tabellenlage.

## Verlässlichkeit und Prüfung

- Angebotsannahme, Transferbuchung, Budgetänderung und Audit-Eintrag müssen gemeinsam committen oder gemeinsam zurückrollen.
- Doppelklicks, Wiederverbindungen und veraltete Gegenangebote dürfen keine doppelten Transfers erzeugen.
- Jede schreibende Aktion muss auf den eingeloggten Liga-Manager und dessen Team beschränkt sein; ein Manager darf nicht den Anruf oder Transfer eines anderen übernehmen.
- Das Admin-Protokoll ist für normale Clients append-only und zeigt Anruf, Angebot, Konter, Ablehnung und Transfer. Es ist kein manipulationssicherer Beweis gegen den Projekt-/Datenbankeigentümer.
- Login und Registrierung bleiben in der Oberfläche deaktiviert. Die interne Sitzungs-/Einladungsprüfung ist kein sichtbares Konto-System.
- Keine Voice-/Videoübertragung, kein Starten von FIFA/Football Life und keine automatische Ergebnisübertragung in diesem Block.

## Abnahmekriterien

1. Neue Liga lädt einen vorhandenen Standardpool automatisch; eine gültige eigene CSV kann ihn ersetzen und der Standardpool kann wiederhergestellt werden.
2. Ungültige oder fehlende Standarddatei führt zu einer klaren Setup-Meldung, nicht zu einem stillen/leeren Draft.
3. Zwei unterschiedliche Browser können über Manager-Einladungen derselben Liga beitreten und sehen denselben Liga-, Kader-, Anruf- und Angebotszustand.
4. Ein eingehender Anruf klingelt bei geöffnetem Empfängerbrowser und bietet Abheben/Ablehnen; Abheben öffnet denselben Verhandlungsraum, Auflegen beendet ihn.
5. Angebote können angenommen, abgelehnt und gekontert werden. Nur Annahme ändert den Spielerbesitz und die Konten; abgelehnte oder überholte Angebote ändern nichts.
6. CPU-Anrufreaktionen berücksichtigen Rang und Kaderbedarf, sind reproduzierbar und können keinen ungültigen oder unbezahlbaren Transfer ausführen.
7. Ein gespeichertes Match-Ergebnis erscheint in Historie und Tabelle. Alte lokale Matchdaten und Liga-Daten bleiben bis zur erfolgreichen Migration erhalten.
8. Transaktionen, RLS-/Einladungsrechte, CSV-Validierung, Wiederverbindung, doppelte Aktionen und bisherige Setup-/Draft-/Match-Funktionen sind durch Tests und einen browserbasierten Mehrgeräteablauf geprüft.

## Offene Voraussetzung

Der Nutzer muss eine echte FM26-Exporter-CSV bereitstellen. Bis dahin kann die Software den automatischen Dateipfad und den optionalen Override vorbereiten, aber keinen realen Standardkader mitliefern. Für den Onlinebetrieb muss außerdem ein Supabase-Projekt für Career verbunden und dessen öffentliche Client-Konfiguration bereitgestellt werden; geheime Schlüssel werden nicht angefordert oder in Frontend-Dateien geschrieben.

## Erste Umsetzung: lokaler Mehrbrowser-Test

Auf ausdrücklichen Wunsch wird zuerst ein lokaler Simulationsschritt umgesetzt, bevor Supabase angeschlossen wird:

- Der vorhandene Node-Server speichert den gemeinsamen Career-Zustand lokal außerhalb der Browser-Speicher und bleibt an `127.0.0.1` gebunden.
- Pro Browser-Tab wird ein Managerprofil in `sessionStorage` gewählt. Ein weiterer Browser kann dieselbe lokale Liga öffnen und ein anderes Managerprofil übernehmen.
- Anrufe und Verhandlungsstände synchronisieren über den lokalen Server. Es gibt keinen Klingelton, kein Login und keine Verbindung zu anderen Geräten über Internet.
- Der Testmodus ist nicht sicher für öffentliche Bereitstellung: Browserprofile können lokale Managerrollen auswählen. Vor echtem Mehrspielerbetrieb sind Supabase-Identität, Einladungen, Berechtigungen und RLS erforderlich.
