CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL
);

CREATE TABLE assets (
    id BIGINT PRIMARY KEY,
    symbol VARCHAR(30) NOT NULL,
    asset_type VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    exchange VARCHAR(20),
    region VARCHAR(50),
    is_benchmark BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE asset_stock_detail (
    asset_id BIGINT PRIMARY KEY,
    sector VARCHAR(50),
    industry VARCHAR(50),
    market_cap BIGINT,
    pe_ratio DECIMAL(10, 2),
    CONSTRAINT fk_stock_detail_asset FOREIGN KEY (asset_id) REFERENCES assets (id)
);

CREATE TABLE asset_etf_detail (
    asset_id BIGINT PRIMARY KEY,
    fund_family VARCHAR(50),
    expense_ratio DECIMAL(6, 4),
    benchmark VARCHAR(100),
    CONSTRAINT fk_etf_detail_asset FOREIGN KEY (asset_id) REFERENCES assets (id)
);

CREATE TABLE asset_fund_detail (
    asset_id BIGINT PRIMARY KEY,
    fund_family VARCHAR(50),
    fund_type VARCHAR(20),
    expense_ratio DECIMAL(6, 4),
    nav DECIMAL(18, 6),
    CONSTRAINT fk_fund_detail_asset FOREIGN KEY (asset_id) REFERENCES assets (id)
);

CREATE TABLE asset_futures_detail (
    asset_id BIGINT PRIMARY KEY,
    underlying VARCHAR(50),
    expiry_date DATE,
    contract_size DECIMAL(18, 6),
    margin_rate DECIMAL(6, 4),
    CONSTRAINT fk_futures_detail_asset FOREIGN KEY (asset_id) REFERENCES assets (id)
);

CREATE TABLE asset_crypto_detail (
    asset_id BIGINT PRIMARY KEY,
    chain VARCHAR(50),
    contract_address VARCHAR(100),
    coingecko_id VARCHAR(100),
    CONSTRAINT fk_crypto_detail_asset FOREIGN KEY (asset_id) REFERENCES assets (id)
);

CREATE TABLE asset_bond_detail (
    asset_id BIGINT PRIMARY KEY,
    issuer VARCHAR(100),
    bond_type VARCHAR(20),
    face_value DECIMAL(18, 6),
    coupon_rate DECIMAL(6, 4),
    maturity_date DATE,
    CONSTRAINT fk_bond_detail_asset FOREIGN KEY (asset_id) REFERENCES assets (id)
);

CREATE TABLE asset_price_daily (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    asset_id BIGINT NOT NULL,
    trade_date DATE NOT NULL,
    close DECIMAL(18, 6) NOT NULL,
    CONSTRAINT fk_price_asset FOREIGN KEY (asset_id) REFERENCES assets (id)
);

CREATE TABLE fx_rate_latest (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    base_currency VARCHAR(10) NOT NULL,
    quote_currency VARCHAR(10) NOT NULL,
    rate DECIMAL(18, 8) NOT NULL,
    source VARCHAR(50) NOT NULL,
    symbol VARCHAR(50),
    as_of TIMESTAMP NOT NULL
);

CREATE TABLE fx_rate_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    base_currency VARCHAR(10) NOT NULL,
    quote_currency VARCHAR(10) NOT NULL,
    rate DECIMAL(18, 8) NOT NULL,
    source VARCHAR(50) NOT NULL,
    symbol VARCHAR(50),
    as_of TIMESTAMP NOT NULL
);

CREATE TABLE holdings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    asset_id BIGINT NOT NULL,
    quantity DECIMAL(18, 6) NOT NULL,
    avg_cost DECIMAL(18, 6) NOT NULL,
    CONSTRAINT fk_holdings_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_holdings_asset FOREIGN KEY (asset_id) REFERENCES assets (id)
);

CREATE TABLE trade_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    biz_id VARCHAR(64) NOT NULL,
    holding_id BIGINT NOT NULL,
    trade_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    quantity DECIMAL(18, 6) NOT NULL,
    price DECIMAL(18, 6) NOT NULL,
    amount DECIMAL(18, 6) NOT NULL,
    fee DECIMAL(18, 6) NOT NULL,
    holding_quantity_after DECIMAL(18, 6) NOT NULL,
    holding_avg_cost_after DECIMAL(18, 6) NOT NULL,
    traded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    note VARCHAR(255),
    CONSTRAINT fk_trade_holding FOREIGN KEY (holding_id) REFERENCES holdings (id)
);

CREATE TABLE watchlist (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    asset_id BIGINT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    note VARCHAR(255),
    CONSTRAINT fk_watchlist_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_watchlist_asset FOREIGN KEY (asset_id) REFERENCES assets (id)
);

CREATE TABLE cash_accounts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL,
    balance DECIMAL(18, 6) NOT NULL,
    available_balance DECIMAL(18, 6) NOT NULL,
    frozen_balance DECIMAL(18, 6) NOT NULL,
    CONSTRAINT fk_cash_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE cash_transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    biz_id VARCHAR(64) NOT NULL,
    user_id BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL,
    tx_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    amount DECIMAL(18, 6) NOT NULL,
    balance_after DECIMAL(18, 6) NOT NULL,
    available_balance_after DECIMAL(18, 6) NOT NULL,
    frozen_balance_after DECIMAL(18, 6) NOT NULL,
    ref_trade_id BIGINT,
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    note VARCHAR(255),
    CONSTRAINT fk_cash_tx_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE portfolio_nav_daily (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    nav_date DATE NOT NULL,
    total_value DECIMAL(18, 6) NOT NULL,
    holding_value DECIMAL(18, 6) NOT NULL,
    cash DECIMAL(18, 6) NOT NULL,
    net_value DECIMAL(18, 6) NOT NULL,
    daily_return DECIMAL(10, 6),
    CONSTRAINT fk_nav_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE system_config (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_val VARCHAR(255) NOT NULL
);
