-- ================================================================
-- 1. 用户表
-- ================================================================

CREATE TABLE users (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ================================================================
-- 2. 资产基础表
-- ================================================================
CREATE TABLE assets (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    symbol       VARCHAR(30)  NOT NULL,
    asset_type   ENUM('STOCK','ETF','FUND','FUTURES','CRYPTO','BOND','INDEX') NOT NULL,
    name         VARCHAR(100) NOT NULL,
    currency     CHAR(10)     NOT NULL DEFAULT 'USD',
    exchange     VARCHAR(20),
    region       VARCHAR(50)  COMMENT '地区，如 CN / US / HK',
    is_benchmark TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否为基准指数',
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_symbol_type_exchange (symbol, asset_type, exchange)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ================================================================
-- 3. 资产扩展表
-- ================================================================

-- 股票扩展
CREATE TABLE asset_stock_detail (
    asset_id      BIGINT UNSIGNED PRIMARY KEY,
    sector        VARCHAR(50)     COMMENT '板块',
    industry      VARCHAR(50)     COMMENT '行业',
    market_cap    BIGINT UNSIGNED COMMENT '市值',
    pe_ratio      DECIMAL(10, 2)  COMMENT '市盈率',
    CONSTRAINT fk_stock_detail FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ETF 扩展
CREATE TABLE asset_etf_detail (
    asset_id      BIGINT UNSIGNED PRIMARY KEY,
    fund_family   VARCHAR(50)    COMMENT '发行商，如 Vanguard / BlackRock',
    expense_ratio DECIMAL(6, 4)  COMMENT '管理费率',
    benchmark     VARCHAR(100)   COMMENT '追踪指数',
    CONSTRAINT fk_etf_detail FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 基金扩展
CREATE TABLE asset_fund_detail (
    asset_id      BIGINT UNSIGNED PRIMARY KEY,
    fund_family   VARCHAR(50),
    fund_type     ENUM('MONEY_MARKET','BOND','EQUITY','MIXED') NOT NULL,
    expense_ratio DECIMAL(6, 4)  COMMENT '管理费率',
    nav           DECIMAL(18, 6) COMMENT '最新净值',
    CONSTRAINT fk_fund_detail FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 期货扩展
CREATE TABLE asset_futures_detail (
    asset_id      BIGINT UNSIGNED PRIMARY KEY,
    underlying    VARCHAR(50)    NOT NULL COMMENT '标的资产，如 Gold / Crude Oil',
    expiry_date   DATE           NOT NULL COMMENT '到期日',
    contract_size DECIMAL(18, 6) NOT NULL COMMENT '合约乘数',
    margin_rate   DECIMAL(6, 4)  COMMENT '保证金比例',
    CONSTRAINT fk_futures_detail FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 加密货币扩展
CREATE TABLE asset_crypto_detail (
    asset_id         BIGINT UNSIGNED PRIMARY KEY,
    chain            VARCHAR(50)  COMMENT '所属公链，如 Ethereum / Solana',
    contract_address VARCHAR(100) COMMENT '合约地址，原生币为 NULL',
    coingecko_id     VARCHAR(100) COMMENT '用于拉取行情的第三方 ID',
    CONSTRAINT fk_crypto_detail FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 债券扩展
CREATE TABLE asset_bond_detail (
    asset_id      BIGINT UNSIGNED PRIMARY KEY,
    issuer        VARCHAR(100)   NOT NULL COMMENT '发行方',
    bond_type     ENUM('GOVERNMENT','CORPORATE','MUNICIPAL') NOT NULL,
    face_value    DECIMAL(18, 6) NOT NULL COMMENT '面值',
    coupon_rate   DECIMAL(6, 4)  NOT NULL COMMENT '票面利率',
    maturity_date DATE           NOT NULL COMMENT '到期日',
    CONSTRAINT fk_bond_detail FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ================================================================
-- 4. 每日行情快照（含基准指数）
-- ================================================================
CREATE TABLE asset_price_daily (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    asset_id   BIGINT UNSIGNED NOT NULL,
    trade_date DATE            NOT NULL,
    open       DECIMAL(18, 6)  NOT NULL,
    high       DECIMAL(18, 6)  NOT NULL,
    low        DECIMAL(18, 6)  NOT NULL,
    close      DECIMAL(18, 6)  NOT NULL,
    volume     BIGINT UNSIGNED,
    UNIQUE KEY uq_asset_date (asset_id, trade_date),
    INDEX idx_asset_id   (asset_id),
    INDEX idx_trade_date (trade_date),
    CONSTRAINT fk_price_asset FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE asset_candle_cache (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    symbol          VARCHAR(30)     NOT NULL,
    candle_interval VARCHAR(10)     NOT NULL,
    trade_date      DATE            NOT NULL,
    open            DECIMAL(18, 6)  NOT NULL,
    high            DECIMAL(18, 6)  NOT NULL,
    low             DECIMAL(18, 6)  NOT NULL,
    close           DECIMAL(18, 6)  NOT NULL,
    source          VARCHAR(30),
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_symbol_interval_date (symbol, candle_interval, trade_date),
    INDEX idx_symbol_interval_date (symbol, candle_interval, trade_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ================================================================
-- 4.1 汇率最新快照与历史表
-- ================================================================
CREATE TABLE fx_rate_latest (
    id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    base_currency  CHAR(10)        NOT NULL COMMENT '基础币种，如 USD',
    quote_currency CHAR(10)        NOT NULL COMMENT '计价币种，如 CNY',
    rate           DECIMAL(18, 8)  NOT NULL COMMENT '1 base_currency = rate quote_currency',
    source         VARCHAR(50)     NOT NULL COMMENT '汇率来源，如 YAHOO_FINANCE',
    symbol         VARCHAR(50)     COMMENT '上游行情符号，如 USDCNY=X',
    as_of          TIMESTAMP       NOT NULL COMMENT '上游数据时间或同步时间',
    updated_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_fx_latest_pair (base_currency, quote_currency),
    INDEX idx_fx_latest_as_of (as_of)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE fx_rate_history (
    id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    base_currency  CHAR(10)        NOT NULL,
    quote_currency CHAR(10)        NOT NULL,
    rate           DECIMAL(18, 8)  NOT NULL,
    source         VARCHAR(50)     NOT NULL,
    symbol         VARCHAR(50),
    as_of          TIMESTAMP       NOT NULL,
    created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_fx_history_pair_as_of (base_currency, quote_currency, as_of),
    INDEX idx_fx_history_pair_time (base_currency, quote_currency, as_of)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ================================================================
-- 5. 持仓表
-- ================================================================
CREATE TABLE holdings (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    BIGINT UNSIGNED NOT NULL,
    asset_id   BIGINT UNSIGNED NOT NULL,
    quantity   DECIMAL(18, 6)  NOT NULL DEFAULT 0 COMMENT '持有数量',
    avg_cost   DECIMAL(18, 6)  NOT NULL DEFAULT 0 COMMENT '平均持仓成本',
    created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_asset (user_id, asset_id),
    CONSTRAINT fk_holdings_user  FOREIGN KEY (user_id)  REFERENCES users  (id) ON DELETE CASCADE,
    CONSTRAINT fk_holdings_asset FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ================================================================
-- 6. 交易历史表
-- ================================================================
CREATE TABLE trade_history (
    id         BIGINT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
    biz_id     VARCHAR(64)         NOT NULL COMMENT '业务幂等号',
    holding_id BIGINT UNSIGNED     NOT NULL,
    trade_type ENUM('BUY','SELL')  NOT NULL,
    status     ENUM('PENDING','SUCCESS','FAILED','CANCELED') NOT NULL DEFAULT 'SUCCESS' COMMENT '交易状态',
    quantity   DECIMAL(18, 6)      NOT NULL COMMENT '交易数量',
    price      DECIMAL(18, 6)      NOT NULL COMMENT '成交价格',
    amount     DECIMAL(18, 6)      NOT NULL COMMENT '成交金额 = quantity × price',
    fee        DECIMAL(18, 6)      NOT NULL DEFAULT 0 COMMENT '手续费',
    holding_quantity_after DECIMAL(18, 6) NOT NULL COMMENT '交易后持仓数量',
    holding_avg_cost_after DECIMAL(18, 6) NOT NULL COMMENT '交易后平均成本',
    traded_at  TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note       VARCHAR(255),
    UNIQUE KEY uq_trade_biz_id (biz_id),
    INDEX idx_holding_id (holding_id),
    INDEX idx_traded_at  (traded_at),
    CONSTRAINT fk_history_holding FOREIGN KEY (holding_id) REFERENCES holdings (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ================================================================
-- 7. 自选表
-- ================================================================
CREATE TABLE watchlist (
    id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id  BIGINT UNSIGNED NOT NULL,
    asset_id BIGINT UNSIGNED NOT NULL,
    added_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note     VARCHAR(255),
    UNIQUE KEY uq_watchlist_user_asset (user_id, asset_id),
    CONSTRAINT fk_watchlist_user  FOREIGN KEY (user_id)  REFERENCES users  (id) ON DELETE CASCADE,
    CONSTRAINT fk_watchlist_asset FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ================================================================
-- 8. 现金账户表
-- ================================================================
CREATE TABLE cash_accounts (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id           BIGINT UNSIGNED NOT NULL,
    currency          CHAR(10)        NOT NULL DEFAULT 'USD',
    balance           DECIMAL(18, 6)  NOT NULL DEFAULT 0 COMMENT '总余额 = 可用余额 + 冻结余额',
    available_balance DECIMAL(18, 6)  NOT NULL DEFAULT 0 COMMENT '可用余额',
    frozen_balance    DECIMAL(18, 6)  NOT NULL DEFAULT 0 COMMENT '冻结余额',
    updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_currency (user_id, currency),
    CONSTRAINT fk_cash_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ================================================================
-- 9. 现金流水表
-- ================================================================
CREATE TABLE cash_transactions (
    id                     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    biz_id                 VARCHAR(64)    NOT NULL COMMENT '业务幂等号',
    user_id                BIGINT UNSIGNED NOT NULL,
    currency               CHAR(10)        NOT NULL DEFAULT 'USD',
    tx_type                ENUM('DEPOSIT','WITHDRAW','BUY','SELL','FEE','DIVIDEND') NOT NULL,
    status                 ENUM('PENDING','SUCCESS','FAILED','CANCELED') NOT NULL DEFAULT 'SUCCESS' COMMENT '流水状态',
    amount                 DECIMAL(18, 6)  NOT NULL COMMENT '正数=入账，负数=扣款',
    balance_after          DECIMAL(18, 6)  NOT NULL COMMENT '交易后总余额',
    available_balance_after DECIMAL(18, 6) NOT NULL COMMENT '交易后可用余额',
    frozen_balance_after   DECIMAL(18, 6)  NOT NULL COMMENT '交易后冻结余额',
    ref_trade_id           BIGINT UNSIGNED COMMENT '关联 trade_history.id',
    occurred_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note                   VARCHAR(255),
    UNIQUE KEY uq_cash_tx_biz_id (biz_id),
    INDEX idx_user_id     (user_id),
    INDEX idx_occurred_at (occurred_at),
    CONSTRAINT fk_cash_tx_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ================================================================
-- 10. 组合每日净值快照（预计算，支撑风险类指标）
-- ================================================================
CREATE TABLE portfolio_nav_daily (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT UNSIGNED NOT NULL,
    nav_date    DATE            NOT NULL,
    total_value DECIMAL(18, 6)  NOT NULL COMMENT '组合总市值（持仓市值 + 现金）',
    holding_value DECIMAL(18, 6) NOT NULL COMMENT '持仓市值',
    cash        DECIMAL(18, 6)  NOT NULL DEFAULT 0 COMMENT '现金余额',
    net_value   DECIMAL(18, 6)  NOT NULL COMMENT '归一化净值，初始=1.0',
    daily_return DECIMAL(10, 6) COMMENT '当日收益率',
    UNIQUE KEY uq_user_date (user_id, nav_date),
    INDEX idx_nav_date (nav_date),
    CONSTRAINT fk_nav_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ================================================================
-- 11. 系统配置表（无风险利率等全局参数）
-- ================================================================
CREATE TABLE system_config (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    config_key  VARCHAR(100)   NOT NULL UNIQUE COMMENT '如 risk_free_rate_USD',
    config_val  VARCHAR(255)   NOT NULL,
    description VARCHAR(255),
    updated_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 初始化无风险利率（Sharpe Ratio 计算用）
INSERT INTO system_config (config_key, config_val, description) VALUES
('risk_free_rate_USD', '0.0525', '美元无风险利率，对应美国国债年化收益率'),
('risk_free_rate_CNY', '0.0220', '人民币无风险利率，对应余额宝年化');

-- 初始化基准指数资产
INSERT INTO assets (symbol, asset_type, name, currency, exchange, region, is_benchmark) VALUES
('000300.SH', 'INDEX', '沪深300', 'CNY', 'SSE',   'CN', 1),
('SPX',       'INDEX', 'S&P 500', 'USD', 'INDEX',  'US', 1),
('HSI',       'INDEX', '恒生指数', 'HKD', 'HKEX',  'HK', 1);
 
