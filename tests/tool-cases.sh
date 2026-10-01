#!/usr/bin/env bash
# Прогоняет tests/tool-cases.tsv. setup/teardown — bash-команды (доступны функции at_* и tests/run-case.sh).
# usage: tests/tool-cases.sh [case name]
set -uo pipefail
cd "$(dirname "$0")/.."
source tests/lib/airtable.sh
pass=0; fail=0; only="${1:-}"
# bash `read` с IFS=$'\t' склеивает подряд идущие табуляции (tab — «пробельный» разделитель), и пустая колонка
# setup сдвигает teardown влево. Поэтому перед каждым полем ставим маркер \x01 и снимаем его после read.
M=$'\x01'
while IFS=$'\t' read -r name tool input expected setup teardown || [ -n "${name:-}" ]; do
  name=${name#"$M"}; tool=${tool#"$M"}; input=${input#"$M"}; expected=${expected#"$M"}; setup=${setup#"$M"}; teardown=${teardown#"$M"}
  [[ -z "$name" || "$name" == \#* ]] && continue
  [[ -n "$only" && "$name" != "$only" ]] && continue
  [ -n "$setup" ] && eval "$setup" > /dev/null
  out=$(tests/run-case.sh "$tool" "$input" 2>&1 | jq -r 'if type=="object" then (.verdict // tostring) else tostring end' 2>/dev/null || echo "NO_OUTPUT")
  if [[ "$out" =~ $expected ]]; then echo "PASS  $name  -> $out"; pass=$((pass+1)); else echo "FAIL  $name  -> got: $out | expected: /$expected/"; fail=$((fail+1)); fi
  [ -n "$teardown" ] && eval "$teardown" > /dev/null
done < <(sed "s/\r$//; s/\t/\t$M/g" tests/tool-cases.tsv)
echo "passed $pass, failed $fail"
[ "$fail" -eq 0 ]
