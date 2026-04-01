#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

log_step "Health endpoint"
request_json "health" "GET" "/api/health" "200" "" "0"

log_step "Stock search by seeded symbol"
request_json "stock_search" "GET" "/api/stocks/search?keyword=${TEST_SYMBOL}" "200"
assert_jq '.count >= 1 and any(.items[]; .symbol == env.TEST_SYMBOL)' \
    "stock search should return the seeded stock"

log_step "Cash balance query"
request_json "cash_balances" "GET" "/api/cash-accounts?userId=${TEST_USER_ID}" "200"
assert_jq '.userId == (env.TEST_USER_ID | tonumber)' \
    "cash balance response should match the seeded user"

log_step "Trade preview"
request_json "preview_buy" "POST" "/api/trades/preview-buy" "200" \
    "{\"userId\":${TEST_USER_ID},\"assetId\":${TEST_ASSET_ID},\"quantity\":1,\"price\":100,\"fee\":0.5,\"note\":\"smoke preview\"}"
assert_jq '.tradeType == "BUY" and .currency == "USD"' \
    "buy preview should return BUY and USD"

log_step "Unauthorized request should be blocked"
request_json_with_custom_key "unauthorized" "GET" "/api/cash-accounts?userId=${TEST_USER_ID}" "403" "invalid-test-key"
assert_jq '.code == "FORBIDDEN" and .status == 403' \
    "request key filter should reject invalid request keys"

printf '\nSmoke test completed successfully.\n'
