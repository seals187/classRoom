#!/usr/bin/env bash
# Lint und Tests ohne lokales Node: im Docker-Image der Stufe `deps` (siehe Dockerfile) mit dem Quellcode von hier.
#   scripts/test.sh                  Lint + alle Tests
#   scripts/test.sh src/lib/lesson   nur passende Testdateien (Argumente gehen an vitest)
set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1
# Git Bash unter Windows: Docker braucht den Windows-Pfad.
SRC=$(pwd -W 2>/dev/null || pwd)
docker build -q --target deps -t classroom-deps . >/dev/null
docker run --rm -v "$SRC:/app" -v /app/node_modules classroom-deps \
	sh -c 'npx svelte-kit sync >/dev/null 2>&1; npm run lint --silent && npx vitest run "$@"' -- "$@"
