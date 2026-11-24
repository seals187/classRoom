# Glossar

Begriffe der App und wo sie im Code wohnen. Neue Module nach diesen Begriffen benennen.

| Begriff | Bedeutung | Modul |
| --- | --- | --- |
| **Lehrkraft** (`owner`) | Die Lehrkraft, deren Klasse, Auftrag und Stunde gerade gelten. Bei Schülern eine ihrer Lehrkräfte (Wahl im Menü bzw. die zuletzt gestartete Stunde). | `server/auth.js` (`resolveOwner`) |
| **Aufrufer** (`actor`) | Wer eine Funktion aufruft: angemeldete Person und `owner` – in Routen einfach `locals`. Ändernde Funktionen bekommen den Aufrufer und prüfen die Rechte selbst. | `server/goals.js`, `server/assignment.js`, `server/lesson.js`, `server/db.js` |
| **Klasse** | Schüler und Lehrkräfte sind in Klassen. Eine Lehrkraft sieht die Schüler ihrer nicht archivierten Klassen, der Admin alle Klassen. Die **aktive Klasse** gilt für Stunde, Stundenziele und „Ziele an alle“. | `server/classes.js` (`visibleTo`, `activeClass`) |
| **Auftrag** | Text, Bilder und Klassen, die die Schüler bearbeiten. Genau einer ist **aktiv** (Beamer, Schüler, geteilte Seite). **Entwurf** = ohne Klasse oder noch nie gezeigt. | `server/assignment.js` |
| **Schritt** | Punkt einer klassenlosen `<ol>` ganz oben im Auftrag. Von Hand getippte Zeilen mit „- “ oder „1. “ werden beim Speichern dazu. Jeder Schritt hat einen festen **Schritt-Schlüssel** (`data-step`). | `server/assignment-content.js` (`prepareContent`) |
| **Ziel** | Etwas, das ein Schüler abhakt: **Stundenziel** (gilt für die Stunde, „Neue Stunde“ leert sie) oder **Selbstlern-Ziel**. Ein Ziel aus einem Schritt trägt dessen Schlüssel (`stepKey`). | `server/goals.js` |
| **Fortschritt** | Pro Schritt: wie viele Schüler das Ziel dazu haben bzw. erledigt haben („✓ 7/11“). | `steps.js` (`countByStep`), `assignment-display.js` |
| **Stunde** | Beginn und Ende bei den Einstellungen der Lehrkraft. Sie läuft ab dem Klick auf „Stunde starten“. **Phasen:** keine · vor Beginn · Arbeit · Aufräumen (`WARN_MINUTES`) · Losgehen (`GO_MINUTES`) · Zeit um (bis 15 min nach dem Ende). | `lesson.js` (`lessonState`), `server/lesson.js` |
| **Geteilte Seite** | Öffentlicher Link `/a/<code>` (QR-Code) zu einem Auftrag, ohne Anmeldung. | `server/share.js` |
| **Umstellung** (Migration) | Einmalige Datenänderung nach einem Update, in fester Reihenfolge. Das Schema (Tabellen, Spalten) steht getrennt davon. | `server/migrations.js`, `server/schema.js` |
