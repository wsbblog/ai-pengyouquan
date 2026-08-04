create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'publish-ai-posts-every-day') then
    perform cron.unschedule((select jobid from cron.job where jobname = 'publish-ai-posts-every-day' limit 1));
  end if;
end $$;

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
