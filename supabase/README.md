# Supabase（AskBible App + Web 直连）

App 与网页共用同一套：Auth、`member_reading_sync_documents`、`feedback_submissions`、`content_corrections`、Edge Function `delete-account`。

## 迁移（推荐）

在 [Account Tokens](https://supabase.com/dashboard/account/tokens) 创建 `sbp_…` 令牌后：

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...
bash scripts/supabase-deploy.sh
```

或本机已登录 Supabase Dashboard 时，脚本会用 Management API 按顺序执行 `supabase/migrations/*.sql`，并部署 `delete-account`。

## 校验

```bash
npm run supabase:verify
```

## 手动 SQL（备选）

Dashboard → SQL Editor：按文件名时间顺序执行 `supabase/migrations/*.sql`。

## 删号 Edge Function

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...
npx supabase functions deploy delete-account --project-ref tgobadhdylarhssudplc
```

App / Web 均调用：`DELETE {SUPABASE_URL}/functions/v1/delete-account` + Bearer access token。

## 环境变量

网页需要：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

App 需要对应的 `EXPO_PUBLIC_SUPABASE_*`。
