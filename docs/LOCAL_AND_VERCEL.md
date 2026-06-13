# Local Testing and Vercel Deployment

CoinFish is configured as one deployable project:

- Vite/React frontend builds to `frontend/dist`.
- FastAPI backend is exposed on Vercel under `/api/*`.
- The frontend always calls same-origin `/api`, so local and deployed paths match.

## Local Setup

Install Python dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

Install frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

Run both local servers against XRPL Devnet:

```bash
python3 -m backend.scripts.bootstrap_devnet
# save the printed JSON as setup.json
npm run dev:devnet
```

URLs:

- Frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8000`

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

- `python3 -m pytest backend/tests`
- `cd frontend && npm run build`
- `python3 scripts/smoke_api.py`

The smoke test covers signup, simulated checks, wallet connection persistence,
lender deposit/withdrawal accounting, borrower collateral/quote/loan, and the
vault dashboard in developer-demo mode. The real application path requires Devnet.

## Vercel Layout

Files added for deployment:

- `vercel.json` builds the frontend and rewrites `/api/*` to the Python function.
- `api/index.py` mounts `backend.main.app` at `/api`.
- `requirements.txt` points Vercel's Python install at `backend/requirements.txt`.
- root `package.json` provides local scripts and a Vercel-friendly project root.

Vercel currently documents FastAPI deployments as an exported `app` instance and
local testing through `vercel dev`. It documents Vite as a static frontend build.
This repo combines those two patterns: static Vite output plus a Python FastAPI
function.

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
- `COINFISH_SETUP_JSON`: path to Devnet bootstrap ids/seeds, default `setup.json`.
- `COINFISH_ISSUER_SEED`, `COINFISH_ISSUER_ADDRESS`, `COINFISH_OPERATOR_SEED`:
  Devnet throwaway setup values.
- `COINFISH_POOL_LOW_VAULT_ID`, `COINFISH_POOL_LOW_LOAN_BROKER_ID`, and the same
  pattern for `MED` and `HIGH`: pool ids for Vercel env-only setup.

On Vercel, `api/index.py` defaults `COINFISH_DB_URL` to
`sqlite:////tmp/coinfish.db` so preview deployments are writable. That state is
ephemeral and can disappear on cold starts or redeploys. For durable deployed
state, use a hosted database and set `COINFISH_DB_URL` to its SQLAlchemy URL.

## Notes

- Real XRPL actions need Devnet setup values configured as Vercel environment
  variables. There is no local synthetic transaction mode.
- The app rejects wallet/deposit/withdraw/loan/repay/default actions unless
  Devnet setup is complete.
- SQLite is fine locally. Do not treat Vercel `/tmp` SQLite as production
  persistence.
