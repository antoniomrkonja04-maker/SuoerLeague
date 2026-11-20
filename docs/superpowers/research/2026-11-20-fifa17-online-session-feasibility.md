# FIFA 17 Online-Match-Machbarkeit — Phase 0

- **Stand:** 20. November 2026
- **Entscheidung:** `blocked` für ein echtes FIFA-17-1v1; `go` für eine davon getrennte SuperLeague-Karriere-Lobby.
- **Arbeitsumfang:** Quellen- und Codeprüfung. FIFA, Frosty, Windows-Zertifikate, HOSTS-Datei und Aurora wurden nicht verändert; der öffentliche Redirector wurde nicht gestartet.

## Ergebnis in Kürze

Eine getrennte SuperLeague-Lobby lässt sich für Räume, Fixtures, Bereitschaft und Kaderstände bauen. Die vorhandene `/api/pes-bridge/lobby`-Route speichert bereits Karriere-/Kader-Syncstatus und einige Lobbyeinstellungen; sie erzeugt jedoch keine FIFA-Freundschaftsspiel-Einladung und öffnet keine FIFA-Sitzung.

Das ausgewertete öffentliche FIFA-17-Serverprojekt hat einen lokalen FUT-Datenbank-/HTTP-Prototyp, einen HTTPS-Redirector und einen TCP-Aufzeichner. Sein README bezeichnet den Stand als Redirector-Erkundung. Der Redirector liefert eine Backend-Adresse; der Probe-Listener liest Verbindungsbytes und legt sie als Dateien ab. Eine Antwortimplementierung für Anmeldung, Lobby, Einladung, Peer-Austausch oder Spiel ist in diesen geprüften Dateien nicht vorhanden. Das ist kein Nachweis, dass ein privater FIFA-17-Server unmöglich ist; es heißt, dass die vorhandene Implementierung den erforderlichen Spielpfad noch nicht trägt.

EA führt das Ende der FIFA-17-Onlinedienste am 14. Februar 2023 auf. Das FIFA-17-Handbuch beschreibt Online Friendlies als Einladung eines Freundes. Eine spätere EA-Beschreibung erklärt den P2P-Ansatz für bestimmte FIFA-Partien, bestätigt aber nicht die FIFA-17-Protokollschritte oder eine private Wiederherstellung. Ein korrektes 1v1 kann daher erst nach einer vollständigen Partie mit zwei getrennten FIFA-17-PCs bestätigt werden.

## Geprüfter Stand

- SuperLeague-Quelle: Branch `codex/fifa17-bridge`, HEAD `9906fa7aafe83dba6f106644647d85501a0f5c92`. Im ursprünglichen Checkout lagen bereits uncommittete Bridge-Änderungen. Dieser Bericht wurde in einem freigegebenen, isolierten Worktree erstellt; am ursprünglichen Checkout wurde nichts geändert.
- GitHub-Quelle: `rplm10/FIFA17-Private-Server`, Branch `main`, über den GitHub-Connector am Berichtstag gelesene Dateien. Blob-SHAs: README `fcc3cb52304c4140348603ff4e72156951abe9b3`, `server/redirector.py` `62e5ad55ac659a73a8ba75043274c2252ec13e38`, `server/probe.py` `cebbcdb5973b55f51ad4e77ab76b1b20c14005eb`, `server/http_server.py` `faffb0d09cb24209ca6c956d1f5754f3290c3837`, `server/main.py` `959c340e0c7d90a54b21da7c1bf87c5e846d50d3`.
- Die Serverdateien wurden statisch geprüft. Es wurde kein Verbindungsversuch mit FIFA ausgeführt.

## Belege

