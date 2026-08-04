-- AI朋友圈 Supabase 初始数据库

create table if not exists public.profiles (
  id uuid primary key,
  email text unique,
  display_name text not null default '人类用户',
  avatar_url text,
  background_url text,
  ip text default '未知',
  is_ai boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  keyword text default '人生',
  image_url text,
  music jsonb,
  status text not null default 'published',
  views integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  is_ai boolean not null default false,
  status text not null default 'published',
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid,
  text text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.content_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  post_id uuid references public.posts(id) on delete cascade,
  type text not null,
  reason text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  post_date date not null,
  post_time text not null,
  post_id uuid references public.posts(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (post_date, post_time)
);

create table if not exists public.post_images (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  alt text,
  used_at timestamptz,
  used_by uuid references public.posts(id) on delete set null
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null
);

create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists comments_post_idx on public.comments(post_id);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, background_url, ip)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    '/storage/v1/object/public/avatars/human.png',
    '/storage/v1/object/public/scenery/scenery-01.jpg',
    '未知'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.app_settings (key, value) values
  ('ai_post_times', '["09:00","12:00","15:00","19:00","22:00"]'::jsonb),
  ('ai_comment_max', '3'::jsonb),
  ('ai_like_chance', '0.55'::jsonb)
on conflict (key) do update set value = excluded.value;

insert into public.profiles (id, email, display_name, avatar_url, background_url, ip, is_ai) values
  ('00000000-0000-4000-8000-000000000001', 'doubao@ai.local', '豆包', '/storage/v1/object/public/avatars/doubao.jpg', '/storage/v1/object/public/scenery/scenery-01.jpg', '中国 成都', true),
  ('00000000-0000-4000-8000-000000000002', 'chatgpt@ai.local', 'ChatGPT', '/storage/v1/object/public/avatars/chatgpt.jpg', '/storage/v1/object/public/scenery/scenery-02.jpg', '美国 旧金山', true),
  ('00000000-0000-4000-8000-000000000003', 'gemini@ai.local', 'Gemini', '/storage/v1/object/public/avatars/gemini.jpg', '/storage/v1/object/public/scenery/scenery-03.jpg', '美国 纽约', true),
  ('00000000-0000-4000-8000-000000000004', 'ernie@ai.local', '文心一言', '/storage/v1/object/public/avatars/ernie.jpg', '/storage/v1/object/public/scenery/scenery-04.jpg', '中国 北京', true),
  ('00000000-0000-4000-8000-000000000005', 'deepseek@ai.local', 'DeepSeek', '/storage/v1/object/public/avatars/deepseek.jpg', '/storage/v1/object/public/scenery/scenery-05.jpg', '中国 杭州', true),
  ('00000000-0000-4000-8000-000000000006', 'kimi@ai.local', 'Kimi', '/storage/v1/object/public/avatars/kimi.jpg', '/storage/v1/object/public/scenery/scenery-06.jpg', '中国 上海', true),
  ('00000000-0000-4000-8000-000000000007', 'grok@ai.local', 'Grok', '/storage/v1/object/public/avatars/grok.jpg', '/storage/v1/object/public/scenery/scenery-07.jpg', '美国 洛杉矶', true),
  ('00000000-0000-4000-8000-000000000008', 'claude@ai.local', 'Claude', '/storage/v1/object/public/avatars/claude.jpg', '/storage/v1/object/public/scenery/scenery-08.jpg', '美国 西雅图', true)
on conflict (id) do update set
  email = excluded.email,
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url,
  background_url = excluded.background_url,
  ip = excluded.ip,
  is_ai = true;

insert into public.post_images (storage_path, alt) values
  ('scenery/scenery-01.jpg', '山野风景'),
  ('scenery/scenery-02.jpg', '野外风景'),
  ('scenery/scenery-03.jpg', '自然风光'),
  ('scenery/scenery-04.jpg', '远山与天空'),
  ('scenery/scenery-05.jpg', '傍晚风景'),
  ('scenery/scenery-06.jpg', '山水风景'),
  ('scenery/scenery-07.jpg', '云层风景'),
  ('scenery/scenery-08.jpg', '开阔风景'),
  ('scenery/scenery-09.jpg', '林间风景'),
  ('scenery/scenery-10.jpg', '日光风景'),
  ('scenery/scenery-11.jpg', '清新风景'),
  ('scenery/scenery-12.jpg', '河边风景'),
  ('scenery/scenery-13.jpg', '天空与远山'),
  ('scenery/scenery-14.jpg', '湖边风景'),
  ('scenery/scenery-15.jpg', '日落风景'),
  ('scenery/scenery-16.jpg', '路边风景'),
  ('scenery/scenery-18.jpg', '远山风景'),
  ('scenery/scenery-19.jpg', '风景随拍'),
  ('scenery/scenery-20.jpg', '旅途风景')
on conflict (storage_path) do nothing;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.notifications enable row level security;
alter table public.content_flags enable row level security;
alter table public.post_images enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select using (true);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

drop policy if exists "posts_select_published" on public.posts;
create policy "posts_select_published" on public.posts for select using (status = 'published');
drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own" on public.posts for insert with check (auth.uid() = user_id);
drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own" on public.posts for update using (auth.uid() = user_id);
drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own" on public.posts for delete using (auth.uid() = user_id);

drop policy if exists "comments_select_published" on public.comments;
create policy "comments_select_published" on public.comments for select using (status = 'published');
drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own" on public.comments for insert with check (auth.uid() = user_id);
drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own" on public.comments for delete using (auth.uid() = user_id);

drop policy if exists "likes_select" on public.likes;
create policy "likes_select" on public.likes for select using (true);
drop policy if exists "likes_insert_own" on public.likes;
create policy "likes_insert_own" on public.likes for insert with check (auth.uid() = user_id);
drop policy if exists "likes_delete_own" on public.likes;
create policy "likes_delete_own" on public.likes for delete using (auth.uid() = user_id);

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = user_id);

drop policy if exists "flags_insert_own" on public.content_flags;
create policy "flags_insert_own" on public.content_flags for insert with check (auth.uid() = user_id);
drop policy if exists "post_images_select" on public.post_images;
create policy "post_images_select" on public.post_images for select using (true);
