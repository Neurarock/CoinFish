"""Pytest bootstrap: isolate backend tests on a throwaway SQLite file.

Must run before any `backend.db` / `backend.main` import so tests never touch
the developer's local DB or leftover rows from a previous pytest run.
"""
from __future__ import annotations

import os
import tempfile

_fd, _PATH = tempfile.mkstemp(prefix="coinfish-pytest-", suffix=".db")
os.close(_fd)
os.environ["COINFISH_DB_URL"] = "sqlite:///" + _PATH


def pytest_sessionfinish(session, exitstatus):
    for path in (_PATH, _PATH + "-journal", _PATH + "-wal", _PATH + "-shm"):
        try:
            os.unlink(path)
        except OSError:
            pass
