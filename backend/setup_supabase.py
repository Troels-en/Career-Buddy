#!/usr/bin/env -S uv run --quiet --with psycopg2-binary --with python-dotenv python3
"""Run schema.sql + seed_vc_jobs.sql against the Supabase project defined in .env.

Usage:
    uv run python scripts/setup_supabase.py
    OR (if uv is installed) just:
    ./scripts/setup_supabase.py

Reads SUPABASE_DB_URL from .env in the repo root.
Connects via psycopg2 and executes the two SQL files in order.
"""

import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

DB_URL = os.environ.get("SUPABASE_DB_URL", "")
if not DB_URL or "YOUR_PROJECT_REF" in DB_URL or "YOUR_DB_PASSWORD" in DB_URL:
    print("ERROR: SUPABASE_DB_URL is not set or still has placeholders.")
    print("Edit ~/fa-track/.env and replace the placeholders, then re-run.")
    sys.exit(1)

SCHEMA_FILE = ROOT / "data" / "schema.sql"
SEED_FILE = ROOT / "data" / "seed_vc_jobs.sql"

for f in (SCHEMA_FILE, SEED_FILE):
    if not f.exists():
        print(f"ERROR: missing {f}")
        sys.exit(1)


def run_sql(conn, sql_path: Path) -> None:
    sql = sql_path.read_text()
    print(f"[run] {sql_path.name} ({len(sql)} chars)")
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()
    print(f"[ok]  {sql_path.name}")


def main() -> int:
    print(f"[connect] {DB_URL.split('@')[-1]}")
    try:
        conn = psycopg2.connect(DB_URL)
    except Exception as e:
        print(f"ERROR: connection failed: {e}")
        return 2

    try:
        run_sql(conn, SCHEMA_FILE)
        run_sql(conn, SEED_FILE)
    except Exception as e:
        print(f"ERROR while running SQL: {e}")
        conn.rollback()
        conn.close()
        return 3

    # Verify
    with conn.cursor() as cur:
        cur.execute("select count(*) from vc_jobs")
        (count,) = cur.fetchone()
    print(f"[verify] vc_jobs rows = {count}")

    conn.close()
    print("[done] schema + seed applied")
    return 0


if __name__ == "__main__":
    sys.exit(main())
