INSERT INTO users (id, username, email, password_hash)
VALUES (1, 'demo_user', 'demo@example.com', 'local-demo-password')
ON DUPLICATE KEY UPDATE
    username = VALUES(username),
    email = VALUES(email),
    password_hash = VALUES(password_hash);

INSERT INTO assets (id, symbol, asset_type, name, currency, exchange, region, is_benchmark)
VALUES
    (101, 'AAPL', 'STOCK', 'Apple Inc.', 'USD', 'NASDAQ', 'US', FALSE),
    (102, 'MSFT', 'STOCK', 'Microsoft Corporation', 'USD', 'NASDAQ', 'US', FALSE),
    (103, 'NVDA', 'STOCK', 'NVIDIA Corporation', 'USD', 'NASDAQ', 'US', FALSE),
    (104, 'SPX', 'INDEX', 'S&P 500 Index', 'USD', 'INDEX', 'US', TRUE),
    (105, '000300.SH', 'INDEX', 'CSI 300 Index', 'CNY', 'SSE', 'CN', TRUE),
    (106, 'TSLA', 'STOCK', 'Tesla, Inc.', 'USD', 'NASDAQ', 'US', FALSE)
ON DUPLICATE KEY UPDATE
    symbol = VALUES(symbol),
    asset_type = VALUES(asset_type),
    name = VALUES(name),
    currency = VALUES(currency),
    exchange = VALUES(exchange),
    region = VALUES(region),
    is_benchmark = VALUES(is_benchmark);

INSERT INTO asset_stock_detail (asset_id, sector, industry, market_cap, pe_ratio)
VALUES
    (101, 'Technology', 'Consumer Electronics', 2960000000000, 30.15),
    (102, 'Technology', 'Software Infrastructure', 3110000000000, 35.80),
    (103, 'Technology', 'Semiconductors', 2840000000000, 62.40),
    (106, 'Consumer Cyclical', 'Auto Manufacturers', 812000000000, 58.90)
ON DUPLICATE KEY UPDATE
    sector = VALUES(sector),
    industry = VALUES(industry),
    market_cap = VALUES(market_cap),
    pe_ratio = VALUES(pe_ratio);

INSERT INTO asset_price_daily (id, asset_id, trade_date, close)
VALUES
    (1001, 101, '2026-03-25', 214.120000),
    (1002, 101, '2026-03-26', 216.450000),
    (1003, 101, '2026-03-27', 217.380000),
    (1004, 101, '2026-03-30', 219.640000),
    (1005, 101, '2026-03-31', 221.180000),
    (1006, 102, '2026-03-25', 431.620000),
    (1007, 102, '2026-03-26', 434.950000),
    (1008, 102, '2026-03-27', 436.210000),
    (1009, 102, '2026-03-30', 439.880000),
    (1010, 102, '2026-03-31', 441.320000),
    (1011, 103, '2026-03-25', 968.400000),
    (1012, 103, '2026-03-26', 974.300000),
    (1013, 103, '2026-03-27', 981.700000),
    (1014, 103, '2026-03-30', 990.200000),
    (1015, 103, '2026-03-31', 1004.800000),
    (1016, 104, '2026-03-25', 5742.180000),
    (1017, 104, '2026-03-26', 5760.940000),
    (1018, 104, '2026-03-27', 5788.310000),
    (1019, 104, '2026-03-30', 5822.450000),
    (1020, 104, '2026-03-31', 5849.770000),
    (1021, 105, '2026-03-25', 3925.220000),
    (1022, 105, '2026-03-26', 3941.810000),
    (1023, 105, '2026-03-27', 3958.480000),
    (1024, 105, '2026-03-30', 3988.920000),
    (1025, 105, '2026-03-31', 4012.600000),
    (1026, 106, '2026-03-25', 247.100000),
    (1027, 106, '2026-03-26', 249.800000),
    (1028, 106, '2026-03-27', 252.460000),
    (1029, 106, '2026-03-30', 255.320000),
    (1030, 106, '2026-03-31', 259.150000)
ON DUPLICATE KEY UPDATE
    asset_id = VALUES(asset_id),
    trade_date = VALUES(trade_date),
    close = VALUES(close);

INSERT INTO holdings (id, user_id, asset_id, quantity, avg_cost)
VALUES
    (201, 1, 101, 120.000000, 181.450000),
    (202, 1, 102, 85.000000, 376.220000),
    (203, 1, 103, 30.000000, 812.150000)
ON DUPLICATE KEY UPDATE
    user_id = VALUES(user_id),
    asset_id = VALUES(asset_id),
    quantity = VALUES(quantity),
    avg_cost = VALUES(avg_cost);

INSERT INTO watchlist (id, user_id, asset_id, note)
VALUES
    (301, 1, 101, 'Core compounder'),
    (302, 1, 102, 'AI platform exposure'),
    (303, 1, 103, 'Momentum watch')
ON DUPLICATE KEY UPDATE
    user_id = VALUES(user_id),
    asset_id = VALUES(asset_id),
    note = VALUES(note);

INSERT INTO cash_accounts (id, user_id, currency, balance, available_balance, frozen_balance)
VALUES
    (401, 1, 'USD', 48500.000000, 46200.000000, 2300.000000),
    (402, 1, 'CNY', 120000.000000, 120000.000000, 0.000000)
ON DUPLICATE KEY UPDATE
    user_id = VALUES(user_id),
    currency = VALUES(currency),
    balance = VALUES(balance),
    available_balance = VALUES(available_balance),
    frozen_balance = VALUES(frozen_balance);

