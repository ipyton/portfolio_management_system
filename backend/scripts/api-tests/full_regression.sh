#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

DEPOSIT_BIZ_ID="${DEPOSIT_BIZ_ID:-api-test-deposit-001}"
WITHDRAW_BIZ_ID="${WITHDRAW_BIZ_ID:-api-test-withdraw-001}"
BUY_BIZ_ID="${BUY_BIZ_ID:-api-test-buy-001}"
SELL_BIZ_ID="${SELL_BIZ_ID:-api-test-sell-001}"

log_step "Health endpoint"
request_json "health" "GET" "/api/health" "200" "" "0"

log_step "Stock search"
request_json "stock_search" "GET" "/api/stocks/search?keyword=${TEST_SYMBOL}" "200"
assert_jq '.count >= 1 and any(.items[]; .symbol == env.TEST_SYMBOL and .assetId == (env.TEST_ASSET_ID | tonumber))' \
    "stock search should return the seeded stock asset"

log_step "Clean watchlist item if it exists"
request_expect_one_of "watchlist_cleanup" "DELETE" "/api/watchlists/${TEST_ASSET_ID}?userId=${TEST_USER_ID}" "204,404"

log_step "Initial cash balance response"
request_json "cash_balances_before" "GET" "/api/cash-accounts?userId=${TEST_USER_ID}" "200"
assert_jq '.userId == (env.TEST_USER_ID | tonumber)' \
    "cash balance response should match the user"

log_step "Mock deposit"
request_json "deposit" "POST" "/api/cash-accounts/deposit" "201" \
    "{\"userId\":${TEST_USER_ID},\"currency\":\"USD\",\"amount\":10000,\"bizId\":\"${DEPOSIT_BIZ_ID}\",\"note\":\"api regression deposit\"}"
assert_jq ".bizId == \"${DEPOSIT_BIZ_ID}\" and .txType == \"DEPOSIT\" and .status == \"SUCCESS\" and .balanceAfter == 10000 and .availableBalanceAfter == 10000 and .frozenBalanceAfter == 0" \
    "deposit should succeed and update cash balances"

log_step "Repeat same deposit bizId should be idempotent"
request_json "deposit_replay" "POST" "/api/cash-accounts/deposit" "201" \
    "{\"userId\":${TEST_USER_ID},\"currency\":\"USD\",\"amount\":10000,\"bizId\":\"${DEPOSIT_BIZ_ID}\",\"note\":\"api regression deposit\"}"
assert_jq ".bizId == \"${DEPOSIT_BIZ_ID}\" and .balanceAfter == 10000 and .availableBalanceAfter == 10000" \
    "replayed deposit should return the original result"

log_step "Reusing deposit bizId with different amount should fail"
request_json "deposit_conflict" "POST" "/api/cash-accounts/deposit" "409" \
    "{\"userId\":${TEST_USER_ID},\"currency\":\"USD\",\"amount\":9999,\"bizId\":\"${DEPOSIT_BIZ_ID}\",\"note\":\"conflict deposit\"}"
assert_jq '.status == 409' \
    "reusing a cash bizId with different payload must return conflict"

log_step "Mock withdraw"
request_json "withdraw" "POST" "/api/cash-accounts/withdraw" "201" \
    "{\"userId\":${TEST_USER_ID},\"currency\":\"USD\",\"amount\":500,\"bizId\":\"${WITHDRAW_BIZ_ID}\",\"note\":\"api regression withdraw\"}"
assert_jq ".bizId == \"${WITHDRAW_BIZ_ID}\" and .txType == \"WITHDRAW\" and .status == \"SUCCESS\" and .balanceAfter == 9500 and .availableBalanceAfter == 9500 and .frozenBalanceAfter == 0" \
    "withdraw should reduce available cash"

log_step "Withdraw more than available balance should fail"
request_json "withdraw_too_much" "POST" "/api/cash-accounts/withdraw" "400" \
    "{\"userId\":${TEST_USER_ID},\"currency\":\"USD\",\"amount\":999999,\"bizId\":\"api-test-withdraw-over-limit\",\"note\":\"too much\"}"
