-- Idempotent repair for chat unread counters and message push delivery.
-- Safe to run even if earlier chat/push migrations were already applied.

create or replace function public.user_is_thread_member(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_thread_members
    where thread_id = tid and user_id = auth.uid()
  );
$$;

revoke all on function public.user_is_thread_member(uuid) from public;
grant execute on function public.user_is_thread_member(uuid) to authenticated;

create or replace function public.chat_unread_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count(*), 0)::integer
  from public.chat_messages cm
  join public.chat_thread_members ctm on ctm.thread_id = cm.thread_id
  where ctm.user_id = auth.uid()
    and cm.sender_id <> auth.uid()
    and cm.created_at > ctm.last_read_at
    and cm.expires_at > now();
$$;

revoke all on function public.chat_unread_count() from public;
grant execute on function public.chat_unread_count() to authenticated;

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

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
  select ps.endpoint, ps.p256dh, ps.auth
  from public.push_subscriptions ps
  join public.chat_thread_members recipient
    on recipient.user_id = ps.user_id
   and recipient.thread_id = target_thread_id
  where ps.user_id <> auth.uid()
    and public.user_is_thread_member(target_thread_id);
$$;

revoke all on function public.push_subscriptions_for_thread(uuid) from public;
grant execute on function public.push_subscriptions_for_thread(uuid) to authenticated;

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

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chat_thread_members;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
