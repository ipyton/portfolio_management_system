# Backend

Spring Boot 3 + Java 17 backend scaffold with JPA and MySQL support.

## Stack

- Java 17
- Spring Boot
- Spring Web
- Spring Data JPA
- MySQL

## Environment variables

- `DB_URL`
- `DB_USERNAME`
- `DB_PASSWORD`
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
- `JOB_PORTFOLIO_NAV_SNAPSHOT_ENABLED`
- `JOB_PORTFOLIO_NAV_SNAPSHOT_CRON`
- `JOB_SYSTEM_CONFIG_REFRESH_ENABLED`
- `JOB_SYSTEM_CONFIG_REFRESH_CRON`
- `YAHOO_FINANCE_ENABLED`
- `YAHOO_FINANCE_BASE_URL`
- `YAHOO_FINANCE_TIMEOUT`
- `YAHOO_FINANCE_USER_AGENT`

## Run locally

```bash
cd backend
mvn spring-boot:run
```

Every request must include the configured request key header:

```text
X-Request-Key: ef928c10-2da4-4ca6-9b49-dedc912d5b4c
```

Swagger UI and `/v3/api-docs` are excluded from the request key filter so the documentation page can load normally. The actual business APIs still require the request key, and Swagger UI exposes it through the `Authorize` button.

## Runtime protection

- Request key filter: blocks requests without the configured header.
- Rate limit filter: defaults to 60 requests per 60 seconds per client IP.
- Degradation filter: when enabled, returns `503` for non-whitelisted paths.

## Scheduler

The backend includes a Spring scheduling scaffold backed by a dedicated thread pool.

Jobs currently wired:

- `marketDataRefresh`: intended for `asset_price_daily` and other market-driven asset fields such as `asset_fund_detail.nav`
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
```

## Asset search endpoint

```bash
GET /api/assets/search?query=AAPL
```

Behavior:

- Search `assets` and related detail tables in MySQL first
- If a local asset is found, use its `symbol` to enrich the response with Yahoo Finance detail
- If no local asset is found, resolve the symbol through Yahoo Finance search and return the external detail
