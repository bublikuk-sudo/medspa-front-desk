#!/usr/bin/env bash
# usage: tests/dialogs.sh [--log <file.md>] [--label <text>] [--note <text>]... [NN ...]   (on the VPS, cwd /opt/medspa; long: run detached)
# Runs the Task 20 dialogs with tests/dialog.sh: the given numbers in the given order, or all 12 in the plan's order
# (01 02 03 04 05 06 07 08 12 11 10 09). Each dialog runs in the channels named by its file's `channels:` line inside the
# ```dialog block (default "tg wa"; 09 and 10 run once, as the plan says), with tests/cleanup.sh before each run and once
# at the end. Writes a markdown log: a table dialog | channel | PASS/FAIL | state | notes, then the raw output of every
# run. Exit 0 only when every run passed. The log is scanned for the values in deploy/secrets.env before it is kept.
# Settings.reminder_hours_before is pinned at the start (must be >= 2) and re-read after every dialog; a dialog.sh exit 4
# (restore failed) or a changed value stops the whole run (exit 4).
set -uo pipefail
cd "$(dirname "$0")/.."
logf=""; label="dialog run"; lognotes=()
while [ $# -gt 0 ]; do
  case "$1" in
    --log) logf="$2"; shift 2 ;;
    --label) label="$2"; shift 2 ;;
    --note) lognotes+=("$2"); shift 2 ;;   # repeatable; each becomes a bullet under the log's header table
                                           # (not "notes": that name is the per-run FAIL summary below)
    *) break ;;
  esac
done
[ -n "$logf" ] || logf="tests/dialog-runs/$(date -u +%Y-%m-%d)-dialogs.md"
order=("$@"); [ ${#order[@]} -gt 0 ] || order=(01 02 03 04 05 06 07 08 12 11 10 09)
raw=$(mktemp); rows=$(mktemp)
trap 'rm -f "$raw" "$rows"' EXIT
pass=0; failn=0; t0=$(date -u +%Y-%m-%dT%H:%M:%SZ); stopped=""
# Pin Settings.reminder_hours_before: refuse to start on a value below 2 (a 1 left behind by an earlier reminder leg), hand
# the value to every dialog.sh (reminder_leg refuses when it finds anything else) and re-read it after every dialog.
hours() { (source tests/lib/airtable.sh; at_list Settings 1 | jq -r '.records[0].fields.reminder_hours_before'); }
pinned=$(hours) || pinned=""
[[ "$pinned" =~ ^[0-9]+$ ]] && [ "$pinned" -ge 2 ] || { echo "refusing to start: Settings.reminder_hours_before is '${pinned:-unreadable}' (must be an integer >= 2; restore it first)" >&2; exit 2; }
export DIALOGS_PINNED_HOURS=$pinned
echo "pinned reminder_hours_before=$pinned"
for nn in "${order[@]}"; do
  [ -z "$stopped" ] || break
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
    now_hours=$(hours) || now_hours=""
    if [ "$rc" -eq 4 ]; then stopped="dialog.sh exit 4 after $(basename "$f" .md) $ch: Settings.reminder_hours_before was NOT restored (reads '${now_hours:-unreadable}', pinned $pinned)"
    elif [ "$now_hours" != "$pinned" ]; then stopped="after $(basename "$f" .md) $ch Settings.reminder_hours_before reads '${now_hours:-unreadable}', pinned $pinned"; fi
    [ -z "$stopped" ] || { res=FAIL; notes="${notes:+$notes; }RUN STOPPED: $stopped"; [ "$rc" -eq 0 ] && { pass=$((pass - 1)); failn=$((failn + 1)); }; }
    printf '| %s | %s | %s | %s | %s |\n' "$(basename "$f" .md)" "$ch" "$res" "${state:--}" "${notes:-}" >> "$rows"
    if [ -n "$stopped" ]; then echo "RUN STOPPED: $stopped" | tee -a "$raw" >&2; break; fi
  done
done
final=$(tests/cleanup.sh 2>&1) && final="ok: $(printf '%s' "$final" | tail -1)" || final="FAILED: $final"
[ -z "$stopped" ] || final="$final; RUN STOPPED: $stopped"
{
  printf '# %s\n\n' "$label"
  printf '| | |\n|---|---|\n| Started | %s |\n| Finished | %s |\n| Dialogs | %s |\n| Result | passed %s, failed %s |\n| Final cleanup | %s |\n\n' \
    "$t0" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${order[*]}" "$pass" "$failn" "$final"
  for n in ${lognotes[@]+"${lognotes[@]}"}; do printf -- '- %s\n' "$n"; done   # +: an empty array under set -u (bash < 4.4)
  [ ${#lognotes[@]} -eq 0 ] || printf '\n'
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
[ -z "$stopped" ] || { echo "RUN STOPPED: $stopped" >&2; exit 4; }
[ "$failn" -eq 0 ]
