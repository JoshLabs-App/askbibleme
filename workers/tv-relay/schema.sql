-- AskBible Cloudflare D1 统一底座（参考 JoshBox SyncWorker 架构优化）
-- 覆盖：Resend 邮箱验证码登录、Apple/Google 身份兼容、多设备会话（含电视 platform='tv'）、
--       读经进度同步（支持老用户从 Supabase 懒迁移）、用户反馈与内容纠错。

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  locale TEXT NOT NULL DEFAULT 'zh-CN',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_identities (
  provider TEXT NOT NULL,
  provider_sub TEXT NOT NULL,
  user_id TEXT NOT NULL,
  email TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (provider, provider_sub),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_identities_user ON user_identities(user_id);

CREATE TABLE IF NOT EXISTS otp_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios', -- 'ios' | 'android' | 'web' | 'tv'
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS reading_sync_documents (
  user_id TEXT PRIMARY KEY,
  revision TEXT NOT NULL,
  blobs_json TEXT NOT NULL DEFAULT '{}',
  migrated_from_supabase INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feedback_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT,
  message TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'web',
  app_version TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS content_corrections (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  ref_key TEXT NOT NULL,
  detail TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'zh-CN',
  created_at INTEGER NOT NULL
);
