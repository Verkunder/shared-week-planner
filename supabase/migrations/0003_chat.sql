-- Chat MVP: 1:1 threads with TTL on messages.
-- Threads are deduplicated per pair of users via dm_key (sorted user pair).
-- Messages live for 30 days (lazy filter via expires_at; cleanup via cron later).

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  dm_key text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_thread_members (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default 'epoch',
  joined_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index if not exists chat_thread_members_user_idx
  on public.chat_thread_members(user_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  text text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index if not exists chat_messages_thread_created_idx
  on public.chat_messages(thread_id, created_at desc);

create index if not exists chat_messages_expires_idx
  on public.chat_messages(expires_at);

alter table public.chat_threads enable row level security;
alter table public.chat_thread_members enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "chat_threads_select" on public.chat_threads;
create policy "chat_threads_select" on public.chat_threads
  for select
  using (
    exists (
      select 1 from public.chat_thread_members m
      where m.thread_id = chat_threads.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "chat_thread_members_select" on public.chat_thread_members;
create policy "chat_thread_members_select" on public.chat_thread_members
  for select
  using (
    user_id = auth.uid() or
    exists (
      select 1 from public.chat_thread_members me
      where me.thread_id = chat_thread_members.thread_id
        and me.user_id = auth.uid()
    )
  );

drop policy if exists "chat_thread_members_update_own" on public.chat_thread_members;
create policy "chat_thread_members_update_own" on public.chat_thread_members
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "chat_messages_select" on public.chat_messages;
create policy "chat_messages_select" on public.chat_messages
  for select
  using (
    exists (
      select 1 from public.chat_thread_members m
      where m.thread_id = chat_messages.thread_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "chat_messages_insert" on public.chat_messages;
create policy "chat_messages_insert" on public.chat_messages
  for insert
  with check (
    sender_id = auth.uid() and
    exists (
      select 1 from public.chat_thread_members m
      where m.thread_id = chat_messages.thread_id and m.user_id = auth.uid()
    )
  );

create or replace function public.get_or_create_dm_thread(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  k text;
  tid uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if other_user_id is null or other_user_id = uid then
    raise exception 'invalid recipient';
  end if;

  k := case
    when uid < other_user_id then uid::text || '_' || other_user_id::text
    else other_user_id::text || '_' || uid::text
  end;

  select id into tid from public.chat_threads where dm_key = k;

  if tid is null then
    insert into public.chat_threads (dm_key) values (k) returning id into tid;
    insert into public.chat_thread_members (thread_id, user_id) values
      (tid, uid),
      (tid, other_user_id);
  end if;

  return tid;
end;
$$;

revoke all on function public.get_or_create_dm_thread(uuid) from public;
grant execute on function public.get_or_create_dm_thread(uuid) to authenticated;

create or replace function public.chat_unread_count()
returns integer
language sql
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

alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.chat_thread_members;
