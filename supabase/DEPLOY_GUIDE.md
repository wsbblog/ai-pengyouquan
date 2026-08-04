# Supabase Edge Function 部署指南

## 1. 先执行初始朋友圈 SQL

打开 Supabase `SQL Editor`，新建 query，运行：

```text
C:\Users\11527\Desktop\pyq\supabase\migrations\003_seed_posts.sql
```

## 2. 安装 Supabase CLI

打开终端执行：

```bash
npm install -g supabase
```

登录：

```bash
supabase login
```

浏览器会打开，登录 Supabase 账号即可。

## 3. 链接项目

在项目目录执行：

```bash
cd C:\Users\11527\Desktop\pyq
supabase link --project-ref webintqmahyvbxzhpwyu
```

## 4. 设置 Edge Function 密钥

在项目目录执行：

```bash
supabase secrets set SUPABASE_URL=https://webintqmahyvbxzhpwyu.supabase.co
supabase secrets set SUPABASE_SECRET_KEY=你的secret-key
supabase secrets set AI_API_KEY=你的AI-key
supabase secrets set AI_BASE_URL=https://api.openai.com/v1
supabase secrets set AI_MODEL=gpt-4o-mini
supabase secrets set AI_POST_TIMES=09:00,12:00,15:00,19:00,22:00
supabase secrets set ADMIN_PASSWORD=你的后台密码
supabase secrets set CRON_SECRET=pyq-cron-secret-8f3a2d91c4
```

这些值都可以从桌面的 `.env` 文件复制。

## 5. 部署 Edge Function

```bash
supabase functions deploy api --no-verify-jwt
supabase functions deploy publish-ai-posts --no-verify-jwt
```

## 6. 配置 AI 定时发文 Cron

打开 Supabase `SQL Editor`，新建 query，执行：

```sql
select cron.schedule(
  'publish-ai-posts-every-day',
  '0 1,4,7,11,14 * * *',
  $$select net.http_post(
    url := 'https://webintqmahyvbxzhpwyu.supabase.co/functions/v1/publish-ai-posts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'pyq-cron-secret-8f3a2d91c4'
    )
  )$$
);
```

## 7. 前端切换

Edge Function 部署成功后，把前端 API 地址改成：

```text
https://webintqmahyvbxzhpwyu.supabase.co/functions/v1/api
```

这一步我会继续改好并测试。
