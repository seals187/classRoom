# Changelog

Alle wichtigen Änderungen an classRoom. Die Versionen folgen [Semantic Versioning](https://semver.org/lang/de/); das Docker-Image gibt es jeweils unter `ghcr.io/seals187/classroom:<version>`.

## [0.3.4] – 2026-10-25

### Behoben
- **Minuten auf der Stunden-Karte im Menü:** Die große Zahl rechnet jetzt mit den eingegebenen Zeiten – bei eigenem Beginn, der schon vorbei ist, die Minuten bis zum Ende statt der ganzen Dauer; bei laufender Stunde sofort mit geändertem Ende bzw. +5/+10/+15 statt erst nach „Stunde aktualisieren“

## [0.3.3] – 2026-10-19

### Neu
- **Stunden-Karte im Menü:** Status („Keine Stunde aktiv“ / „Stunde läuft“), groß die Dauer bzw. Restzeit, darunter Zeitspanne und Raum; Reiter **Zeit** (15 · 30 · 45 · 90 min oder eigener Beginn/Ende, bei laufender Stunde +5/+10/+15), **Raum** (Auswahlliste mit „Kein Raumwechsel“, eigene Räume hinzufügen/entfernen, „zuletzt“ markiert) und **Aufräumen** (Aufräumen-Phase Aus/2/3/5/10/15 min vor Schluss – überschreibt `WARN_MINUTES`); großer Knopf „▶ Stunde starten“ bzw. „Stunde aktualisieren“ und „Stunde beenden“
- **Anzeige im Menü:** Zeilen „Ampel · An ›“ und „Hintergrund & Darstellung ›“ öffnen je eine eigene Unterseite
- **Konto unten im Menü:** Avatar mit Initialen, Name, Rolle (Lehrkraft/Schüler) und Abmelden-Knopf
- **Gruppen:** In „Ziele aus dem Auftrag“ unter „Für wen? → Gruppe“ Gruppen wählen (Farbpunkt, Mitglieder, Initialen), neu anlegen (Name, Farbe, Schüler) sowie unter „Gruppen verwalten“ bearbeiten und löschen; Gruppen bleiben gespeichert, gelöschte Schüler fallen automatisch heraus

### Geändert
- **Aktuelles Ziel auch bei den Stundenzielen:** Jede Kachel zeigt „→ nächstes Ziel“ und die Zeit seit dem letzten Abhaken (wie im Selbstlern-Modus); in der aufgeklappten Liste ist das aktuelle Ziel hervorgehoben
- Die Zeit steht rechts in der Kachel und bleibt immer sichtbar – bei langen Zielen wird nur der Text gekürzt (ganzer Text beim Darüberfahren); ab 15 min gelb hinterlegt
- **Kopfband ohne Stunde:** statt „Stunde noch nicht gestartet“ und mehreren Knöpfen ein Balken mit „▶ Stunde starten“, „45 min · bis 18:18 · Zimmer 101“ und „Anpassen…“ (öffnet das Menü); bei wenig Platz entfallen Raum und Endzeit
- **„Ziele aus dem Auftrag“ neu gestaltet:** Untertitel mit Auftrag und Anzahl Ziele, Reiter mit Symbolen („Alle (12)“, „Gruppe“, „Einzelne“), Schüler als Chips mit Initialen, Ziele einzeln entfernbar (✕), Kippschalter „Bestehende Ziele ersetzen“
- **Menü in Gruppen:** „Unterricht“ (Auftrag, Stundenziele, Selbstlern-Modus, Test-Modus) und „Verwaltung“ (Schüler, Lehrer) mit kleinen Überschriften; neben „Schüler verwalten“ und „Lehrer verwalten“ steht die Anzahl

### Behoben
- „Ziele aus dem Auftrag“ setzte sich beim automatischen Neuladen der Startseite (alle 10 s) zurück – angepasste Texte und die Auswahl gingen verloren
- Auf dem Smartphone wirken A− / A+ und Bilder − / + im Auftrag jetzt auch (vorher feste Größen); die Bildvorschauen wachsen bei jedem Klick bis zur ganzen Breite
- Startseite auf dem Smartphone: Die Stundenziel-Leiste war unten abgeschnitten, weil die Seitenhöhe mit der Höhe des Kopfbands am Desktop gerechnet wurde – jetzt füllt der Auftrag genau den Platz unter dem Kopfband, egal wie hoch es ist

## [0.3.2] – 2026-10-19

### Neu
- **Schritte auch von Hand getippt:** Zeilen, die mit „- “, „– “, „• “ oder „1. “ beginnen, erscheinen im Auftrag als nummerierte Schritte – mit Fortschritt („✓ 7/11“) und „Als Stundenziele“, wie beim Knopf „1. Schritte“
- **Bildgröße im Auftrag:** Knöpfe „Bilder kleiner / größer“ neben A− / A+ in 15 feinen Stufen von 15 % bis 50 % der Kartenbreite (pro Gerät gespeichert)

### Geändert
- Schrift im Auftrag lässt sich weiter vergrößern (bis 250 %, vorher 160 %); lange Wörter werden an Silbengrenzen getrennt
- Die Knöpfe oben im Auftrag (Als Stundenziele, A− / A+, Bilder, Bearbeiten, Vollbild) stehen fest oben rechts und verrutschen nicht mehr, wenn Bilder oder Schrift größer werden
- Zwei Bilder im Auftrag werden etwas flacher angezeigt (3:2), damit die Startseite weiterhin ohne Scrollen passt

### Behoben
- Bilder ins Bearbeiten-Fenster ziehen funktioniert jetzt überall auf der Karte (auch auf „+ Bild“), nicht nur im Textfeld; die Karte wird dabei hervorgehoben

## [0.3.1] – 2026-10-19

### Neu
- **Zeitbalken in vier Phasen:** *Arbeitsphase* (blau) → *🧹 Aufräumen* (orange, ab `WARN_MINUTES`) → *🚪 Jetzt zurück in Raum 101* (groß, kräftig orange, Kopfband pulsiert deutlich, ab `GO_MINUTES`) → *🚪 Sofort zurück in Raum 101!* (rot, im Balken „Zeit um · +2 min“); rechts steht das Ziel „Zurück in Raum 101 um 22:23“, ohne Raumwechsel „Ende …“
- **Menü „Unterrichtsstunde“ neu:** Beginn und Ende nebeneinander, Schnellknöpfe „Jetzt“, „+45 min“, „+90 min“, Schalter „Danach Raumwechsel“ mit Raumfeld nur bei Bedarf, Knopf „Stunde starten“ – läuft die Stunde schon: „Stunde aktualisieren“
- **Laufende Stunde verlängern:** „+5 / +10 / +15 min“ im Menü verschieben das Ende sofort (ist die Zeit schon um, ab jetzt)
- **Ziele aus dem Auftrag:** neues Fenster – als Stunden- oder Selbstlern-Ziele, für alle oder einzelne Schüler, Texte anpassen, per Ziehen sortieren, weitere Ziele ergänzen; bestehende Ziele bleiben oder werden ersetzt (Klick auf den Hinweis)
- Nach dem Senden kurze Bestätigung mit **Rückgängig** und „Stundenziele öffnen“
- Jeder Schritt im Auftrag zeigt, wie viele Schüler ihn erledigt haben (z. B. „✓ 7/11“, grün wenn alle fertig)
- Neue `.env`-Variablen `DEFAULT_ROOM_CHANGE` (Standard `true`) und `GO_MINUTES` (Standard `3`)

### Geändert
- Über dem Balken steht links nur noch „Beginn …“, der Raum rechts beim Ziel
- README-Banner neu: echte Screenshots mit Beispielklasse, scharf in doppelter Auflösung
- **Neue Favicons:** Symbol im Browser-Tab (SVG, ICO, PNG), Apple-Touch-Icon und Web-App-Manifest für „Zum Startbildschirm hinzufügen“
- **Login neu gestaltet:** Glas-Karte auf dunklem Hintergrund mit Farblicht, „Schön, dass du da bist.“, Passwort anzeigen (Auge), weißer Knopf „Anmelden →“, GitHub-Symbol zum Repository

### Behoben
- Stunden über Mitternacht (z. B. 23:30 bis 00:15) werden richtig angezeigt

## [0.3.0] – 2026-10-18

Große Überarbeitung: neues Kopfband, Auftrag und Ziel-Seiten neu gestaltet, Hintergründe, eigene Dialoge.

### Neu
- **Kopfband auf allen Seiten:** Menü-Knopf ☰, Zeitbalken, Digitaluhr und kleine Ampel – ersetzt Zahnrad-Leiste, große Analoguhr und die alten Balken
  - Zeitbalken mit drei Phasen: *Arbeitsphase* (blau) → *Bald Rückkehr – aufräumen* (orange) → *Zurück ins Klassenzimmer* (rot, „Zeit um · +2 min“); Restzeit groß, Viertelstunden-Striche mit Uhrzeit, Jetzt-Strich
  - **Stunde mit einem Klick starten:** „▶ Jetzt starten · 45 min“, „90 min“ oder „Andere…“; Dauern über `LESSON_DURATIONS`
- **Menü auch für Schüler:** ihre Seiten, Hintergrund, Hell/Dunkel und Abmelden
- **Auftrag neu gestaltet:** großer Titel, nummerierte Liste als Schritte (Umschalt+Enter für eine graue Zusatzzeile), Bilder rechts gleich zugeschnitten mit „Bild 1, 2 …“ – ein Klick zeigt das ganze Bild, Links klein unten in der Karte
  - Werkzeuge: **☑ Als Stundenziele** (Schritte auswählen, optional bisherige ersetzen, für alle Schüler anlegen), **A− / A+** für die Schriftgröße, ✎ Bearbeiten, Vollbild
  - Leiste **Stundenziele** darunter: ein Quadrat pro Schüler, je mehr erledigt, desto grüner; sind alle fertig: „🎉 Alle Ziele erledigt“
- **Stundenziele und Selbstlernen neu gestaltet** – ruhig, 20–30 Schüler ohne Scrollen auf 1280×720, mit Klassen-Fortschritt im Kopfband
  - Kacheln in festen Spalten, Reihenfolge nach Vorname; Aufklappen schiebt nur die Kacheln darunter nach unten
  - Nach 15 min ohne Abhaken wird eine Kachel orange (Selbstlernen mit aktuellem Ziel und Zeit, Stundenziele mit der Zeit neben dem Balken)
  - **„Nur meine Kachel“** für Schüler: blendet die anderen Kacheln aus; Kopfband und Klassen-Fortschritt bleiben
  - Eigene Akzentfarbe je Seite (Blau / Lila)
- **Hintergründe** für Auftrag, Stundenziele und Selbstlernen: 25 Farbverläufe, 26 selbst gezeichnete Muster, 18 Fotos (Pexels) oder eigene Bilder; die Lehrkraft legt ihn für alle fest oder lässt die Schüler selbst wählen
- **Bilder werden vor dem Hochladen im Browser verkleinert** (höchstens 1920 px, einige hundert KB) – auch große Handyfotos klappen
- **Eigene Dialoge statt Browser-Fenstern** (Löschen, neues Passwort, neue Stunde, Test beenden, Link einfügen, Fehlermeldungen); Enter bestätigt, Esc bricht ab
- **Login-Seite:** Karte mittig, darunter Version, „Fehler melden“, © und Lizenz
- Neue `.env`-Variable `LESSON_DURATIONS` (Standard `45,90`)

### Geändert
- Heller Modus überarbeitet: helle Ampel, Zeitbalken mit weißen Strichen, farbige Phase, Karten mit leichtem Schatten
- Mehr Seitenrand auf großen Bildschirmen
- Sortierung der Kacheln entfernt (feste Reihenfolge nach Vorname)
- Option „Menü-Knopf ausblenden“ entfernt – der Knopf ist immer sichtbar
- „Auftrag löschen“ jetzt im Bearbeiten-Modus
- README neu gestaltet, Installation in drei Schritten

### Behoben
- Fast weiße oder fast schwarze Schriftfarben im Auftrag (z. B. aus dem Dunkelmodus eingefügt) werden entfernt – vorher war der Text im hellen Modus unsichtbar
- „Neue Stunde“ setzt die Zeit seit dem letzten Abhaken zurück

### Datenbank
- Neue Spalten und die Tabelle `backgrounds` werden beim Start automatisch angelegt; bestehende Daten bleiben erhalten

## [0.2.3] – 2026-10-18

### Geändert
- Menü auf Smartphone und Tablet: „Angemeldet als …“ und **Abmelden** stehen direkt unter den Einstellungen statt ganz unten – kein Scrollen mehr nötig

## [0.2.2] – 2026-10-18

### Neu
- **Ansicht für Smartphone und Tablet**
  - Kompakte Kopfzeile: Zahnrad und Logo links, kleine Uhr mit Datum und Ampel rechts, Zeitbalken darunter
  - Schüler-Navigation nebeneinander statt untereinander
  - Auftrag, Editor, Bildvorschauen und Großansicht für kleine Bildschirme angepasst
  - Schüler- und Lehrerverwaltung zweizeilig statt als breite Tabelle
  - Test-Modus: Beschriftung über der großen Zeit
- Auf Touch-Geräten bleibt das Zahnrad immer sichtbar (dort gibt es kein Darüberfahren)

### Geändert
- `docker-compose.yml` lädt nur noch das fertige Image (ohne `build:`) und lässt sich direkt auf einen Server kopieren
- Neue Variable `CLASSROOM_VERSION` in der `.env` wählt die Image-Version (Standard: `latest`)
- Lokal bauen: `docker build -t ghcr.io/seals187/classroom:latest .`

## [0.2.1] – 2026-10-18

### Neu
- **Schüler sehen die Lautstärke-Ampel**, solange sie auf dem Lehrer-Gerät läuft – übertragen wird nur die Farbe, kein Ton
- Untertitel im Selbstlern-Modus, wie bei den Stundenzielen

### Geändert
- Zahnrad und Logo in einer gemeinsamen Leiste, Ampel und Uhr in einer gemeinsamen Karte
- Kleinere Bildvorschauen im Auftrag; mehrere Bilder als kompaktes Raster, Klick zeigt die volle Größe
- Kompakter Bearbeitungsmodus: Uhr, Balken und Ampel werden ausgeblendet, damit der Editor ohne Scrollen Platz hat

## [0.2.0] – 2026-10-18

### Neu
- **Lautstärke-Ampel** (senkrecht neben der Uhr) über das Mikrofon, mit Empfindlichkeit, Schwellen und Live-Test im Menü unter „Ampel-Einstellungen“; Standardwerte aus der `.env` (`NOISE_*`)
- Neues Banner in der README

### Geändert
- Menü kompakter, alles ohne Scrollen sichtbar
- Login: Logo, Schriftzug und Begrüßung mittig
- Schüler- und Lehrerverwaltung ohne Zeitbalken und Uhr
- Updates: SvelteKit 3, Vite 8, Node 26, better-sqlite3 13

## [0.1.0] – 2026-10-18

Erste Version.

### Neu
- Kopfzeile mit Zeitbalken (abgelaufene Zeit, „zurück um“), großer analoger Uhr und Datum, Zahnrad-Menü
- **Auftrag** auf der Startseite mit Editor (Formatierung, Listen, Farben, Links, Bilder mit Vorschau)
- **Stundenziele** und **Selbstlern-Modus** mit einer Kachel pro Schüler, ein-/ausklappbar
- **Test-Modus** mit großer Uhr und Balken für vergangene und verbleibende Zeit
- Login für Lehrkräfte und Schüler (Kürzel oder „Vorname Nachname“) mit Rollen und Rechten
- Schüler- und Lehrerverwaltung, Hell- und Dunkelmodus
- Konfiguration über `.env`, Installation per Docker Compose
- Dependabot und Release-Workflow (Docker-Image für amd64/arm64 nach ghcr.io)

[0.3.4]: https://github.com/seals187/classRoom/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/seals187/classRoom/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/seals187/classRoom/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/seals187/classRoom/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/seals187/classRoom/compare/v0.2.3...v0.3.0
[0.2.3]: https://github.com/seals187/classRoom/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/seals187/classRoom/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/seals187/classRoom/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/seals187/classRoom/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/seals187/classRoom/releases/tag/v0.1.0