INSERT INTO trade_history (
    id, biz_id, holding_id, trade_type, status, quantity, price, amount, fee, holding_quantity_after, holding_avg_cost_after, traded_at, note
)
VALUES
    (501, 'LOCAL-BUY-AAPL-001', 201, 'BUY', 'SUCCESS', 40.000000, 205.120000, 8204.800000, 4.800000, 120.000000, 181.450000, '2026-03-24 14:30:00', 'Rebalanced into AAPL'),
    (502, 'LOCAL-BUY-MSFT-001', 202, 'BUY', 'SUCCESS', 25.000000, 421.600000, 10540.000000, 5.000000, 85.000000, 376.220000, '2026-03-27 10:05:00', 'Added to software basket'),
    (503, 'LOCAL-BUY-NVDA-001', 203, 'BUY', 'SUCCESS', 10.000000, 988.000000, 9880.000000, 6.000000, 30.000000, 812.150000, '2026-03-31 09:45:00', 'Topped up semiconductor sleeve')
ON DUPLICATE KEY UPDATE
    biz_id = VALUES(biz_id),
    holding_id = VALUES(holding_id),
    trade_type = VALUES(trade_type),
    status = VALUES(status),
    quantity = VALUES(quantity),
    price = VALUES(price),
    amount = VALUES(amount),
    fee = VALUES(fee),
    holding_quantity_after = VALUES(holding_quantity_after),
    holding_avg_cost_after = VALUES(holding_avg_cost_after),
    traded_at = VALUES(traded_at),
    note = VALUES(note);

INSERT INTO cash_transactions (
    id, biz_id, user_id, currency, tx_type, status, amount, balance_after, available_balance_after, frozen_balance_after, ref_trade_id, occurred_at, note
)
VALUES
    (601, 'LOCAL-DEPOSIT-USD-001', 1, 'USD', 'DEPOSIT', 'SUCCESS', 60000.000000, 60000.000000, 60000.000000, 0.000000, NULL, '2026-03-20 08:00:00', 'Seed cash'),
    (602, 'LOCAL-BUY-AAPL-001', 1, 'USD', 'BUY', 'SUCCESS', -8209.600000, 51790.400000, 51790.400000, 0.000000, 501, '2026-03-24 14:30:00', 'Rebalanced into AAPL'),
    (603, 'LOCAL-BUY-MSFT-001', 1, 'USD', 'BUY', 'SUCCESS', -10545.000000, 41245.400000, 41245.400000, 0.000000, 502, '2026-03-27 10:05:00', 'Added to software basket'),
    (604, 'LOCAL-BUY-NVDA-001', 1, 'USD', 'BUY', 'SUCCESS', -9886.000000, 31359.400000, 29059.400000, 2300.000000, 503, '2026-03-31 09:45:00', 'Topped up semiconductor sleeve'),
    (605, 'LOCAL-DEPOSIT-CNY-001', 1, 'CNY', 'DEPOSIT', 'SUCCESS', 120000.000000, 120000.000000, 120000.000000, 0.000000, NULL, '2026-03-18 12:00:00', 'Onshore liquidity')
ON DUPLICATE KEY UPDATE
    biz_id = VALUES(biz_id),
    user_id = VALUES(user_id),
    currency = VALUES(currency),
    tx_type = VALUES(tx_type),
    status = VALUES(status),
    amount = VALUES(amount),
    balance_after = VALUES(balance_after),
    available_balance_after = VALUES(available_balance_after),
    frozen_balance_after = VALUES(frozen_balance_after),
    ref_trade_id = VALUES(ref_trade_id),
    occurred_at = VALUES(occurred_at),
    note = VALUES(note);

INSERT INTO portfolio_nav_daily (id, user_id, nav_date, total_value, holding_value, cash, net_value, daily_return)
VALUES
    (701, 1, '2026-03-25', 222860.000000, 129860.000000, 93000.000000, 1.000000, NULL),
    (702, 1, '2026-03-26', 224780.000000, 131780.000000, 93000.000000, 1.008615, 0.008615),
    (703, 1, '2026-03-27', 227140.000000, 134140.000000, 93000.000000, 1.019205, 0.010500),
    (704, 1, '2026-03-30', 231520.000000, 138520.000000, 93000.000000, 1.038856, 0.019280),
    (705, 1, '2026-03-31', 235360.000000, 142360.000000, 93000.000000, 1.056086, 0.016586)
ON DUPLICATE KEY UPDATE
    user_id = VALUES(user_id),
    nav_date = VALUES(nav_date),
    total_value = VALUES(total_value),
    holding_value = VALUES(holding_value),
    cash = VALUES(cash),
    net_value = VALUES(net_value),
    daily_return = VALUES(daily_return);

INSERT INTO system_config (id, config_key, config_val)
VALUES
    (801, 'risk_free_rate_USD', '0.045'),
    (802, 'risk_free_rate_CNY', '0.021')
ON DUPLICATE KEY UPDATE
    config_key = VALUES(config_key),
    config_val = VALUES(config_val);

INSERT INTO fx_rate_latest (id, base_currency, quote_currency, rate, source, symbol, as_of)
VALUES
    (901, 'CNY', 'CNY', 1.00000000, 'SYSTEM', NULL, '2026-03-31 08:00:00'),
    (902, 'USD', 'CNY', 7.23000000, 'LOCAL_SEED', 'USDCNY=X', '2026-03-31 08:00:00'),
    (903, 'HKD', 'CNY', 0.92450000, 'LOCAL_SEED', 'HKDCNY=X', '2026-03-31 08:00:00')
ON DUPLICATE KEY UPDATE
    base_currency = VALUES(base_currency),
    quote_currency = VALUES(quote_currency),
    rate = VALUES(rate),
    source = VALUES(source),
    symbol = VALUES(symbol),
    as_of = VALUES(as_of);
