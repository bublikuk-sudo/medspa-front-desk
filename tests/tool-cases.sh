#!/usr/bin/env bash
# Прогоняет tests/tool-cases.tsv. setup/teardown — bash-команды (доступны функции at_* и tests/run-case.sh).
# usage: tests/tool-cases.sh [case name]
set -uo pipefail
cd "$(dirname "$0")/.."
source tests/lib/airtable.sh
source tests/lib/pg.sh
source tests/lib/n8n.sh
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
  # A setup may set CASE_INPUT to replace the input column, for an input that only exists after the setup
  # (an appt_id that propose_booking generated). The input column then shows the shape with a placeholder.
  # The variables setups and teardowns assign are cleared too, so a case can never read a value a previous case left.
  unset CASE_INPUT ap old new t0 s e x ev a bg bgf bgp before h t
  setup_ok=1; raw=""; [ -z "$setup" ] || eval "$setup" > /dev/null || setup_ok=0
  [ -z "${CASE_INPUT:-}" ] || input=$CASE_INPUT
  if [ "$setup_ok" -eq 1 ]; then
    # $raw keeps the whole JSON the tool returned, so a teardown can assert on fields other than the verdict
    # (for example confirm_booking's first_visit). $out is the verdict that the regex is matched against.
    if raw=$(tests/run-case.sh "$tool" "$input" 2>&1); then
      out=$(printf '%s' "$raw" | jq -r 'if type=="object" then (.verdict // tostring) else tostring end' 2>/dev/null || echo "NO_OUTPUT")
    else out="NO_OUTPUT"; fi
    if [[ "$out" =~ $expected ]]; then res="PASS  $name  -> $out"; ok=1; else res="FAIL  $name  -> got: $out | expected: /$expected/"; ok=0; fi
  else res="FAIL  $name  -> setup failed"; ok=0; fi
  if [ -n "$teardown" ] && ! eval "$teardown" > /dev/null; then res="FAIL  $name  -> teardown failed (was: $res)"; ok=0; fi
  echo "$res"; if [ "$ok" -eq 1 ]; then pass=$((pass+1)); else fail=$((fail+1)); fi
done < <(sed "s/\r$//; s/\t/\t$M/g" tests/tool-cases.tsv)
echo "passed $pass, failed $fail"
[ "$fail" -eq 0 ]
