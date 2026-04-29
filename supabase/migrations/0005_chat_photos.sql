-- Photo attachments for chat messages.
-- attachments shape: [{ type: "image", path: text, width?: int, height?: int }]
-- Files live in private bucket `chat-media`, organized as `{thread_id}/{uuid}.{ext}`.

alter table public.chat_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- Bucket: 10 MB limit, images only.
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'chat-media',
  'chat-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = excluded.public;

-- Storage RLS: thread membership controls both upload and download.
-- Path is `{thread_id}/{filename}`, so storage.foldername(name)[1] is the thread id.
drop policy if exists "chat_media_select" on storage.objects;
create policy "chat_media_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-media'
    and public.user_is_thread_member(
      nullif((storage.foldername(name))[1], '')::uuid
    )
  );

drop policy if exists "chat_media_insert" on storage.objects;
create policy "chat_media_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and public.user_is_thread_member(
      nullif((storage.foldername(name))[1], '')::uuid
    )
  );
