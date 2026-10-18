# Changelog

Alle wichtigen Änderungen an classRoom. Die Versionen folgen [Semantic Versioning](https://semver.org/lang/de/); das Docker-Image gibt es jeweils unter `ghcr.io/seals187/classroom:<version>`.

## [Unveröffentlicht]

### Neu
- **Neues Kopfband auf allen Seiten:** Menü-Knopf ☰, Zeitbalken (vorbei / noch …), Digitaluhr und kleine Ampel – ersetzt Zahnrad-Leiste, große Analoguhr und die alten Balken
- **Menü auch für Schüler** (☰): ihre Seiten, Hell/Dunkel und Abmelden
- **Auftrag neu gestaltet:** großer Titel, nummerierte Liste als Schritte mit grauer Zusatzzeile (Umschalt+Enter), Bilder rechts mit „Klick vergrößert“, dezente Bearbeiten/Löschen-Knöpfe
- **Stundenziele-Leiste** unter dem Auftrag: ein Punkt pro Schüler, Fortschritt und „Öffnen“
- **Stundenziele und Selbstlernen neu gestaltet** – ruhig, 20–30 Schüler ohne Scrollen auf 1280×720
  - Kopfband mit Zeitbalken (vorbei / noch …), Klassen-Fortschritt, Digitaluhr und kleiner Ampel (Klick startet/stoppt)
  - Kompaktes Raster; aufgeklappte Kacheln werden nach unten länger, die anderen rücken nach
  - Sortierung: Name oder Fortschritt (Stundenziele), „zuletzt aktiv“ oder Name (Selbstlernen)
  - Selbstlernen: aktuelles Ziel und Zeit seit dem letzten Abhaken; nach 15 min ohne Abhaken orange markiert
  - Eigene Akzentfarbe je Seite (Blau / Lila), Grün für fertig; hell und dunkel
- Datenbank merkt sich pro Schüler den Zeitpunkt des letzten Abhakens (Migration läuft automatisch)

### Geändert
- Ampel-Einstellungen: „Ampel neben der Uhr anzeigen“ statt „unter der Uhr“

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

[0.2.3]: https://github.com/seals187/classRoom/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/seals187/classRoom/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/seals187/classRoom/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/seals187/classRoom/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/seals187/classRoom/releases/tag/v0.1.0
