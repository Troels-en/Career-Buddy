alter table applications
  add column if not exists client_id text;

create unique index if not exists ux_applications_client_id
  on applications(client_id) where client_id is not null;

alter table applications
  add column if not exists job_url text;

alter table applications
  add column if not exists notes_text text;
