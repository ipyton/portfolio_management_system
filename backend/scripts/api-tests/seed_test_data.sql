-- Deterministic API test data.
-- Safe to re-run before api test scripts.

DELETE FROM cash_transactions WHERE user_id = 900001;
DELETE FROM trade_history
WHERE holding_id IN (
    SELECT id
    FROM holdings
    WHERE user_id = 900001
);
DELETE FROM watchlist WHERE user_id = 900001 AND asset_id = 900101;
DELETE FROM holdings WHERE user_id = 900001 AND asset_id = 900101;
DELETE FROM cash_accounts WHERE user_id = 900001 AND currency = 'USD';
DELETE FROM asset_price_daily WHERE asset_id = 900101;
DELETE FROM asset_stock_detail WHERE asset_id = 900101;
DELETE FROM assets WHERE id = 900101;
DELETE FROM users WHERE id = 900001;

INSERT INTO users (id, username, email, password_hash)
VALUES (900001, 'api_test_user', 'api_test_user@example.com', 'mock-password-hash');

INSERT INTO assets (id, symbol, asset_type, name, currency, exchange, region, is_benchmark)
VALUES (900101, 'AAPLTST', 'STOCK', 'Apple Test Holdings', 'USD', 'NASDAQ', 'US', 0);

INSERT INTO asset_stock_detail (asset_id, sector, industry, market_cap, pe_ratio)
VALUES (900101, 'Technology', 'Consumer Electronics', 3000000000000, 28.50);

INSERT INTO asset_price_daily (asset_id, trade_date, open, high, low, close, volume)
VALUES
    (900101, '2026-03-27', 178.000000, 181.000000, 177.500000, 179.000000, 1000000),
    (900101, '2026-03-30', 180.000000, 183.000000, 179.500000, 181.250000, 1250000);
