# Supabase（AskBible App + Web 直连）

App 与网页共用同一套：Auth、`member_reading_sync_documents`、`feedback_submissions`、`content_corrections`、Edge Function `delete-account`。

## 一次性 SQL

在 Supabase Dashboard → SQL Editor 执行：

`supabase/migrations/20260812_app_direct_sync_feedback.sql`

## 删号 Edge Function

```bash
supabase functions deploy delete-account
```

App / Web 均调用：`DELETE {SUPABASE_URL}/functions/v1/delete-account` + Bearer access token。

## 环境变量

网页需要：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

App 需要对应的 `EXPO_PUBLIC_SUPABASE_*`。
