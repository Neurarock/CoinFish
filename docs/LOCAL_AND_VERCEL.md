# Local Testing and Vercel Deployment

CoinFish is configured as one deployable project:

- Vite/React frontend builds to `frontend/dist`.
- FastAPI backend is exposed on Vercel under `/api/*`.
- The frontend always calls same-origin `/api`, so local and deployed paths match.

## Local Setup

Install Python dependencies with **uv** (React UI stays on npm):

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uv sync --all-packages
```

Install frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

Run both local servers against XRPL Devnet:

```bash
uv run python -m backend.scripts.bootstrap_devnet
# save the printed JSON as setup.json
npm run dev:devnet
```

URLs:

- Frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8000`
- DB API: `http://127.0.0.1:8001`

The Vite dev server proxies `/api/*` to FastAPI and strips the `/api` prefix, so
the browser uses the same API paths it will use on Vercel. The app header must
show `XRPL Devnet` before wallet/deposit/borrow actions are usable.

The API status endpoint is `GET /runtime/status` locally and
`/api/runtime/status` on Vercel.

## Local Checks

Run the core local verification suite:

```bash
npm run test:local
```

This runs:

- `uv run pytest backend/tests` (+ service health + db tests via scripts)
- `cd frontend && npm run build`
- `uv run python scripts/smoke_api.py`

The smoke test covers signup, simulated checks, wallet connection persistence,
lender deposit/withdrawal accounting, borrower collateral/quote/loan, and the
vault dashboard in developer-demo mode. The real application path requires Devnet.

## Vercel Layout

Files used for deployment:

- `vercel.json` — frontend build + `/api/*` rewrite to the Python function; excludes microservice stubs from the serverless bundle.
- `api/index.py` — mounts `backend.main.app` at `/api`.
- `pyproject.toml` + `uv.lock` — Vercel uses **uv** to install Python deps; root project lists the product API runtime set.
- `requirements.txt` — exported from `coinfish-api` for a pinned serverless install (`uv export --package coinfish-api --no-dev`).
- `[tool.vercel] entrypoint = "api.index:app"` in `pyproject.toml`.
- `.python-version` — `3.12` (Vercel-supported).

CI production deploy (`.github/workflows/ci-prod.yml`) refreshes `requirements.txt`
from the uv lock before `vercel build` / `vercel deploy --prebuilt`.

## Deploy

From the repo root:

```bash
npm run test:local
vercel
```

For production:

```bash
vercel --prod
```

If deploying from the Vercel dashboard, use the repository root as the project
root. The checked-in `vercel.json` supplies the build command and output
directory.

## Environment Variables

Useful variables:

- `COINFISH_DB_URL`: local defaults to `sqlite:///./coinfish.db`.
- `NEON`: stable Neon Postgres URL (also accepted by the product API / Vercel).
- `NEON_DEV`: ephemeral Neon **dev branch** URL (auto-deletes after ~1 day).
  When set, `db_service` / Alembic prefer it over local Docker so you can run
  migration experiments safely: `npm run db:migrate` or `npm run test:db:neon`.
- `COINFISH_SETUP_JSON`: path to Devnet bootstrap ids/seeds, default `setup.json`.
- `COINFISH_ISSUER_SEED`, `COINFISH_ISSUER_ADDRESS`, `COINFISH_OPERATOR_SEED`:
  Devnet throwaway setup values.
- `COINFISH_POOL_LOW_VAULT_ID`, `COINFISH_POOL_LOW_LOAN_BROKER_ID`, and the same
  pattern for `MED` and `HIGH`: pool ids for Vercel env-only setup.
- `NEON_AUTH_BASE_URL`: Managed Better Auth URL (server JWT verification).
- `VITE_NEON_AUTH_URL`: same Auth URL, exposed to the Vite app for signup/login
  OTP. The Vite build also copies `NEON_AUTH_BASE_URL` onto this value when the
  `VITE_` var is unset, so Preview still requires email OTP. Demo
  email/password signup is local/CI only — Vercel Preview and Production reject
  it.

See the root [`.env.example`](../.env.example) for the full template.

On Vercel, `api/index.py` defaults `COINFISH_DB_URL` to
`sqlite:////tmp/coinfish.db` so preview deployments are writable. That state is
ephemeral and can disappear on cold starts or redeploys. For durable deployed
state, use a hosted database and set `COINFISH_DB_URL` (or `NEON`) to its URL.

On Vercel Preview **and** Production, set both Auth URLs (or at least
`NEON_AUTH_BASE_URL`) and the Devnet seeds. Public pool IDs ship in
`backend/setup_public.json`; issuer/operator seeds do not. After a local
bootstrap run:

```bash
uv run python -m backend.scripts.print_vercel_env
```

Paste `COINFISH_ISSUER_SEED` and `COINFISH_OPERATOR_SEED` (and the rest if you
want env-only IDs) into the Vercel project for Preview and Production, then
**redeploy**. Vite `VITE_*` values are baked in at build time.

Add each Preview URL as a Neon Auth trusted origin or OTP emails will not
complete.

## Notes

- Real XRPL actions need Devnet setup values. Seeds must be Vercel environment
  variables; public vault/broker IDs are committed in `backend/setup_public.json`.
- The app rejects wallet/deposit/withdraw/loan/repay/default actions unless
  Devnet setup is complete.
- SQLite is fine locally. Do not treat Vercel `/tmp` SQLite as production
  persistence.
