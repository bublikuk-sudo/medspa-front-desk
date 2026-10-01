# source tests/lib/airtable.sh  (cwd = /opt/medspa)
source deploy/secrets.env
_AT="https://api.airtable.com/v0/$AIRTABLE_BASE_ID"
_H=(-H "Authorization: Bearer $AIRTABLE_PAT" -H "Content-Type: application/json")
at_list()   { curl -fsS -G "${_H[@]}" "$_AT/$1" --data-urlencode "filterByFormula=${2:-1}"; }                       # table formula → records json
at_create() { curl -fsS "${_H[@]}" -X POST "$_AT/$1" -d "$(jq -n --argjson f "$2" '{records: [{fields: $f}], typecast: true}')"; }  # table fields → created
at_update() { curl -fsS "${_H[@]}" -X PATCH "$_AT/$1/$2" -d "$(jq -n --argjson f "$3" '{fields: $f, typecast: true}')"; }         # table rec fields
at_delete() { curl -fsS "${_H[@]}" -X DELETE "$_AT/$1/$2" > /dev/null; }                                             # table rec
at_delete_where() { at_list "$1" "$2" | jq -r '.records[].id' | while read -r r; do at_delete "$1" "$r"; done; }     # table formula
