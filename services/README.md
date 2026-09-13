# CoinFish FastAPI microservices

Python backends are managed with **uv**. The React/Vite UI stays on npm.

## Live services

| Service | Package | Port | Entry |
|---------|---------|------|-------|
| Product API (BFF) | `backend` / `coinfish-api` | 8000 | `backend.main:app` |
| Persistence | `db_service` / `coinfish-db` | 8001 | `db_service.main:app` |

The product API is what the frontend calls today. Domain logic still lives there;
extract into the stubs below as you peel routers off.

## Domain stubs (ready to grow)

| Service | Port | Entry |
|---------|------|-------|
| auth | 8002 | `services.auth.main:app` → run as `services.auth.main:app` via module path below |
| pools | 8003 | `services/pools/main.py` |
| lending | 8004 | `services/lending/main.py` |
| borrowing | 8005 | `services/borrowing/main.py` |
| xrpl | 8006 | `services/xrpl/main.py` |
| admin | 8007 | `services/admin/main.py` |

```bash
uv sync
uv run uvicorn backend.main:app --reload --port 8000
uv run uvicorn db_service.main:app --reload --port 8001
uv run uvicorn services.auth.main:app --reload --port 8002   # needs package path — see scripts
```

For stub services (flat `main.py` modules):

```bash
uv run uvicorn --app-dir services/auth main:app --reload --port 8002
```

## DB migrations (Alembic)

```bash
# Local Docker Postgres (default when NEON_DEV is unset)
npm run db:up
npm run db:migrate

# Ephemeral Neon dev branch — set NEON_DEV in repo-root `.env`
npm run db:migrate:neon   # same Alembic upgrade; URL comes from NEON_DEV
npm run test:db:neon       # live upgrade/downgrade against that branch
```

`NEON_DEV` is intended for short-lived branches (Neon can auto-delete after ~1 day).
Do not point durable app traffic at it; use `NEON` / `COINFISH_DB_URL` for that.

## Adding a new microservice

1. Copy an existing folder under `services/`.
2. Add it to `[tool.uv.workspace].members` in the root `pyproject.toml`.
3. `uv sync`
4. Wire a script in root `package.json` / compose if it should run in dev.
