# Backend

Spring Boot 3 + Java 17 backend scaffold with JPA and MySQL support.

## Stack

- Java 17
- Spring Boot
- Spring Web
- Spring Data JPA
- MySQL

## Environment variables

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `JPA_DDL_AUTO`
- `JPA_SHOW_SQL`
- `SERVER_PORT`
- `REQUEST_KEY`
- `REQUEST_KEY_HEADER`
- `RATE_LIMIT_ENABLED`
- `RATE_LIMIT_MAX_REQUESTS`
- `RATE_LIMIT_WINDOW_SECONDS`
- `DEGRADATION_ENABLED`
- `DEGRADATION_ALLOW_PATHS`
- `DEGRADATION_MESSAGE`
- `SPRINGDOC_API_DOCS_PATH`
- `SPRINGDOC_SWAGGER_UI_PATH`
- `SCHEDULER_ZONE`
- `SCHEDULER_POOL_SIZE`
- `SCHEDULER_SHUTDOWN_WAIT_SECONDS`
- `JOB_MARKET_DATA_REFRESH_ENABLED`
- `JOB_MARKET_DATA_REFRESH_CRON`
- `JOB_FX_RATE_REFRESH_ENABLED`
- `JOB_FX_RATE_REFRESH_CRON`
- `JOB_PORTFOLIO_NAV_SNAPSHOT_ENABLED`
- `JOB_PORTFOLIO_NAV_SNAPSHOT_CRON`
- `JOB_SYSTEM_CONFIG_REFRESH_ENABLED`
- `JOB_SYSTEM_CONFIG_REFRESH_CRON`
- `YAHOO_FINANCE_ENABLED`
- `YAHOO_FINANCE_BASE_URL`
- `YAHOO_FINANCE_TIMEOUT`
- `YAHOO_FINANCE_USER_AGENT`
- `TWELVE_DATA_API_KEY`
- `TWELVE_DATA_API_KEYS` (comma-separated keys, used as a fallback key pool)
- `TWELVE_DATA_MAX_REQUESTS_PER_MINUTE`
- `TWELVE_DATA_RATE_LIMIT_COOLDOWN`
- `FX_ENABLED`
- `FX_REPORTING_CURRENCY`
- `FX_PERSIST_HISTORY`
- `FX_STALE_AFTER`
- `FX_TRACKED_CURRENCIES`
- `FX_SYMBOL_USD`
- `FX_SYMBOL_HKD`

## Run locally

```bash
cd backend
mvn spring-boot:run
```

Default local startup targets a MySQL container on `localhost:3306` with database `mydatabase`, user `myuser`, and password `MyUserPass123`.

Use the `local` profile for frontend/backend joint debugging with MySQL:

```bash
cd backend
SPRING_PROFILES_ACTIVE=local mvn spring-boot:run
```

The `local` profile provides:

- MySQL datasource (same defaults as `application.yml`, override with `LOCAL_SPRING_DATASOURCE_*`)
- SQL init disabled by default (`spring.sql.init.mode=never`), suitable for manual table management
- disabled schedulers and rate limiting
- Yahoo Finance enabled for market data fallback testing

Every request must include the configured request key header:

```text
X-Request-Key: ef928c10-2da4-4ca6-9b49-dedc912d5b4c
```

You can verify the key with:

```bash
GET /api/auth/verify
```

`200` means the key is valid. Missing or invalid key returns `403`.

Swagger UI and `/v3/api-docs` are excluded from the request key filter so the documentation page can load normally. The actual business APIs still require the request key, and Swagger UI exposes it through the `Authorize` button.

## Runtime protection

- Request key filter: blocks requests without the configured header.
- Rate limit filter: defaults to 60 requests per 60 seconds per client IP.
- Degradation filter: when enabled, returns `503` for non-whitelisted paths.

## Scheduler

The backend includes a Spring scheduling scaffold backed by a dedicated thread pool.

Jobs currently wired:

- `marketDataRefresh`: intended for `asset_price_daily` and other market-driven asset fields such as `asset_fund_detail.nav`
- `fxRateRefresh`: syncs latest FX rates into `fx_rate_latest` and optionally `fx_rate_history`
- `portfolioNavSnapshot`: intended for `portfolio_nav_daily`, computed from `holdings`, `cash_accounts`, and `asset_price_daily`
- `systemConfigRefresh`: intended for externally sourced system parameters in `system_config`, such as risk-free rates

Tables such as `users`, `holdings`, `trade_history`, `watchlist`, `cash_accounts`, and `cash_transactions` are event-driven and should normally be updated by APIs or domain services, not by scheduled jobs.

## Package

```bash
cd backend
mvn clean package
java -jar target/backend-0.0.1-SNAPSHOT.jar
```

## Test endpoint

```bash
GET /api/health
```

## API documentation

```bash
GET /swagger-ui.html
GET /v3/api-docs
GET /v3/api-docs.yaml
```

Default URLs:

- Swagger UI: `http://localhost:8080/swagger-ui.html`
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`
- OpenAPI YAML: `http://localhost:8080/v3/api-docs.yaml`

## Analytics endpoint

```bash
GET /api/portfolio/analytics
```

Optional query parameter:

```text
benchmarkSymbol=SPX
baseCurrency=CNY
```

`baseCurrency` controls how holdings, cash, and transaction totals are aggregated when FX data is available.

## FX endpoint

```bash
GET /api/fx/latest
GET /api/fx/latest?quoteCurrency=USD
```

## Asset search endpoint

```bash
GET /api/assets/search?query=AAPL
GET /api/assets/suggestions?query=App
GET /api/assets/suggestions?query=App&limit=10
```

Behavior:

- Search `assets` and related detail tables in MySQL first
- If a local asset is found, use its `symbol` to enrich the response with Yahoo Finance detail
- If no local asset is found, resolve the symbol through Yahoo Finance search and return the external detail
- `GET /api/assets/suggestions` is intended for autocomplete and only returns lightweight local candidates

## API test scripts

The repository includes reusable API test scripts under `backend/scripts/api-tests`.

Included files:

- `backend/scripts/api-tests/smoke.sh`: lightweight health, auth, search, and preview checks
- `backend/scripts/api-tests/full_regression.sh`: broader regression flow covering deposit, withdraw, idempotency, buy, sell, holdings, history, watchlist, and auth failure cases

Required environment variables:

- `TEST_USER_ID`
- `TEST_ASSET_ID`
- `TEST_SYMBOL`

Recommended flow:

1. Start the backend.
2. Ensure the configured `TEST_USER_ID` and `TEST_ASSET_ID` exist in your database, and `TEST_SYMBOL` matches that asset.
3. Run one of the scripts below.

Example:

```bash
cd backend
export TEST_USER_ID=1
export TEST_ASSET_ID=101
export TEST_SYMBOL=AAPL
bash scripts/api-tests/smoke.sh
bash scripts/api-tests/full_regression.sh
```

Useful environment overrides:

- `BASE_URL`
- `REQUEST_KEY`
- `REQUEST_KEY_HEADER`
- `TEST_USER_ID`
- `TEST_ASSET_ID`
- `TEST_SYMBOL`
- `DEPOSIT_BIZ_ID`
- `WITHDRAW_BIZ_ID`
- `BUY_BIZ_ID`
- `SELL_BIZ_ID`
