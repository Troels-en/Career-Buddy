-- 0005 — Add client_id (text, unique) to applications.
--
-- Supports per-device localStorage IDs for the single-user setup. Frontend
-- generates an opaque client_id per row (e.g. ``a1731512345``) and uses
-- ``upsert on conflict client_id`` to sync.

alter table applications
  add column if not exists client_id text;

create unique index if not exists ux_applications_client_id
  on applications(client_id) where client_id is not null;

alter table applications
  add column if not exists job_url text;

alter table applications
  add column if not exists notes_text text;
