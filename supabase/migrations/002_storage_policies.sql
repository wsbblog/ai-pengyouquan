-- AI朋友圈 Storage 桶和权限

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('backgrounds', 'backgrounds', true),
  ('scenery', 'scenery', true),
  ('posts', 'posts', true)
on conflict (id) do update set public = true;

drop policy if exists "public_read_avatars" on storage.objects;
create policy "public_read_avatars" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "public_read_backgrounds" on storage.objects;
create policy "public_read_backgrounds" on storage.objects
  for select using (bucket_id = 'backgrounds');

drop policy if exists "public_read_scenery" on storage.objects;
create policy "public_read_scenery" on storage.objects
  for select using (bucket_id = 'scenery');

drop policy if exists "public_read_posts" on storage.objects;
create policy "public_read_posts" on storage.objects
  for select using (bucket_id = 'posts');

drop policy if exists "authenticated_upload_user_files" on storage.objects;
create policy "authenticated_upload_user_files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars', 'backgrounds', 'posts')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "authenticated_update_user_files" on storage.objects;
create policy "authenticated_update_user_files" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('avatars', 'backgrounds', 'posts')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "authenticated_delete_user_files" on storage.objects;
create policy "authenticated_delete_user_files" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('avatars', 'backgrounds', 'posts')
    and auth.uid()::text = (storage.foldername(name))[1]
  );
