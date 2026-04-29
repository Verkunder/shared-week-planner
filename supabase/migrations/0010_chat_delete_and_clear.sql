-- Message deletion and per-user dialog clearing.

alter table public.chat_thread_members
  add column if not exists cleared_at timestamptz not null default 'epoch';

alter table public.chat_messages
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

create index if not exists chat_messages_visible_idx
  on public.chat_messages(thread_id, created_at desc)
  where deleted_at is null;

drop policy if exists "chat_messages_update_own" on public.chat_messages;
create policy "chat_messages_update_own" on public.chat_messages
  for update
  using (sender_id = auth.uid() and public.user_is_thread_member(thread_id))
  with check (sender_id = auth.uid() and public.user_is_thread_member(thread_id));

create or replace function public.delete_chat_message(target_message_id uuid)
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

  update public.chat_messages
  set deleted_at = now(),
      deleted_by = uid
  where id = target_message_id
    and sender_id = uid
    and deleted_at is null;

  if not found then
    raise exception 'message not found or not owned';
  end if;
end;
$$;

revoke all on function public.delete_chat_message(uuid) from public;
grant execute on function public.delete_chat_message(uuid) to authenticated;

create or replace function public.clear_chat_thread(target_thread_id uuid)
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

  update public.chat_thread_members
  set cleared_at = now(),
      last_read_at = now()
  where thread_id = target_thread_id
    and user_id = uid;

  if not found then
    raise exception 'thread not found';
  end if;
end;
$$;

revoke all on function public.clear_chat_thread(uuid) from public;
grant execute on function public.clear_chat_thread(uuid) to authenticated;

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
    and cm.deleted_at is null
    and cm.created_at > ctm.last_read_at
    and cm.created_at > ctm.cleared_at
    and cm.expires_at > now();
$$;

revoke all on function public.chat_unread_count() from public;
grant execute on function public.chat_unread_count() to authenticated;
