-- 产品使用统计：匿名设备事件（仅服务端 service role 写入）

create table if not exists public.telemetry_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique,
  device_id uuid not null,
  platform text not null check (platform in ('web', 'ios', 'android')),
  event_name text not null,
  occurred_at timestamptz not null,
  properties jsonb not null default '{}'::jsonb,
  app_version text,
  locale text,
  ingested_at timestamptz not null default now()
);

create index if not exists telemetry_events_occurred_at_idx
  on public.telemetry_events (occurred_at desc);

create index if not exists telemetry_events_name_time_idx
  on public.telemetry_events (event_name, occurred_at desc);

create index if not exists telemetry_events_device_day_idx
  on public.telemetry_events (device_id, occurred_at desc);

-- 按日去重设备（DAU）
create table if not exists public.telemetry_daily_devices (
  day date not null,
  device_id uuid not null,
  platform text not null check (platform in ('web', 'ios', 'android')),
  primary key (day, device_id)
);

create index if not exists telemetry_daily_devices_day_idx
  on public.telemetry_daily_devices (day desc);

-- 按日预聚合（屏幕 / 点击 / 场景等）
create table if not exists public.telemetry_daily_rollups (
  day date not null,
  platform text check (platform is null or platform in ('web', 'ios', 'android')),
  metric_key text not null,
  metric_value text not null,
  event_count bigint not null default 0,
  sum_duration_ms bigint not null default 0,
  primary key (day, platform, metric_key, metric_value)
);

create index if not exists telemetry_daily_rollups_day_key_idx
  on public.telemetry_daily_rollups (day desc, metric_key);

alter table public.telemetry_events enable row level security;
alter table public.telemetry_daily_devices enable row level security;
alter table public.telemetry_daily_rollups enable row level security;