assert_jq '.status == 400' \
    "over-withdraw should be rejected"

log_step "Preview buy trade"
request_json "preview_buy" "POST" "/api/trades/preview-buy" "200" \
    "{\"userId\":${TEST_USER_ID},\"assetId\":${TEST_ASSET_ID},\"quantity\":10,\"price\":180.5,\"fee\":1.2,\"note\":\"preview buy\"}"
assert_jq '.tradeType == "BUY" and .grossCashImpact == -1806.2 and .currency == "USD"' \
    "buy preview should compute the expected gross cash impact"

log_step "Missing bizId on buy should fail"
request_json "buy_missing_biz_id" "POST" "/api/trades/buy" "400" \
    "{\"userId\":${TEST_USER_ID},\"assetId\":${TEST_ASSET_ID},\"quantity\":1,\"price\":100,\"fee\":0.2,\"note\":\"missing bizId\"}"
assert_jq '.status == 400' \
    "buy without bizId should be rejected"

log_step "Execute buy trade"
request_json "buy" "POST" "/api/trades/buy" "201" \
    "{\"userId\":${TEST_USER_ID},\"assetId\":${TEST_ASSET_ID},\"quantity\":10,\"price\":180.5,\"bizId\":\"${BUY_BIZ_ID}\",\"fee\":1.2,\"note\":\"api regression buy\"}"
assert_jq ".bizId == \"${BUY_BIZ_ID}\" and .tradeType == \"BUY\" and .status == \"SUCCESS\" and .holdingQuantity == 10 and .cashBalance == 7693.8 and .cashAvailableBalance == 7693.8 and .cashFrozenBalance == 0" \
    "buy should update holdings and available cash"

log_step "Repeat same buy bizId should be idempotent"
request_json "buy_replay" "POST" "/api/trades/buy" "201" \
    "{\"userId\":${TEST_USER_ID},\"assetId\":${TEST_ASSET_ID},\"quantity\":10,\"price\":180.5,\"bizId\":\"${BUY_BIZ_ID}\",\"fee\":1.2,\"note\":\"api regression buy\"}"
assert_jq ".bizId == \"${BUY_BIZ_ID}\" and .holdingQuantity == 10 and .cashBalance == 7693.8" \
    "replayed buy should return the original trade result"

log_step "Reusing buy bizId with different quantity should fail"
request_json "buy_conflict" "POST" "/api/trades/buy" "409" \
    "{\"userId\":${TEST_USER_ID},\"assetId\":${TEST_ASSET_ID},\"quantity\":11,\"price\":180.5,\"bizId\":\"${BUY_BIZ_ID}\",\"fee\":1.2,\"note\":\"buy conflict\"}"
assert_jq '.status == 409' \
    "reusing a trade bizId with different payload must return conflict"

log_step "Current holdings"
request_json "holdings" "GET" "/api/holdings?userId=${TEST_USER_ID}" "200"
assert_jq 'any(.items[]; .assetId == (env.TEST_ASSET_ID | tonumber) and .quantity == 10)' \
    "holdings should contain the bought stock"

log_step "Trade history after buy"
request_json "trade_history_after_buy" "GET" "/api/trades/history?userId=${TEST_USER_ID}" "200"
assert_jq ".items | any(.bizId == \"${BUY_BIZ_ID}\" and .tradeType == \"BUY\" and .status == \"SUCCESS\")" \
    "trade history should include the buy trade"

log_step "Cash transactions after deposit, withdraw and buy"
request_json "cash_transactions_after_buy" "GET" "/api/cash-accounts/transactions?userId=${TEST_USER_ID}&currency=USD" "200"
assert_jq ".items | any(.bizId == \"${DEPOSIT_BIZ_ID}\" and .txType == \"DEPOSIT\") and any(.bizId == \"${WITHDRAW_BIZ_ID}\" and .txType == \"WITHDRAW\") and any(.bizId == \"${BUY_BIZ_ID}\" and .txType == \"BUY\")" \
    "cash transaction history should contain deposit, withdraw and buy entries"

