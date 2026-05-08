"""Database connection helpers.

Reads ``SUPABASE_DB_URL`` from the repo-root ``.env`` and exposes a single
function that yields a ``psycopg.Connection``.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import psycopg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[3]
ENV_PATH = REPO_ROOT / ".env"


def load_env() -> None:
    """Load the repo-root ``.env`` once. Idempotent."""
    if ENV_PATH.exists():
        load_dotenv(ENV_PATH, override=False)


def db_url() -> str:
    """Return ``SUPABASE_DB_URL`` or raise if missing."""
    load_env()
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        raise RuntimeError(
            f"SUPABASE_DB_URL not set. Expected in {ENV_PATH}. "
            "See .env.example for the expected shape."
        )
    return url


@contextmanager
def connect() -> Iterator[psycopg.Connection]:
    """Open a Postgres connection to the configured Supabase project."""
    with psycopg.connect(db_url(), autocommit=False) as conn:
        yield conn
