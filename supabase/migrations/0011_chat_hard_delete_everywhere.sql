-- Server-side destructive chat deletion for all participants.

alter table public.chat_thread_members
  add column if not exists cleared_at timestamptz not null default 'epoch';

alter table public.chat_messages
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

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

  delete from public.chat_messages cm
  where cm.id = target_message_id
    and public.user_is_thread_member(cm.thread_id);

  if not found then
    raise exception 'message not found';
  end if;
end;
$$;

revoke all on function public.delete_chat_message(uuid) from public;
grant execute on function public.delete_chat_message(uuid) to authenticated;

create or replace function public.delete_all_chat_messages(target_thread_id uuid)
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

  if not public.user_is_thread_member(target_thread_id) then
    raise exception 'thread not found';
  end if;

  delete from public.chat_messages
  where thread_id = target_thread_id;

  update public.chat_thread_members
  set last_read_at = now(),
      cleared_at = now()
  where thread_id = target_thread_id;
end;
$$;

revoke all on function public.delete_all_chat_messages(uuid) from public;
grant execute on function public.delete_all_chat_messages(uuid) to authenticated;

create or replace function public.delete_chat_thread_for_everyone(target_thread_id uuid)
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

  if not public.user_is_thread_member(target_thread_id) then
    raise exception 'thread not found';
  end if;

  delete from public.chat_threads
  where id = target_thread_id;
end;
$$;

revoke all on function public.delete_chat_thread_for_everyone(uuid) from public;
grant execute on function public.delete_chat_thread_for_everyone(uuid) to authenticated;
