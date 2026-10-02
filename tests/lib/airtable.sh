# source tests/lib/airtable.sh  (cwd = /opt/medspa)
source deploy/secrets.env
_AT="https://api.airtable.com/v0/$AIRTABLE_BASE_ID"
_H=(-H "Authorization: Bearer $AIRTABLE_PAT" -H "Content-Type: application/json")
at_list()   { curl -fsS -G "${_H[@]}" "$_AT/$1" --data-urlencode "filterByFormula=${2:-1}"; }                       # table formula → records json
at_create() { curl -fsS "${_H[@]}" -X POST "$_AT/$1" -d "$(jq -n --argjson f "$2" '{records: [{fields: $f}], typecast: true}')"; }  # table fields → created
at_update() { curl -fsS "${_H[@]}" -X PATCH "$_AT/$1/$2" -d "$(jq -n --argjson f "$3" '{fields: $f, typecast: true}')"; }         # table rec fields
at_delete() { curl -fsS "${_H[@]}" -X DELETE "$_AT/$1/$2" > /dev/null; }                                             # table rec
at_delete_where() { at_list "$1" "$2" | jq -r '.records[].id' | while read -r r; do at_delete "$1" "$r"; done; }     # table formula
# at_test_client_with_offer <n> <slot iso>: (re)creates client C-test-<n> (Telegram chat 90000000<n>, name "Test C-test-<n>")
# whose last offer, made just now, is exactly that one slot, so propose_booking will accept it.
at_test_client_with_offer() {
  at_delete_where Clients "{client_id}='C-test-$1'"
  at_create Clients "$(jq -n --arg c "C-test-$1" --arg t "90000000$1" --arg o "[\"$2\"]" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{client_id:$c, name:("Test "+$c), telegram_chat_id:$t, language:"en", status:"new", last_offer_json:$o, last_offer_at:$at}')"
}
at_rec_id() { at_list "$1" "$2" | jq -er '.records[0].id'; }                                                     # table formula → id of the first match
