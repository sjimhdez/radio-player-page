#!/usr/bin/env bash
# R2 option (a): HTTP snapshot of the clean page served by wp-env.
# Usage: ./snapshot.sh <page-url> <output-file>
set -euo pipefail
url="$1"; out="$2"
curl -fsS "$url" -o "${out%.html}.raw.html"
node "$(dirname "$0")/normalize.mjs" < "${out%.html}.raw.html" > "$out"
echo "Snapshot written to $out"
