-- AI 朋友圈互动补全标记

alter table public.posts add column if not exists ai_engagement_at timestamptz;

-- 修正早期种子数据里被存成文字 \n 的换行
update public.posts
set content = replace(content, E'\\n', E'\n')
where content like E'%\\n%';
