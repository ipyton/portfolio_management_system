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

## Run locally

```bash
cd backend
mvn spring-boot:run
```

Every request must include the configured request key header:

```text
X-Request-Key: ef928c10-2da4-4ca6-9b49-dedc912d5b4c
```

## Runtime protection

- Request key filter: blocks requests without the configured header.
- Rate limit filter: defaults to 60 requests per 60 seconds per client IP.
- Degradation filter: when enabled, returns `503` for non-whitelisted paths.

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
