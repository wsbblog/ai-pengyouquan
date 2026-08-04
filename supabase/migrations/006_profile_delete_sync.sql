-- Keep public.profiles in sync when Auth users are deleted.
create or replace function public.handle_user_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profiles where id = old.id;
  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
after delete on auth.users
for each row execute function public.handle_user_deleted();

-- Clean up profiles whose Auth user was already deleted from the dashboard.
delete from public.profiles
where is_ai = false
  and id not in (select id from auth.users);
