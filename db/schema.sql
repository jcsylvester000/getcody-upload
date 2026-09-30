-- GRID Cody Uploader — upload history (Neon Postgres).
-- Safe to run repeatedly. Applied automatically on first API call, or via `npm run db:migrate`.

create table if not exists upload_batches (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  status        text not null default 'sending',  -- sending | learning | complete | partial | failed
  item_count    int  not null check (item_count between 1 and 10),
  completed_at  timestamptz
);

create table if not exists upload_logs (
  id                uuid primary key default gen_random_uuid(),
  batch_id          uuid not null references upload_batches(id) on delete cascade,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  file_name         text   not null,
  file_size         bigint not null,
  content_type      text,
  folder_id         text   not null,
  folder_name       text,
  cody_key          text,
  cody_document_id  text,
  status            text   not null default 'queued',
  -- queued | uploading | uploaded (sent, Cody converting) | syncing | synced | sync_failed | error | timeout
  error             text,
  sent_at           timestamptz,
  learned_at        timestamptz
);

create index if not exists upload_logs_batch_idx   on upload_logs (batch_id);
create index if not exists upload_logs_created_idx on upload_logs (created_at desc);
create index if not exists upload_logs_folder_idx  on upload_logs (folder_id);
create unique index if not exists upload_logs_doc_uidx on upload_logs (cody_document_id) where cody_document_id is not null;
