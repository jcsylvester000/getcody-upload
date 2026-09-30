// Upload history schema (Neon Postgres). Idempotent — safe to run on every cold start.
// Human-readable copy: db/schema.sql. Keep both in sync.

export const SCHEMA_STATEMENTS = [
  `create table if not exists upload_batches (
    id            uuid primary key default gen_random_uuid(),
    created_at    timestamptz not null default now(),
    status        text not null default 'sending',
    item_count    int  not null check (item_count between 1 and 10),
    completed_at  timestamptz
  )`,
  `create table if not exists upload_logs (
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
    error             text,
    sent_at           timestamptz,
    learned_at        timestamptz
  )`,
  `create index if not exists upload_logs_batch_idx   on upload_logs (batch_id)`,
  `create index if not exists upload_logs_created_idx on upload_logs (created_at desc)`,
  `create index if not exists upload_logs_folder_idx  on upload_logs (folder_id)`,
  `create unique index if not exists upload_logs_doc_uidx on upload_logs (cody_document_id) where cody_document_id is not null`,
  `alter table upload_logs add column if not exists deleted_at timestamptz`,
  // Audit trail of every action (server + client). Append-only.
  `create table if not exists activity_log (
    id             bigserial primary key,
    created_at     timestamptz not null default now(),
    action         text not null,
    source         text not null default 'server',
    file_name      text,
    folder_id      text,
    folder_name    text,
    upload_log_id  uuid,
    batch_id       uuid,
    detail         jsonb
  )`,
  `create index if not exists activity_log_created_idx on activity_log (created_at desc)`,
];
