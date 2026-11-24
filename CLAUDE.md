# classRoom

- **Prüfen ohne lokales Node:** `scripts/test.sh` (Lint + Vitest im Docker); dieselben Checks laufen im Docker-Build und in `.github/workflows/check.yml`.
- **E2E / Regression:** `e2e/run.sh` – Ablauf, Hilfen (`lib.cjs`) und Skript-Liste in `e2e/README.md`.
- **Begriffe** (Schritt, Ziel, Stunde, Aufrufer …) und wo sie im Code wohnen: `GLOSSARY.md`.
- **Mehrzeilige Änderungen** mit dem Edit-Werkzeug; sed/perl nur für eindeutige Einzeiler (Svelte-Dateien: `</script>` und Kommentare gehen sonst leicht verloren).