log_step "Add stock to watchlist"
request_json "watchlist_add" "POST" "/api/watchlists" "201" \
    "{\"userId\":${TEST_USER_ID},\"assetId\":${TEST_ASSET_ID},\"note\":\"api regression watchlist\"}"
assert_jq '.assetId == (env.TEST_ASSET_ID | tonumber)' \
    "watchlist add should return the inserted item"

log_step "Watchlist should contain the stock"
request_json "watchlist_after_add" "GET" "/api/watchlists?userId=${TEST_USER_ID}" "200"
assert_jq 'any(.items[]; .assetId == (env.TEST_ASSET_ID | tonumber))' \
    "watchlist query should return the added asset"

log_step "Preview sell trade"
request_json "preview_sell" "POST" "/api/trades/preview-sell" "200" \
    "{\"userId\":${TEST_USER_ID},\"assetId\":${TEST_ASSET_ID},\"quantity\":4,\"price\":182.5,\"fee\":1.0,\"note\":\"preview sell\"}"
assert_jq '.tradeType == "SELL" and .grossCashImpact == 729 and .currency == "USD"' \
    "sell preview should compute the expected gross cash impact"

log_step "Execute sell trade"
request_json "sell" "POST" "/api/trades/sell" "201" \
    "{\"userId\":${TEST_USER_ID},\"assetId\":${TEST_ASSET_ID},\"quantity\":4,\"price\":182.5,\"bizId\":\"${SELL_BIZ_ID}\",\"fee\":1.0,\"note\":\"api regression sell\"}"
assert_jq ".bizId == \"${SELL_BIZ_ID}\" and .tradeType == \"SELL\" and .status == \"SUCCESS\" and .holdingQuantity == 6 and .cashBalance == 8422.8 and .cashAvailableBalance == 8422.8 and .cashFrozenBalance == 0" \
    "sell should update holdings and available cash"

log_step "Repeat same sell bizId should be idempotent"
request_json "sell_replay" "POST" "/api/trades/sell" "201" \
    "{\"userId\":${TEST_USER_ID},\"assetId\":${TEST_ASSET_ID},\"quantity\":4,\"price\":182.5,\"bizId\":\"${SELL_BIZ_ID}\",\"fee\":1.0,\"note\":\"api regression sell\"}"
assert_jq ".bizId == \"${SELL_BIZ_ID}\" and .holdingQuantity == 6 and .cashBalance == 8422.8" \
    "replayed sell should return the original trade result"

log_step "Trade history after sell"
request_json "trade_history_after_sell" "GET" "/api/trades/history?userId=${TEST_USER_ID}" "200"
assert_jq ".items | any(.bizId == \"${BUY_BIZ_ID}\" and .tradeType == \"BUY\") and any(.bizId == \"${SELL_BIZ_ID}\" and .tradeType == \"SELL\")" \
    "trade history should include both buy and sell trades"

log_step "Final cash balance should expose available and frozen balances"
request_json "cash_balances_after" "GET" "/api/cash-accounts?userId=${TEST_USER_ID}" "200"
assert_jq '.count >= 1 and any(.items[]; .currency == "USD" and .balance == 8422.8 and .availableBalance == 8422.8 and .frozenBalance == 0)' \
    "cash balance query should expose total, available and frozen balances"

log_step "Remove watchlist item"
request_json "watchlist_remove" "DELETE" "/api/watchlists/${TEST_ASSET_ID}?userId=${TEST_USER_ID}" "204"

log_step "Watchlist should no longer contain the stock"
request_json "watchlist_after_remove" "GET" "/api/watchlists?userId=${TEST_USER_ID}" "200"
assert_jq 'all(.items[]; .assetId != (env.TEST_ASSET_ID | tonumber))' \
    "watchlist should not contain the removed asset"

log_step "Invalid request key should be blocked"
request_json_with_custom_key "forbidden" "GET" "/api/holdings?userId=${TEST_USER_ID}" "403" "invalid-test-key"
assert_jq '.code == "FORBIDDEN" and .status == 403' \
    "request key filter should reject invalid keys"

printf '\nFull regression test completed successfully.\n'
