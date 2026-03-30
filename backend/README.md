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

## Run locally

```bash
cd backend
mvn spring-boot:run
```

Every request must include the configured request key header:

```text
X-Request-Key: ef928c10-2da4-4ca6-9b49-dedc912d5b4c
```

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
