-- Keep one live push endpoint per browser for a user and avoid duplicate sends.

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

  if sub_user_agent is not null then
    delete from public.push_subscriptions
    where user_id = uid
      and user_agent = sub_user_agent
      and endpoint <> sub_endpoint;
  end if;
end;
$$;

revoke all on function public.upsert_push_subscription(text, text, text, text) from public;
grant execute on function public.upsert_push_subscription(text, text, text, text) to authenticated;

create or replace function public.push_subscriptions_for_thread(target_thread_id uuid)
returns table (
  endpoint text,
  p256dh text,
  auth text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (ps.endpoint) ps.endpoint, ps.p256dh, ps.auth
  from public.push_subscriptions ps
  join public.chat_thread_members recipient
    on recipient.user_id = ps.user_id
   and recipient.thread_id = target_thread_id
  where ps.user_id <> auth.uid()
    and public.user_is_thread_member(target_thread_id)
  order by ps.endpoint, ps.created_at desc;
$$;

revoke all on function public.push_subscriptions_for_thread(uuid) from public;
grant execute on function public.push_subscriptions_for_thread(uuid) to authenticated;
