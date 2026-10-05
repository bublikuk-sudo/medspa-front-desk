#!/usr/bin/env bash
# usage: tests/dialogs.sh [--log <file.md>] [--label <text>] [NN ...]   (on the VPS, cwd /opt/medspa; long: run detached)
# Runs the Task 20 dialogs with tests/dialog.sh: the given numbers in the given order, or all 12 in the plan's order
# (01 02 03 04 05 06 07 08 12 11 10 09). Each dialog runs in the channels named by its file's `channels:` line inside the
# ```dialog block (default "tg wa"; 09 and 10 run once, as the plan says), with tests/cleanup.sh before each run and once
# at the end. Writes a markdown log: a table dialog | channel | PASS/FAIL | state | notes, then the raw output of every
# run. Exit 0 only when every run passed. The log is scanned for the values in deploy/secrets.env before it is kept.
set -uo pipefail
cd "$(dirname "$0")/.."
logf=""; label="dialog run"
while [ $# -gt 0 ]; do
  case "$1" in
    --log) logf="$2"; shift 2 ;;
    --label) label="$2"; shift 2 ;;
    *) break ;;
  esac
done
[ -n "$logf" ] || logf="tests/dialog-runs/$(date -u +%Y-%m-%d)-dialogs.md"
order=("$@"); [ ${#order[@]} -gt 0 ] || order=(01 02 03 04 05 06 07 08 12 11 10 09)
raw=$(mktemp); rows=$(mktemp)
trap 'rm -f "$raw" "$rows"' EXIT
pass=0; failn=0; t0=$(date -u +%Y-%m-%dT%H:%M:%SZ)
for nn in "${order[@]}"; do
  f=$(ls tests/dialogs/"$nn"-*.md 2>/dev/null | head -1)
  [ -n "$f" ] || { echo "no dialog file tests/dialogs/$nn-*.md" >&2; exit 2; }
  chans=$(sed -n '/^```dialog[[:space:]]*$/,/^```[[:space:]]*$/p' "$f" | sed 's/\r$//' | sed -n 's/^channels:[[:space:]]*//p' | head -1)
  for ch in ${chans:-tg wa}; do
    echo "=== $(basename "$f") $ch $(date -u +%H:%M:%SZ)"
    if ! c=$(tests/cleanup.sh 2>&1); then
      echo "cleanup failed before $(basename "$f") $ch: $c" | tee -a "$raw"
      printf '| %s | %s | FAIL | - | cleanup failed before the run |\n' "$(basename "$f" .md)" "$ch" >> "$rows"; failn=$((failn + 1)); continue
    fi
    out=$(tests/dialog.sh "$f" "$ch" 2>&1); rc=$?
    printf '%s\n' "$out"
    { printf '\n### %s, %s\n\n```text\n%s\n```\n' "$(basename "$f" .md)" "$ch" "$out"; } >> "$raw"
    state=$(printf '%s\n' "$out" | sed -n 's/^SUMMARY: //p' | tail -1)
    notes=$(printf '%s\n' "$out" | grep -E '^  FAIL: ' | sed 's/^  FAIL: //; s/|/\\|/g' | head -3 | paste -sd ';' -)
    res=PASS; [ "$rc" -eq 0 ] || res=FAIL
    [ "$res" = PASS ] && pass=$((pass + 1)) || failn=$((failn + 1))
    printf '| %s | %s | %s | %s | %s |\n' "$(basename "$f" .md)" "$ch" "$res" "${state:--}" "${notes:-}" >> "$rows"
  done
done
final=$(tests/cleanup.sh 2>&1) && final="ok: $(printf '%s' "$final" | tail -1)" || final="FAILED: $final"
{
  printf '# %s\n\n' "$label"
  printf '| | |\n|---|---|\n| Started | %s |\n| Finished | %s |\n| Dialogs | %s |\n| Result | passed %s, failed %s |\n| Final cleanup | %s |\n\n' \
    "$t0" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${order[*]}" "$pass" "$failn" "$final"
  printf '| dialog | channel | result | state | notes |\n|---|---|---|---|---|\n'
  cat "$rows"
  printf '\n## Raw output\n'
  cat "$raw"
} > "$logf.tmp"
# Secret scan: no value from deploy/secrets.env (8+ characters) may appear in the log. Only the names are ever printed.
leak=$(source deploy/secrets.env
  grep -oE '^[A-Z_][A-Z0-9_]*=' deploy/secrets.env | tr -d '=' | while read -r n; do
    val="${!n:-}"; [ "${#val}" -ge 8 ] && grep -qF -- "$val" "$logf.tmp" && echo "$n"
  done)
if [ -n "$leak" ]; then echo "SECRET SCAN: values of $(printf '%s' "$leak" | paste -sd, -) found in the log - log NOT written" >&2; rm -f "$logf.tmp"; exit 3; fi
mv "$logf.tmp" "$logf"
echo "passed $pass, failed $failn (log $logf, secret scan clean)"
[ "$failn" -eq 0 ]
