#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${HEERA_TEST_BASE_URL:-http://127.0.0.1:8080}"
COOKIE="$(mktemp)"; trap 'rm -f "$COOKIE"' EXIT

login=$(curl -fsS -c "$COOKIE" -H 'Content-Type: application/json' -d '{"login":"admin@havenly.local","password":"Havenly2026!"}' "$BASE_URL/api.php?action=login")
echo "$login" | php -r '$j=json_decode(stream_get_contents(STDIN),true); if(empty($j["user"]["id"])) exit(1); echo "[PASS] admin login\n";'
csrfJson=$(curl -fsS -b "$COOKIE" -c "$COOKIE" "$BASE_URL/admin-api.php?route=csrf")
csrf=$(echo "$csrfJson" | php -r '$j=json_decode(stream_get_contents(STDIN),true); echo $j["csrf_token"]??"";')
test -n "$csrf"

bootstrap=$(curl -fsS -b "$COOKIE" "$BASE_URL/admin-api.php?route=bootstrap")
echo "$bootstrap" | php -r '$j=json_decode(stream_get_contents(STDIN),true); if(empty($j["authenticated"])||($j["user"]["role"]??"")!=="super_admin"||empty($j["capabilities"]["subprojects"])||empty($j["capabilities"]["roles"])) exit(1); echo "[PASS] RBAC bootstrap\n";'

curl -fsS -b "$COOKIE" "$BASE_URL/admin-api.php?route=sub-projects" | php -r '$j=json_decode(stream_get_contents(STDIN),true); if(!is_array($j)) exit(1); echo "[PASS] sub-project API\n";'
roles=$(curl -fsS -b "$COOKIE" "$BASE_URL/admin-api.php?route=roles")
echo "$roles" | php -r '$j=json_decode(stream_get_contents(STDIN),true); if(empty($j["roles"])||empty($j["permissions"])) exit(1); echo "[PASS] roles API\n";'
agentRole=$(echo "$roles" | php -r '$j=json_decode(stream_get_contents(STDIN),true); foreach($j["roles"] as $r){if(($r["role_key"]??"")==="agent"){echo $r["role_id"];break;}}')
test -n "$agentRole"

# Create a temporary Agent admin and prove route-level permissions cannot be bypassed.
curl -fsS -b "$COOKIE" -H "X-CSRF-Token: $csrf" -H 'Content-Type: application/json' \
  -d "{\"user_type\":\"admin\",\"full_name\":\"CI Agent\",\"email\":\"ci-agent@example.test\",\"username\":\"ci_agent\",\"phone\":\"\",\"role_id\":$agentRole,\"new_password\":\"AgentPass2026!\",\"is_active\":1}" \
  "$BASE_URL/admin-api.php?route=users/save" >/dev/null
curl -fsS -b "$COOKIE" -H "X-CSRF-Token: $csrf" -H 'Content-Type: application/json' -d '{}' "$BASE_URL/admin-api.php?route=logout" >/dev/null

rm -f "$COOKIE"; COOKIE="$(mktemp)"
curl -fsS -c "$COOKIE" -H 'Content-Type: application/json' -d '{"login":"ci_agent","password":"AgentPass2026!"}' "$BASE_URL/api.php?action=login" >/dev/null
agentBootstrap=$(curl -fsS -b "$COOKIE" "$BASE_URL/admin-api.php?route=bootstrap")
echo "$agentBootstrap" | php -r '$j=json_decode(stream_get_contents(STDIN),true); if(($j["user"]["role"]??"")!=="agent"||empty($j["capabilities"]["leads"])||!empty($j["capabilities"]["roles"])) exit(1); echo "[PASS] agent capability profile\n";'
curl -fsS -b "$COOKIE" "$BASE_URL/admin-api.php?route=properties" >/dev/null
status=$(curl -sS -o /tmp/heera-rbac.json -w '%{http_code}' -b "$COOKIE" "$BASE_URL/admin-api.php?route=roles")
test "$status" = "403" && echo "[PASS] unauthorized roles route blocked"

# Restore super admin session for the health test.
rm -f "$COOKIE"; COOKIE="$(mktemp)"
curl -fsS -c "$COOKIE" -H 'Content-Type: application/json' -d '{"login":"admin@havenly.local","password":"Havenly2026!"}' "$BASE_URL/api.php?action=login" >/dev/null
curl -fsS -b "$COOKIE" "$BASE_URL/admin-api.php?route=health" | php -r '$j=json_decode(stream_get_contents(STDIN),true); if(($j["database"]??"")!=="connected"||empty($j["schema_ready"])) exit(1); foreach(($j["foreign_keys"]??[]) as $ok){if(!$ok)exit(1);} echo "[PASS] API/database health\n";'
