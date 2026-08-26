-- AskBible App 直连：读经同步 RLS + 反馈/纠错表
-- 在 Supabase SQL Editor 执行本文件（或 supabase db push）。

-- 1) 读经同步：用户只能读写自己的行
alter table if exists public.member_reading_sync_documents enable row level security;

drop policy if exists "member_reading_sync_select_own" on public.member_reading_sync_documents;
create policy "member_reading_sync_select_own"
  on public.member_reading_sync_documents
  for select
  to authenticated
  using (user_id::text = auth.uid()::text);

drop policy if exists "member_reading_sync_insert_own" on public.member_reading_sync_documents;
create policy "member_reading_sync_insert_own"
  on public.member_reading_sync_documents
  for insert
  to authenticated
  with check (user_id::text = auth.uid()::text);

drop policy if exists "member_reading_sync_update_own" on public.member_reading_sync_documents;
create policy "member_reading_sync_update_own"
  on public.member_reading_sync_documents
  for update
  to authenticated
  using (user_id::text = auth.uid()::text)
  with check (user_id::text = auth.uid()::text);

drop policy if exists "member_reading_sync_delete_own" on public.member_reading_sync_documents;
create policy "member_reading_sync_delete_own"
  on public.member_reading_sync_documents
  for delete
  to authenticated
  using (user_id::text = auth.uid()::text);

-- 若 user_id 已是 uuid 类型，上面 or 条件仍可用；建议统一为 uuid：
-- alter table public.member_reading_sync_documents
--   alter column user_id type uuid using user_id::uuid;

-- 2) 反馈（仅允许 insert；后台用 service role 读）
create table if not exists public.feedback_submissions (
  id text primary key,
  created_at timestamptz not null default now(),
  type text not null,
  message text not null,
  email text,
  page text,
  locale text
);

alter table public.feedback_submissions enable row level security;

drop policy if exists "feedback_insert_anyone" on public.feedback_submissions;
create policy "feedback_insert_anyone"
  on public.feedback_submissions
  for insert
  to anon, authenticated
  with check (true);

-- 3) 内容纠错（仅允许 insert）
create table if not exists public.content_corrections (
  id text primary key,
  created_at timestamptz not null default now(),
  scope text not null,
  message text not null,
  email text,
  locale text,
  article_slug text,
  article_title text,
  book_id text,
  chapter int,
  role_id text,
  role_label text,
  published_at text,
  platform text,
  app_version text
);

alter table public.content_corrections enable row level security;

drop policy if exists "content_corrections_insert_anyone" on public.content_corrections;
create policy "content_corrections_insert_anyone"
  on public.content_corrections
  for insert
  to anon, authenticated
  with check (true);
