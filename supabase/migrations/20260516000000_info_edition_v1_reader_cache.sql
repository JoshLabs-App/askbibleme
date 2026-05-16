-- 读经页 V1 信息版：按需生成缓存（生产环境由 API 写入）
create table if not exists public.info_edition_v1_reader_cache (
  chapter_key text primary key,
  book_id text not null,
  chapter integer not null check (chapter >= 1),
  status text not null check (status in ('ready', 'pending', 'failed')),
  role_id text,
  role_label text,
  profile_id text,
  profile_name text,
  markdown text,
  char_count integer,
  published_at timestamptz,
  error text,
  started_at timestamptz,
  failed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists info_edition_v1_reader_cache_book_chapter_idx
  on public.info_edition_v1_reader_cache (book_id, chapter);

alter table public.info_edition_v1_reader_cache enable row level security;
