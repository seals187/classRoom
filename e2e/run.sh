#!/usr/bin/env bash
# E2E-Tests mit Puppeteer im Docker gegen einen Wegwerf-Container auf Port 3001 (siehe e2e/README.md).
#   e2e/run.sh                         alle Regressionen (baut vorher das Image classroom-test)
#   e2e/run.sh share actas             nur diese Skripte
#   e2e/run.sh --upgrade NAME IMAGE    Upgrade-Test: NAME.cjs seed auf IMAGE, dann check auf classroom-test,
#                                      gleiches Volume (z. B. --upgrade stepkeys-upgrade ghcr.io/seals187/classroom:0.4.7)
#   NO_BUILD=1 e2e/run.sh …            ohne neues Image
set -uo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1
ROOT=$(pwd -W 2>/dev/null || pwd)
E2E="$ROOT/e2e"
mkdir -p e2e/out

ALL="classes teststudent menufit stale bandh hdr ended rowmenu publicui publicsize publicsize2 publictheme share actas auftraege editor selfclass stepkeys"
ENVS=(-e TEACHER_USERNAME=test -e TEACHER_PASSWORD=testtest123 -e TZ=Europe/Zurich -e ORIGIN=http://localhost:3001)
FAILED=0

[ "${NO_BUILD:-}" = 1 ] || docker build -q -t classroom-test . >/dev/null || { echo "Image baut nicht (Lint/Tests?)"; exit 1; }

# App starten (Image, optional Volume) und warten, bis /login antwortet.
start() {
	docker rm -f cr-t >/dev/null 2>&1
	docker run -d --name cr-t -p 3001:3000 "${ENVS[@]}" ${2:+-v "$2:/app/data"} "$1" >/dev/null
	for _ in $(seq 30); do curl -s -o /dev/null http://localhost:3001/login && return; sleep 0.5; done
}

# Skript ausführen; Ausgabe gekürzt auf FAIL/ALLE OK/Fehler.
pup() {
	local out
	out=$(docker run --rm --add-host=host.docker.internal:host-gateway -v "$E2E/out:/out" -v "$E2E:/home/pptruser/t" \
		-w /home/pptruser/t ghcr.io/puppeteer/puppeteer node "$@" 2>&1)
	echo "$out" | grep -E "FAIL|ALLE OK|Error" | head -15
	echo "$out" | grep -q "ALLE OK" || FAILED=1
}

if [ "${1:-}" = --upgrade ]; then
	name=$2 old=$3
	docker volume rm cr-up >/dev/null 2>&1
	echo "=== $name seed ($old)"; start "$old" cr-up; pup "$name.cjs" seed
	echo "=== $name check (neu)"; start classroom-test cr-up; pup "$name.cjs" check
	docker rm -f cr-t >/dev/null; docker volume rm cr-up >/dev/null
else
	for s in ${*:-$ALL}; do
		echo "=== $s"; start classroom-test; pup "$s.cjs"
	done
	docker rm -f cr-t >/dev/null 2>&1
fi
exit $FAILED
