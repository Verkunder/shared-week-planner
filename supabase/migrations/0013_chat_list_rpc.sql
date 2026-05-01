-- Server-side chat list aggregation.

create or replace function public.chat_list_for_user()
returns table (
  user_id uuid,
  name text,
  avatar_url text,
  last_from_self boolean,
  last_text text,
  last_has_image boolean,
  last_sticker_emoji text,
  last_created_at timestamptz,
  unread_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with my_memberships as (
    select thread_id, last_read_at, cleared_at
    from public.chat_thread_members
    where user_id = auth.uid()
  ),
  counterparts as (
    select m.thread_id, m.last_read_at, m.cleared_at, other.user_id
    from my_memberships m
    join public.chat_thread_members other on other.thread_id = m.thread_id
    where other.user_id <> auth.uid()
  )
  select
    p.id as user_id,
    p.name,
    p.avatar_url,
    case when last_msg.id is null then null else last_msg.sender_id = auth.uid() end as last_from_self,
    last_msg.text as last_text,
    coalesce(last_msg.attachments @> '[{"type":"image"}]'::jsonb, false) as last_has_image,
    sticker.value->>'emoji' as last_sticker_emoji,
    last_msg.created_at as last_created_at,
    coalesce(unread.count, 0)::integer as unread_count
  from public.profiles p
  left join counterparts c on c.user_id = p.id
  left join lateral (
    select cm.id, cm.sender_id, cm.text, cm.created_at, cm.attachments
    from public.chat_messages cm
    where cm.thread_id = c.thread_id
      and cm.deleted_at is null
      and cm.created_at > c.cleared_at
      and cm.expires_at > now()
    order by cm.created_at desc
    limit 1
  ) last_msg on true
  left join lateral (
    select a.value
    from jsonb_array_elements(coalesce(last_msg.attachments, '[]'::jsonb)) a(value)
    where a.value->>'type' = 'sticker'
    limit 1
  ) sticker on true
  left join lateral (
    select count(*) as count
    from public.chat_messages cm
    where cm.thread_id = c.thread_id
      and cm.sender_id <> auth.uid()
      and cm.deleted_at is null
      and cm.created_at > c.last_read_at
      and cm.created_at > c.cleared_at
      and cm.expires_at > now()
  ) unread on true
  where p.id <> auth.uid()
  order by last_msg.created_at desc nulls last, p.name asc nulls last;
$$;

revoke all on function public.chat_list_for_user() from public;
grant execute on function public.chat_list_for_user() to authenticated;
