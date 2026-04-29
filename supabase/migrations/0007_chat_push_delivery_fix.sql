-- Allow server actions to deliver chat pushes to the current user's thread
-- counterparts without exposing arbitrary subscriptions.

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
