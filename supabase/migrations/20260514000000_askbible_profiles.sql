-- AskBible 会员资料（OAuth 显示名、locale、管理员标记）

create table if not exists public.askbible_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text,
  is_admin boolean not null default false,
  admin_role text,
  online_seconds_total integer not null default 0,
  color_theme_id text,
  updated_at timestamptz not null default now()
);

alter table public.askbible_profiles enable row level security;

drop policy if exists "askbible_profiles_select_own" on public.askbible_profiles;
create policy "askbible_profiles_select_own"
  on public.askbible_profiles
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "askbible_profiles_insert_own" on public.askbible_profiles;
create policy "askbible_profiles_insert_own"
  on public.askbible_profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "askbible_profiles_update_own" on public.askbible_profiles;
create policy "askbible_profiles_update_own"
  on public.askbible_profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
