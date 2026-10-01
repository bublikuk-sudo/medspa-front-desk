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
  # A setup or teardown that exits non-zero fails the case, so setup/teardown can carry assertions
  # (for example "the Clients row really exists"); the teardown still runs so test data is cleaned up.
  setup_ok=1; [ -z "$setup" ] || eval "$setup" > /dev/null || setup_ok=0
  if [ "$setup_ok" -eq 1 ]; then
    out=$(tests/run-case.sh "$tool" "$input" 2>&1 | jq -r 'if type=="object" then (.verdict // tostring) else tostring end' 2>/dev/null || echo "NO_OUTPUT")
    if [[ "$out" =~ $expected ]]; then res="PASS  $name  -> $out"; ok=1; else res="FAIL  $name  -> got: $out | expected: /$expected/"; ok=0; fi
  else res="FAIL  $name  -> setup failed"; ok=0; fi
  if [ -n "$teardown" ] && ! eval "$teardown" > /dev/null; then res="FAIL  $name  -> teardown failed (was: ${res%%  ->*})"; ok=0; fi
  echo "$res"; if [ "$ok" -eq 1 ]; then pass=$((pass+1)); else fail=$((fail+1)); fi
done < <(sed "s/\r$//; s/\t/\t$M/g" tests/tool-cases.tsv)
echo "passed $pass, failed $fail"
[ "$fail" -eq 0 ]
