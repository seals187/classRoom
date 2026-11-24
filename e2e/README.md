# E2E-Tests (Puppeteer im Docker)

Kein lokales Node nötig. `run.sh` baut das Image `classroom-test`, startet es als Wegwerf-Container `cr-t` auf
Port 3001 (Lehrkraft `test` / `testtest123`) und führt die Skripte im Image `ghcr.io/puppeteer/puppeteer` aus.
Screenshots landen in `e2e/out/` (nicht im Git).

```bash
e2e/run.sh                      # alle Regressionen
e2e/run.sh share actas          # einzelne Skripte
e2e/run.sh --upgrade stepkeys-upgrade ghcr.io/seals187/classroom:0.4.7
```

Neues Skript: `lib.cjs` nutzen – `session(browser, user, pw)` liefert eine Seite mit eigenem Login und
`page.api(url, method, body)`, `page.load(path)`, `page.clock(minuten)` (Uhrzeit aus dem Browser; Node im
Container läuft in UTC). Ergebnis mit `check(name, ok, detail)` und am Ende `done()` („ALLE OK“). Ein neues
Regressionsskript in `ALL` in `run.sh` eintragen.

| Skript | Prüft |
| --- | --- |
| classes | Klassen, Rechte, Stunde mit Klasse, Ziele an alle, Archiv, Passwörter, Liste einfügen |
| teststudent | Test-Schüler: nur der Admin sieht ihn |
| menufit | Menü passt in 1280×720 ohne Scrollen |
| stale | Kacheln: „seit …“ nur während einer laufenden Stunde |
| bandh | Kopfband gleich hoch in allen Zuständen |
| hdr | Startbalken im Kopfband passt |
| ended | Stunde endet 15 min nach dem Ende |
| rowmenu | ⋯-Menü in der letzten Tabellenzeile sichtbar |
| publicui, publicsize, publicsize2, publictheme | Geteilte Seite: Zeitband, A−/A+, Bildgrößen, Hell/Dunkel |
| share | Auftrag per QR-Code teilen, Rechte, Ablauf |
| actas | „Anmelden als …“ |
| auftraege | Mehrere Aufträge: Übersicht, Zeigen, Kopieren, Archiv, Weitergeben |
| editor | Werkzeugleiste: Listen, Tabellen, Bausteine, Rückgängig |
| selfclass | Klassenwahl ohne Stunde, Selbstlernen pro Klasse / alle |
| stepkeys | Schritt-Schlüssel: Fortschritt bleibt nach Textänderung, `/api/lesson` |
| *-upgrade | `seed` auf alter Version, `check` auf neuer (classes: 0.3.7, auftraege: 0.4.4, stepkeys: 0.4.7) |
