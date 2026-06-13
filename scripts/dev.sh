#!/usr/bin/env sh
set -eu

cleanup() {
  if [ -n "${API_PID:-}" ]; then
    kill "$API_PID" 2>/dev/null || true
  fi
  if [ -n "${WEB_PID:-}" ]; then
    kill "$WEB_PID" 2>/dev/null || true
  fi
}
trap cleanup INT TERM EXIT

python3 -m uvicorn backend.main:app --reload --port 8000 &
API_PID=$!

cd frontend
npm run dev -- --host 127.0.0.1 &
WEB_PID=$!
cd ..

printf "\nCoinFish local dev\n"
printf "  API:      http://127.0.0.1:8000\n"
printf "  Frontend: http://127.0.0.1:5173\n\n"

wait
