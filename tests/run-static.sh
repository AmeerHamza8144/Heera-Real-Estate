#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== PHP syntax =="
while IFS= read -r -d '' file; do php -l "$file" >/dev/null; done < <(find . -maxdepth 2 -type f -name '*.php' -print0)
echo "PHP syntax: OK"
echo "== JavaScript syntax =="
while IFS= read -r -d '' file; do node --check "$file"; done < <(find . -maxdepth 1 -type f -name '*.js' -print0)
echo "JavaScript syntax: OK"
php tests/static-contracts.php
