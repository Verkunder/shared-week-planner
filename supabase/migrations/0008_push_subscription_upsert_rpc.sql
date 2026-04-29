-- Rebind a browser push endpoint to the currently signed-in user.
-- This keeps local testing with multiple accounts in the same browser working.

create or replace function public.upsert_push_subscription(
  sub_endpoint text,
  sub_p256dh text,
  sub_auth text,
  sub_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if sub_endpoint is null or sub_endpoint = ''
    or sub_p256dh is null or sub_p256dh = ''
    or sub_auth is null or sub_auth = '' then
    raise exception 'invalid subscription';
  end if;

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    user_agent
  )
  values (
    uid,
    sub_endpoint,
    sub_p256dh,
    sub_auth,
    sub_user_agent
  )
  on conflict (endpoint) do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent;
end;
$$;

revoke all on function public.upsert_push_subscription(text, text, text, text) from public;
grant execute on function public.upsert_push_subscription(text, text, text, text) to authenticated;