| Behauptung | Beleg | status | Noch benötigter Nachweis |
|---|---|---|---|
| EA hat die FIFA-17-Onlinedienste am 14.02.2023 eingestellt. | [EA Service Updates](https://www.ea.com/legal/service-updates/a-h) listet FIFA 17 für PC und Konsolen unter diesem Datum. | confirmed | Keiner für die Abschaltung; ein privater Ersatzdienst wäre separat zu untersuchen. |
| FIFA 17 Online Friendlies verwendet einen Freundeseinladungs-Ablauf. | [Offizielles FIFA-17-PC-Handbuch](https://eaassets-a.akamaihd.net/eahelp/manuals/fifa-17-manual-pc_uk.pdf), Abschnitt „Online Friendlies“. | confirmed | Das Handbuch dokumentiert nicht, wie eine externe private Sitzung erzeugt wird. |
| Die FIFA-20-Beschreibung sagt, dass P2P-Spieler direkt verbunden sind und ein Spieler als Host handelt. | [EA FIFA-20 Game Data Center FAQ](https://www.ea.com/games/battlefield/news/pitch-notes-fifa20-game-data-center), Abschnitt „Why Does FIFA 20 Use Game Data Centers?“. Der Text beschreibt FIFA 20, nicht FIFA 17. | confirmed | Kein weiterer Nachweis für diese FIFA-20-Aussage. |
| FIFA 17 verwendet denselben P2P-/Host-/Sitzungsablauf wie FIFA 20. | Die EA-FAQ von FIFA 20 ist nur ein Architekturhinweis; das FIFA-17-Handbuch bestätigt lediglich Online Friendlies per Einladung. | inferred | Mitschnitt der tatsächlichen FIFA-17-Sitzungssequenz und abgeschlossene Partie mit zwei getrennten Clients. |
| `/api/pes-bridge/manifest` liefert Karriere-/Kaderdaten und `dbHash`. | `src/career-server.mjs` ruft `exportPesSiderJson(...)` auf. `tools/fifa17-bridge/README.de.md` erklärt, dass der Hash den Webapp-Stand bestätigt und keine geladene lokale Squad-Datei hasht. | confirmed | Lokale FIFA-Datei separat hashen und auf beiden PCs vergleichen. |
| `/api/pes-bridge/lobby` bestätigt den DB-Sync oder aktualisiert Lobby-Einstellungen. | `src/career-server.mjs` ruft `confirmManagerDbSync(...)` oder `updateOnlineLobbySettings(...)` auf und speichert `onlineLobby`. Es gibt dort keinen FIFA-Invite- oder Session-Aufruf. | confirmed | Eine getrennte Lobby-Anwendung kann bereitstellen und Räume verwalten; ihre FIFA-Anbindung ist offen. |
| `/api/pes-sync` nimmt fertige Matchdaten entgegen. | Die Route prüft beim Bridge-Quelltyp Fixture und `dbHash`, wendet das Ergebnis an und speichert Wiederholungsbelege. Die README sagt ausdrücklich, dass der Datei-Watcher die Ergebnisdatei weder aus FIFA ausliest noch erzeugt. | confirmed | Datenquelle für echtes Ergebnis, Torschützen, Statistiken und Ratings identifizieren. |
| Das geprüfte private FIFA-17-Projekt ist noch keine Online-Freundschafts-Lobby. | [README](https://github.com/rplm10/FIFA17-Private-Server/blob/main/README.md) nennt den Meilenstein „redirector discovery“ und beschreibt den Capture-Probe als nächste Protokollstufe. | confirmed | Neue Revision oder ein erfolgreicher Zwei-PC-Matchbeleg könnte den Stand ändern. |
| Der Redirector schickt den Client an einen konfigurierten Backend-Host und Port. | [`server/redirector.py`](https://github.com/rplm10/FIFA17-Private-Server/blob/main/server/redirector.py#L104-L141) antwortet auf `POST /redirector/getServerInstance` mit `serverinstanceinfo`. Die README-Konfiguration nennt lokal `127.0.0.1:10051`. | confirmed | Antwort vom echten Client und anschließender Protokollaustausch. |
| Der Probe-Listener verarbeitet keine Anmeldung oder Spielsitzung. | [`server/probe.py`](https://github.com/rplm10/FIFA17-Private-Server/blob/main/server/probe.py#L10-L37) liest bis zu 262144 Bytes und schreibt `.bin`/`.txt`; er sendet keine Antwort. | confirmed | Implementierte Protokollantworten würden separate Forschung und einen Zwei-Client-Nachweis erfordern. |
| Der lokale HTTP-Server des Projekts ist eine FUT-Demo-API, keine Matchmaking-API. | [`server/http_server.py`](https://github.com/rplm10/FIFA17-Private-Server/blob/main/server/http_server.py#L79-L126) listet Profil, Club, Inventar, Kader, Packs und Markt. Der Server enthält keinen Online-Freundschaftsraum oder Spielstatus. | confirmed | Client-Verkehr könnte weitere, nicht implementierte Dienste erwarten. |
| FIFA-Authentifizierung, Einladung, Sitzungszuweisung, Peer-Verbindung und Spielende sind mit dem privaten Server nicht nachgewiesen. | README nennt diese Arbeit als nächste Protokollstufe und sagt, dass keine Entitlement-, DRM- oder Live-EA-Authentifizierung umgangen wird. Es gibt keinen erfolgreichen Zwei-Client-Matchbeleg. | unknown | Beobachtete vollständige Sitzungssequenz und abgeschlossenes Spiel auf zwei getrennten PCs. |
| FIFA 17 stellt automatisch Ergebnis-/Rating-Telemetrie für den Watcher bereit. | Die vorhandene Bridge verlangt eine bereits geschriebene `match_result.json`; sie ist kein FIFA-Prozess-Leser. | unknown | Reale Datenquelle oder verlässlicher, manuell bestätigter Ergebnisimport. |

## Protokollskizze des vorhandenen privaten Server-Prototyps

```text
FIFA 17 Client
   │ HTTPS zum EA-Redirector-Namen (laut Projekt mit lokaler HOSTS-/Zertifikatseinrichtung)
   ▼
Lokaler Redirector :42230
   │ POST /redirector/getServerInstance
   │ XML nennt Backend 127.0.0.1:10051, secure=1
   ▼
TCP-Probe :10051
   │ liest Bytes und speichert Capture-Dateien; keine FIFA-Protokollantwort
   ▼
Ende des nachgewiesenen Codepfads
```

Das ist die in README, `config/config.json`, `server/main.py` und `server/redirector.py` konfigurierte Route, kein von uns beobachteter erfolgreicher FIFA-Login. Der Redirector selbst benötigt laut README eine lokale CA im Windows-Zertifikatsspeicher und einen HOSTS-Eintrag. Diese privilegierten Rechneränderungen wurden in Phase 0 nicht vorgenommen.

Der SuperLeague-Pfad ist davon unabhängig:

```text
SuperLeague-Webapp → Manifest/dbHash → separate lokale Kaderdatei
SuperLeague-Lobby-API → Sync-/Lobbystatus
fertige match_result.json → Watcher → POST /api/pes-sync → Karriere/Spielplan
```

`dbHash` schützt den Webapp-Kaderstand vor veralteten Ergebnissen. Er beweist nicht, dass FIFA tatsächlich dieselbe Squad-Datei geladen hat. Für zwei PCs braucht es zusätzlich denselben Hash der importierten Kaderdatei bzw. des kontrollierten Squad-Bundles.

### Fehlende Stufen zwischen „Bereit“ und einer Live-Partie

| Stufe | Befund | Ohne Systemänderung beobachtbar? |
|---|---|---|
| SuperLeague-Raum/Fixture/Bereit | Muss als eigene Multiplayer-Lobby gebaut werden; die bestehende Route ist kein FIFA-Sitzungsdienst. | Ja, innerhalb der Webapp. |
| FIFA-/EA-Anmeldung | FIFA-17-Onlinedienste sind eingestellt. Verhalten einer legitimen Installation gegenüber dem privaten Redirector ist nicht getestet; es wird keine Anmeldung umgangen. | Ein passiver Mitschnitt eines normalen Startversuchs könnte nur Verbindungsziele/Fehler zeigen. |
| Redirectorantwort | Code gibt `serverinstanceinfo` zurück und verweist konfiguriert auf `127.0.0.1:10051`. | Nur mit lokaler Redirector-Zuordnung wäre der Client auf diesen Prozess gerichtet; laut Projekt sind HOSTS- und Zertifikatseinrichtung nötig. |
| Authentifizierung/Spielserviceprotokoll | Der Probe-Listener zeichnet Bytes auf, sendet aber keine Protokollantwort. | Capture nur; keine erfolgreiche Anmeldung oder Service-Sitzung. |
| Online-Friendlies-Raum/Einladung und Peer-Adressaustausch | Keine Implementierung oder beobachtete Sequenz in den geprüften Dateien. | Unbekannt; benötigt zwei Clients und einen antwortenden Dienst. |
| Synchrones Spielende und FIFA-Telemetrie | Kein Matchbeleg und kein FIFA-Ergebnisproduzent im vorhandenen Watcher. | Unbekannt. |

Eine passive Aufzeichnung eines unveränderten Verbindungsversuchs kann Verbindungsziele und Fehlermeldungen zeigen, aber keinen privaten Sitzungsablauf beweisen. Die nächste aktive Redirector-Erprobung würde mindestens die lokale CA-Vertrauensstellung und den HOSTS-Eintrag ändern. Diese Phase führt sie nicht aus; sie braucht zuerst einen separaten, begrenzten Versuchsplan mit Rollback und Stopbedingungen.

## Zwei-Client-Test: Voraussetzungen und Erfolg

**Vor dem Start müssen vorliegen:**

1. Zwei getrennte, erreichbare Windows-PCs mit legitimer FIFA-17-PC-Installation. Ein geteilter Parsec-Host zählt nicht als zwei FIFA-Clients.
2. Erfasste FIFA-Build-/Datei-Version, Frosty-Version und Profil sowie SHA-256-Fingerprint derselben Moddateien auf beiden PCs.
3. Dieselbe importierte Squad-Datei und derselbe SHA-256-Bundle-Hash; zusätzlich frisch geladener SuperLeague-Manifest-`dbHash`.
4. Eine Fixture mit eindeutigen Heim- und Auswärtsteams sowie eine gemeinsame Zeit für den Versuch.
5. Vorab festgelegte Protokoll- und Fehlerlogs für beide PCs.
6. Tests mit neuen Zertifikatvertrauensstellungen, HOSTS-Änderungen, Prozess-Injection oder Änderungen/Umgehungen von EA-Authentifizierung, Eigentumsprüfung oder DRM bleiben bis zu einem separaten Review außerhalb dieses Plans. Eigentums- und Berechtigungsprüfungen werden nicht umgangen.

**Erfolg ist erst erreicht, wenn beide getrennten Clients:**

- denselben Raum und dieselbe Fixture sehen und beide als bereit bestätigt werden;
- FIFA mit dem erwarteten Build/Modprofil starten;
- nachweisbar dieselbe Live-Partie betreten und bis zum Ende synchron spielen;
- die Partie ohne Abbruch oder Desync beenden; und
- ein Ergebnis derselben Fixture zuordnen können.

Jeder Abbruch vor Raumbeitritt, Authentifizierungsfehler, fehlgeschlagene Einladung/Sitzungszuweisung, Peer-Verbindungsfehler, Desync oder fehlendes Resultat ist ein dokumentierter Fehlschlag dieses Versuchs. Ein einzelner FIFA-Client, ein lokaler HTTP-Smoke-Test, eine simulierte REST-Antwort, ein Redirector-XML oder empfangene TCP-Bytes gelten nicht als Online-Matchnachweis. Parsec-Streaming ist ausdrücklich kein Ersatz für dieses Ziel.

## Entscheidung und nächste Schritte

| Bereich | Entscheidung | Begründung |
|---|---|---|
| SuperLeague-Karriere-Lobby (Raum, Fixture, bereit, Hashanzeige) | **GO, separat** | Eine getrennte Webapp-/Lobby-Erweiterung kann Spieler koordinieren und den Kader-/Karrierestatus verwenden. Die bestehende `/api/pes-bridge/lobby`-Route allein stellt diese Multiplayer-Lobby nicht bereit und baut keine FIFA-Partie auf. |
| Echtes FIFA-17-Online-1v1 ohne Streaming | **BLOCKED** | EA-Dienste sind beendet; das untersuchte Projekt endet nach Redirect und Capture. Es gibt keinen Zwei-PC-Protokoll- oder Matchbeleg. |
| Automatischer Start direkt in die FIFA-Partie | **BLOCKED** | FIFA-Menü/Online-Freundschafts-Session kann über die vorhandenen Schnittstellen nicht erstellt werden. Frosty/FIFA-Profilstart allein reicht nicht. |
| Automatischer Upload von FIFA-Ergebnis, Stats und Spieler-Ratings | **BLOCKED** | `/api/pes-sync` kann fertige Daten speichern, aber es ist keine verlässliche FIFA-Datenquelle belegt. CPU-Simulation bleibt davon unabhängig in SuperLeague möglich. |

**Kleinster sinnvoller nächster Nachweis:** eine zweite legitime FIFA-17-PC-Installation samt identischem Build/Mod/Squad-Fingerprint bereitstellen. Danach braucht es vor jeder lokalen Redirector-Erprobung einen separaten, geprüften Versuchsumfang: zwei Testrechner, exakt begrenzte Redirector-Domains/Ports, Mitschnittpunkte, Wiederherstellung von Zertifikat/HOSTS-Eintrag und klare Abbruchbedingungen. Das vorhandene Projekt erfordert dafür Administratorrechte und verändert den lokalen Windows-Vertrauensspeicher sowie HOSTS; diese Änderungen wurden hier nicht freigegeben oder ausgeführt.

Bis ein vollständiger Matchbeleg vorliegt, sollten Client/Lobby-Arbeiten auf Lobby, Fixture, Hashprüfung und manuelles bzw. separat bestätigtes Ergebnis beschränkt bleiben. Es gibt keine belastbare Zusage, dass ein eigener Server die EA-Online-Freundschaftsabläufe ersetzen kann.
