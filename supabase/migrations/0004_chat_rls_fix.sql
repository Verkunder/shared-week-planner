-- Fix self-referencing RLS that triggered Postgres "infinite recursion in policy"
-- on chat_thread_members. Membership checks now go through a SECURITY DEFINER
-- helper that bypasses RLS internally.

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

drop policy if exists "chat_threads_select" on public.chat_threads;
create policy "chat_threads_select" on public.chat_threads
  for select
  using (public.user_is_thread_member(id));

drop policy if exists "chat_thread_members_select" on public.chat_thread_members;
create policy "chat_thread_members_select" on public.chat_thread_members
  for select
  using (
    user_id = auth.uid() or public.user_is_thread_member(thread_id)
  );

drop policy if exists "chat_messages_select" on public.chat_messages;
create policy "chat_messages_select" on public.chat_messages
  for select
  using (public.user_is_thread_member(thread_id));

drop policy if exists "chat_messages_insert" on public.chat_messages;
create policy "chat_messages_insert" on public.chat_messages
  for insert
  with check (
    sender_id = auth.uid() and public.user_is_thread_member(thread_id)
  );
