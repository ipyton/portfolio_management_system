# Frontend

## Run locally

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api/*` requests to `http://localhost:8080` by default.

For local full-stack debugging, start the backend first with:

```bash
cd backend
SPRING_PROFILES_ACTIVE=local mvn spring-boot:run
```
