#!/usr/bin/env bash
# «Сборка» заготовки: синтаксис, манифест, locale, иконка, адресность патча.
set -euo pipefail
cd "$(dirname "$0")/.."
node --check index.js
node -e 'const f=require("fs"); for (const p of ["package.json","locale/ru.json","locale/en.json"]) JSON.parse(f.readFileSync(p,"utf8"));'
test -s icon.svg
grep -q "$(node -p "require('./package.json').name")" cordis.patch.yml
echo "check ok"
