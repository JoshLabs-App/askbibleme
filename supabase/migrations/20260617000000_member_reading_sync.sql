-- 会员读经进度同步（App / Web 共用；仅 service role 读写）

create table if not exists public.member_reading_sync_documents (
  user_id text primary key,
  schema_version integer not null default 1,
  revision text not null,
  updated_at timestamptz not null default now(),
  blobs jsonb not null default '{}'::jsonb
);

create index if not exists member_reading_sync_documents_updated_at_idx
  on public.member_reading_sync_documents (updated_at desc);

alter table public.member_reading_sync_documents enable row level security;
