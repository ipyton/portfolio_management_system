CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
    id BIGINT UNSIGNED PRIMARY KEY,
    symbol VARCHAR(30) NOT NULL,
    asset_type VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    exchange VARCHAR(20),
    region VARCHAR(50),
    is_benchmark TINYINT(1) NOT NULL DEFAULT 0,
    last_price_refreshed_at TIMESTAMP NULL,
    UNIQUE KEY uq_symbol_type_exchange (symbol, asset_type, exchange)
);

CREATE TABLE IF NOT EXISTS asset_stock_detail (
    asset_id BIGINT UNSIGNED PRIMARY KEY,
    sector VARCHAR(50),
    industry VARCHAR(50),
    market_cap BIGINT UNSIGNED,
    pe_ratio DECIMAL(10, 2),
    CONSTRAINT fk_stock_detail_asset FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS asset_etf_detail (
    asset_id BIGINT UNSIGNED PRIMARY KEY,
    fund_family VARCHAR(50),
    expense_ratio DECIMAL(6, 4),
    benchmark VARCHAR(100),
    CONSTRAINT fk_etf_detail_asset FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS asset_fund_detail (
    asset_id BIGINT UNSIGNED PRIMARY KEY,
    fund_family VARCHAR(50),
    fund_type VARCHAR(20),
    expense_ratio DECIMAL(6, 4),
    nav DECIMAL(18, 6),
    CONSTRAINT fk_fund_detail_asset FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS asset_futures_detail (
    asset_id BIGINT UNSIGNED PRIMARY KEY,
    underlying VARCHAR(50),
    expiry_date DATE,
    contract_size DECIMAL(18, 6),
    margin_rate DECIMAL(6, 4),
    CONSTRAINT fk_futures_detail_asset FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS asset_crypto_detail (
    asset_id BIGINT UNSIGNED PRIMARY KEY,
    chain VARCHAR(50),
    contract_address VARCHAR(100),
    coingecko_id VARCHAR(100),
    CONSTRAINT fk_crypto_detail_asset FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS asset_bond_detail (
    asset_id BIGINT UNSIGNED PRIMARY KEY,
    issuer VARCHAR(100),
    bond_type VARCHAR(20),
    face_value DECIMAL(18, 6),
    coupon_rate DECIMAL(6, 4),
    maturity_date DATE,
    CONSTRAINT fk_bond_detail_asset FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS asset_price_daily (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    asset_id BIGINT UNSIGNED NOT NULL,
    trade_date DATE NOT NULL,
    close DECIMAL(18, 6) NOT NULL,
    UNIQUE KEY uq_asset_date (asset_id, trade_date),
    KEY idx_asset_id (asset_id),
    KEY idx_trade_date (trade_date),
    CONSTRAINT fk_price_asset FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS asset_candle_cache (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(30) NOT NULL,
    candle_interval VARCHAR(10) NOT NULL,
    trade_date DATE NOT NULL,
    `open` DECIMAL(18, 6) NOT NULL,
    high DECIMAL(18, 6) NOT NULL,
    low DECIMAL(18, 6) NOT NULL,
    close DECIMAL(18, 6) NOT NULL,
    source VARCHAR(30),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_symbol_interval_date (symbol, candle_interval, trade_date),
    KEY idx_symbol_interval_date (symbol, candle_interval, trade_date)
);

CREATE TABLE IF NOT EXISTS fx_rate_latest (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    base_currency VARCHAR(10) NOT NULL,
    quote_currency VARCHAR(10) NOT NULL,
    rate DECIMAL(18, 8) NOT NULL,
    source VARCHAR(50) NOT NULL,
    symbol VARCHAR(50),
    as_of TIMESTAMP NOT NULL,
    UNIQUE KEY uq_fx_latest_pair (base_currency, quote_currency),
    KEY idx_fx_latest_as_of (as_of)
);

CREATE TABLE IF NOT EXISTS fx_rate_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    base_currency VARCHAR(10) NOT NULL,
    quote_currency VARCHAR(10) NOT NULL,
    rate DECIMAL(18, 8) NOT NULL,
    source VARCHAR(50) NOT NULL,
    symbol VARCHAR(50),
    as_of TIMESTAMP NOT NULL,
    UNIQUE KEY uq_fx_history_pair_as_of (base_currency, quote_currency, as_of)
);

CREATE TABLE IF NOT EXISTS holdings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    asset_id BIGINT UNSIGNED NOT NULL,
    quantity DECIMAL(18, 6) NOT NULL,
    avg_cost DECIMAL(18, 6) NOT NULL,
    UNIQUE KEY uq_user_asset (user_id, asset_id),
    CONSTRAINT fk_holdings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_holdings_asset FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS trade_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    biz_id VARCHAR(64) NOT NULL,
    holding_id BIGINT UNSIGNED NOT NULL,
    trade_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    quantity DECIMAL(18, 6) NOT NULL,
    price DECIMAL(18, 6) NOT NULL,
    amount DECIMAL(18, 6) NOT NULL,
    fee DECIMAL(18, 6) NOT NULL,
    holding_quantity_after DECIMAL(18, 6) NOT NULL,
    holding_avg_cost_after DECIMAL(18, 6) NOT NULL,
    traded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note VARCHAR(255),
    UNIQUE KEY uq_trade_biz_id (biz_id),
    KEY idx_holding_id (holding_id),
    CONSTRAINT fk_trade_holding FOREIGN KEY (holding_id) REFERENCES holdings (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS watchlist (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    asset_id BIGINT UNSIGNED NOT NULL,
    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note VARCHAR(255),
    UNIQUE KEY uq_watchlist_user_asset (user_id, asset_id),
    CONSTRAINT fk_watchlist_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_watchlist_asset FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cash_accounts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    currency VARCHAR(10) NOT NULL,
    balance DECIMAL(18, 6) NOT NULL,
    available_balance DECIMAL(18, 6) NOT NULL,
    frozen_balance DECIMAL(18, 6) NOT NULL,
    UNIQUE KEY uq_user_currency (user_id, currency),
    CONSTRAINT fk_cash_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cash_transactions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    biz_id VARCHAR(64) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    currency VARCHAR(10) NOT NULL,
    tx_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    amount DECIMAL(18, 6) NOT NULL,
    balance_after DECIMAL(18, 6) NOT NULL,
    available_balance_after DECIMAL(18, 6) NOT NULL,
    frozen_balance_after DECIMAL(18, 6) NOT NULL,
    ref_trade_id BIGINT UNSIGNED,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note VARCHAR(255),
    UNIQUE KEY uq_cash_tx_biz_id (biz_id),
    KEY idx_user_id (user_id),
    CONSTRAINT fk_cash_tx_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS portfolio_nav_daily (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    nav_date DATE NOT NULL,
    total_value DECIMAL(18, 6) NOT NULL,
    holding_value DECIMAL(18, 6) NOT NULL,
    cash DECIMAL(18, 6) NOT NULL,
    net_value DECIMAL(18, 6) NOT NULL,
    daily_return DECIMAL(10, 6),
    UNIQUE KEY uq_user_date (user_id, nav_date),
    CONSTRAINT fk_nav_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS system_config (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_val VARCHAR(255) NOT NULL
);
