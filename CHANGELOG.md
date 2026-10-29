# Changelog

Alle wichtigen Änderungen an classRoom. Die Versionen folgen [Semantic Versioning](https://semver.org/lang/de/); das Docker-Image gibt es jeweils unter `ghcr.io/seals187/classroom:<version>`.

## [0.4.5] – 2026-10-29

### Neu
- **Beliebig viele Aufträge:** Jede Lehrkraft kann so viele Aufträge anlegen, wie sie will – jeder gehört zu einer oder mehreren Klassen und hat optional ein geplantes Datum. Genau einer ist aktiv: ihn zeigen der Beamer und die Schüler
- **Übersicht „Aufträge“** (`/auftraege`): alle Aufträge als Karten mit Klassen, Datum („Heute“, „Morgen“, „Letzte Woche“ …), Zahl der Schritte und Bilder; Filter nach Klasse, Entwürfe (ohne Klasse oder noch nie gezeigt) und Archiv. **▶ Zeigen** macht einen Auftrag aktiv, ✎ öffnet ihn im Editor, ⧉ kopiert ihn, „+ Neuer Auftrag“ legt einen an
- **Menü:** „Aufträge“ ist aufklappbar – der aktive ist markiert, darunter „+ Neuer Auftrag“ und „Alle Aufträge ›“. Ist die Liste offen, ist die Stunden-Karte kompakt (und umgekehrt) – so passt das Menü weiter ohne Scrollen in 1280×720
- **Editor:** Klassen (bei einem neuen Auftrag die aktive vorgewählt) und Datum wählen; „Archivieren“ bzw. „Aus dem Archiv holen“

### Geändert
- **QR-Link, „Als Stundenziele“ und „Weitergeben“ gelten pro Auftrag:** Jeder Auftrag hat seinen eigenen Link; unter „Geteilte Aufträge“ stehen alle geteilten einzeln. Weitergeben kopiert oder überträgt einen Auftrag zusätzlich zu den Aufträgen der anderen Lehrkraft (als Entwurf ohne Klassen) statt ihren zu ersetzen
- **Update:** Beim ersten Start wird der bisherige Auftrag jeder Lehrkraft ihr erster in der Liste – aktiv, für ihre aktive Klasse und mit demselben QR-Link. Vorher ein Backup anlegen

## [0.4.4] – 2026-10-28

### Geändert
- **Hell/Dunkel auf der geteilten Seite als Icon:** Statt des Schalters unter dem Auftrag gibt es jetzt einen Knopf (☾ / ☀) oben ganz rechts neben „Vollbild“ – auf Laptop und Handy. Ein abgelaufener Link zeigt keinen Knopf mehr, sondern einfach die zuletzt gewählte Darstellung

## [0.4.3] – 2026-10-28

### Neu
- **Hell/Dunkel auf der geteilten Seite (QR-Code):** Unter dem Auftrag gibt es den Schalter „☀ Hell / ☾ Dunkel“ – auf dem Laptop rechts, auf dem Handy mittig, auch bei einem abgelaufenen Link. Die Wahl bleibt pro Gerät gespeichert

## [0.4.2] – 2026-10-28

### Behoben
- **Bilder größer/kleiner auf dem Handy (geteilte Seite):** „Bilder +“ tat nichts, weil das Bild schon bildschirmbreit war, und „Bilder −“ änderte nur in kaum sichtbaren Schritten. Auf dem Handy gibt es jetzt eigene Stufen – ganze Breite, ¾, ½, ⅓ –, „+“ ist bei ganzer Breite ausgegraut; die Wahl bleibt pro Gerät gespeichert

## [0.4.1] – 2026-10-28

### Neu
- **Test-Schüler:** Der Admin kann beim Hinzufügen (Reiter „Einzeln“) oder unter „Bearbeiten“ einen Schüler als Test-Schüler markieren – zum Ausprobieren der Schüler-Sicht. Ihn sieht nur der Admin; andere Lehrkräfte sehen ihn nirgends, auch nicht in gemeinsamen Klassen (Listen, Zähler, Kacheln, „Ziele an alle“, „Alle Passwörter neu“). In den Listen trägt er das Etikett „Test“

### Geändert
- **Geteilte Seite (QR-Code):** Schrift (A− / A+) und Bilder (− / +) lassen sich wieder vergrößern und verkleinern, dazu Vollbild – pro Gerät gespeichert. Auf dem Handy sind die Bilder anfangs so breit wie der Bildschirm
- **Menü passt ohne Scrollen** (1280×720): Die Stunden-Karte ist kompakter – Restzeit links, Zeiten, Raum und Klasse (direkt wählbar) rechts; Beginn und Ende erscheinen erst mit „Eigene“ in derselben Zeile statt der Minuten; „Wochenplan“ steht als Link neben der Überschrift. Mit dem Pfeil bei „Stunde läuft“ lässt sich die Karte ganz einklappen (pro Gerät gemerkt)
- **„Seit … nichts abgehakt“ nur während einer Stunde:** Die Zeit auf den Kacheln (bis „> 1 Tag“), die gelbe Markierung und der Hinweis „15+ min“ erscheinen bei Stundenzielen und Selbstlernen nur, solange eine Stunde läuft – und zählen frühestens ab Stundenbeginn
- **Kopfband bleibt gleich hoch** – ohne Stunde, laufend, beim Aufräumen, Losgehen und „Zeit um“; nichts springt mehr beim Starten oder Beenden einer Stunde (Desktop und Handy)

### Behoben
- **„⋯“-Menü in der letzten Tabellenzeile** (z. B. bei der unteren von zwei Lehrkräften) wurde vom Tabellenrand abgeschnitten. Es liegt jetzt über allem und klappt nach oben auf, wenn unten kein Platz ist

## [0.4.0] – 2026-10-27

### Neu
- **Klassen:** Klassen mit Name und Farbe. Ein Schüler kann in mehreren Klassen sein, eine Lehrkraft mehrere Klassen unterrichten und eine Klasse mehrere Lehrkräfte haben. Lehrkräfte sehen nur ihre Klassen und deren Schüler, der Admin sieht alles. Lehrkräfte können eigene Klassen anlegen
- **Verwaltung mit Reitern Klassen · Schüler · Lehrkräfte** (ersetzt „Schüler verwalten“ und „Lehrer verwalten“):
  - **Klassen** als Karten mit Farbe, Anzahl, Avataren und Lehrkräften; „+ Neue Klasse“; archivierte Klassen darunter zum Wiederherstellen
  - **Klasse öffnen:** Schülerliste mit Avatar, Name, Kürzel, Fortschritt (Stunde/Selbst) und Aktionen; rechts die Lehrkräfte der Klasse (Admin weist zu) und Schnell-Aktionen: Zugangsdaten drucken, Schüler aus Liste einfügen, alle Passwörter neu, Name und Farbe, archivieren
  - **Schüler hinzufügen:** einzeln, als eingefügte Liste (ein Name pro Zeile, auch aus Excel, Vorschau mit automatischem Kürzel) oder aus einer anderen Klasse übernehmen. Die neuen Zugangsdaten lassen sich gleich als Kärtchen drucken
  - **Schüler:** alle Schüler mit ihren Klassen als farbige Etiketten, Filter nach Klasse und Suche; Bearbeiten ändert auch die Klassen
  - **Lehrkräfte:** Tabelle Lehrkraft × Klasse mit Häkchen; Passwort, Umbenennen, Admin-Recht, „Anmelden als …“ und Löschen
- **Stunde mit Klasse:** Beim Starten wählt man im Menü die Klasse (die zuletzt genutzte ist vorausgewählt); das Kopfband zeigt sie mit farbigem Punkt. Stundenziele und Kacheln gelten nur für die Schüler dieser Klasse, „Ziele aus dem Auftrag → Alle“ ebenso. Selbstlern-Ziele bleiben pro Schüler über alle Klassen

- **Geteilte Seite (QR-Code) mit Zeitband der Stunde:** zeigt wie am Beamer, wie viel Zeit bleibt – Arbeitsphase als schmales Band mit Restzeit, Balken und „Zurück in … um …“; beim Aufräumen wird das Band gelb-orange; zum Losgehen erscheint die Anweisung groß in Orange (auf dem Handy bildschirmfüllend, der Auftrag ist dann eingeklappt und lässt sich aufklappen); ohne Stunde nur Logo, „Keine Stunde aktiv“ und die Uhrzeit. Auf dem Handy ohne Kartenrahmen, Bilder unter dem Text, ohne Knöpfe. Es werden nur Zeiten und Raum übertragen – keine Namen oder Klasse

### Geändert
- **Update:** Jede Lehrkraft bekommt einmalig eine Klasse mit ihren bisherigen Schülern – der Admin „Meine Klasse“, die anderen „Klasse <Name>“. Wer „Sieht alle Schüler“ hatte, bekommt alle Klassen; die Einstellung selbst entfällt
- **Stunde endet von selbst** 15 Minuten nach dem Ende: Kopfband und Menü zeigen dann wieder „▶ Stunde starten“ (vorher blieb „Zeit um · +444 min“ stehen, ohne dass sich die Stunde im Menü beenden ließ)
- **Verwaltung leuchtet nicht mehr rot/orange**, wenn die Zeit der Stunde um ist – dort gibt es ja keinen Zeitbalken
- **Hinweis „Angemeldet als …“** ist jetzt ein kleines Kärtchen mit „← Zurück zu …“ darunter

## [0.3.7] – 2026-10-27

### Neu
- **Auftrag per QR-Code teilen:** Neues QR-Symbol neben A− / A+ (standardmäßig nicht geteilt). „Teilen starten“ erzeugt einen zufälligen Link wie `/a/k7xq9mpzab`, gültig 1, 7 oder 30 Tage (Standard über `SHARE_DAYS`, 7 Tage). Der QR-Code erscheint groß in der Mitte – gut scannbar am Beamer –, darunter der kurze Link zum Abtippen; mit „Klein in der Ecke zeigen“ bleibt er unten rechts in der Karte
- **Öffentliche Seite ohne Anmeldung:** zeigt nur Titel, Text, Bilder und Links – keine Namen, Ziele, Fortschritte oder Klasseninfos, nichts zum Bearbeiten, kein Menü. Gut lesbar auf dem Handy, Hell/Dunkel nach Gerät, Änderungen erscheinen nach spätestens 30 Sekunden. Bilder gibt es nur mit gültigem Code; die Seite erscheint nicht in Suchmaschinen und gibt den Link nicht an verlinkte Seiten weiter
- **Link verwalten:** „Neuer Link“ macht den alten ungültig, „Teilen beenden“ beendet ihn, die Gültigkeit lässt sich ab jetzt neu setzen. Wird der Auftrag gelöscht, übertragen oder durch einen weitergegebenen ersetzt, endet der Link; eine Kopie ist nicht geteilt
- **Menü „Anzeige → Geteilte Aufträge“:** Jede Lehrkraft sieht ihren geteilten Auftrag, der Admin alle – mit Link, Ablauf, Verlängern und Beenden. Hinweis, wenn die Adresse nur im Schulnetz bzw. nur auf diesem Gerät (localhost) erreichbar ist
- **`PUBLIC_URL`** in der `.env`: Adresse, unter der Handys classRoom erreichen (für QR-Code und Link) – leer = die Adresse im Browser
- **Anmelden als … (Admin):** Unter „Lehrer verwalten“ und „Schüler verwalten“ meldet sich der Admin per Knopf als diese Lehrkraft bzw. dieser Schüler an und sieht classRoom genau so – mit deren Rechten, z. B. zum Nachschauen oder Beheben von Problemen. Unten links steht „Angemeldet als … · Zurück zu …“; „Zurück“ meldet wieder als Admin an. Wird dem Admin das Admin-Recht entzogen, endet auch diese Anmeldung

## [0.3.6] – 2026-10-25

### Neu
- **Auftrag weitergeben:** Neuer Knopf „Weitergeben“ beim Auftrag – an eine andere Lehrkraft **kopieren** (bleibt auch bei der eigenen) oder **übertragen** (geht ganz zur anderen Lehrkraft und deren Schülern). Hat die andere Lehrkraft schon einen Auftrag, sagt das Fenster deutlich, dass er ersetzt wird. Lehrkräfte geben ihren eigenen Auftrag weiter, der Admin auch den jeder anderen Lehrkraft (z. B. den nach dem Update übernommenen Auftrag an die richtige Lehrkraft)

## [0.3.5] – 2026-10-25

### Neu
- **Jede Lehrkraft hat ihre eigene Klasse:** Lehrkräfte sehen nur ihre eigenen Schüler. Auftrag, Stunden- und Selbstlern-Ziele, laufende Stunde, Wochenplan, Räume, Gruppen, Test-Modus, Ampel und Hintergrund sind pro Lehrkraft getrennt. Neue Schüler gehören der Lehrkraft, die sie anlegt
- **Admin:** Das Konto aus der `.env` (`TEACHER_USERNAME`) ist immer Admin und kann weitere Lehrkräfte zum Admin machen. Nur der Admin legt Lehrkräfte an und löscht sie, setzt fremde Passwörter und schaltet pro Lehrkraft „Sieht alle Schüler“ ein. Unter „Schüler verwalten“ ordnet er jeden Schüler einer oder mehreren Lehrkräften zu
- **Mein Konto:** Lehrkräfte ohne Admin-Recht ändern im Menü unter „Mein Konto“ nur ihr eigenes Passwort
- **Schüler mit mehreren Lehrkräften** sehen die Klasse der Lehrkraft, die zuletzt eine Stunde gestartet hat, und können im Menü unter „Lehrkraft“ wechseln
- **Wochenplan:** Im Menü unter „Wochenplan ›“ pro Wochentag (Mo–So) beliebig viele Stunden mit Beginn, Ende und Raum (oder kein Raumwechsel) festlegen. Die heutigen Stunden erscheinen im Reiter „Zeit“ zum Antippen (die nächste ist vorausgewählt), und der Startbalken im Kopfband zeigt die nächste geplante Stunde („45 min · Plan 14:00–14:45 · Zimmer 101“)

### Geändert
- **Update von einer früheren Version:** Alle bestehenden Schüler, Ziele, Gruppen, der Auftrag und die Hintergrund-Bilder gehen an den Admin; die bisherigen Einstellungen (Stunde, Räume, Wochenplan, Ampel, Hintergrund) bekommt jede Lehrkraft als Kopie. Wird eine Lehrkraft gelöscht, gehen ihre Schüler ohne andere Lehrkraft an den Admin
- **Stunde starten läuft ab dem Klick:** Mit eigenen oder geplanten Zeiten (z. B. 14:00–14:45) beginnt die Stunde beim Klick auf „▶ Stunde starten“ und zeigt die volle Dauer („noch 45 min“), auch wenn der Beginn schon vorbei ist oder erst noch kommt

### Behoben
- **Hintergrund-Bilder verschwanden:** Beim Speichern des Auftrags wurden hochgeladene Hintergrund-Bilder gelöscht, die älter als eine Stunde waren. Jetzt werden nur Bilder aufgeräumt, die weder ein Auftrag noch ein Hintergrund mehr braucht

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

[0.4.5]: https://github.com/seals187/classRoom/compare/v0.4.4...v0.4.5
[0.4.4]: https://github.com/seals187/classRoom/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/seals187/classRoom/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/seals187/classRoom/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/seals187/classRoom/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/seals187/classRoom/compare/v0.3.7...v0.4.0
[0.3.7]: https://github.com/seals187/classRoom/compare/v0.3.6...v0.3.7
[0.3.6]: https://github.com/seals187/classRoom/compare/v0.3.5...v0.3.6
[0.3.5]: https://github.com/seals187/classRoom/compare/v0.3.4...v0.3.5
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
