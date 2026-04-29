-- Movie suggestions: a sender proposes a movie to one or more recipients.
-- When ALL recipients accept, an event is created in each participant's
-- calendar (sender + all recipients). If any recipient declines, the
-- suggestion moves to status='declined' and no events are created.
--
-- Time selection on the client side prefers slots that fall inside every
-- participant's "personal" event blocks (event_categories with is_personal=true)
-- so movie proposals don't land in working hours.

create table if not exists public.movie_suggestions (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  recipients uuid[] not null,
  tmdb_id integer not null,
  title text not null,
  poster_path text,
  overview text,
  runtime_minutes integer,
  release_year integer,
  vote_average numeric(3,1),
  proposed_starts_at timestamptz not null,
  proposed_ends_at timestamptz not null,
  responses jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists movie_suggestions_recipients_idx
  on public.movie_suggestions using gin (recipients);

create index if not exists movie_suggestions_from_user_idx
  on public.movie_suggestions (from_user);

alter table public.movie_suggestions enable row level security;

drop policy if exists "movie_suggestions_select" on public.movie_suggestions;
create policy "movie_suggestions_select" on public.movie_suggestions
  for select
  using (auth.uid() = from_user or auth.uid() = any(recipients));

drop policy if exists "movie_suggestions_insert" on public.movie_suggestions;
create policy "movie_suggestions_insert" on public.movie_suggestions
  for insert
  with check (auth.uid() = from_user);

drop policy if exists "movie_suggestions_delete" on public.movie_suggestions;
create policy "movie_suggestions_delete" on public.movie_suggestions
  for delete
  using (auth.uid() = from_user);

-- All response handling goes through respond_to_movie_suggestion(), so we do
-- not grant a bare UPDATE policy. Sender cancellation is also a function call.

create or replace function public.respond_to_movie_suggestion(
  suggestion_id uuid,
  response text
)
returns public.movie_suggestions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s public.movie_suggestions%rowtype;
  next_responses jsonb;
  all_responded boolean := true;
  any_declined boolean := false;
  rec uuid;
  participant uuid;
  movie_color constant text := '#a855f7';
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if response not in ('accepted', 'declined') then
    raise exception 'invalid response: %', response;
  end if;

  select * into s from public.movie_suggestions
    where id = suggestion_id
    for update;
  if not found then
    raise exception 'suggestion not found';
  end if;
  if s.status <> 'pending' then
    raise exception 'suggestion already %', s.status;
  end if;
  if not (uid = any(s.recipients)) then
    raise exception 'not a recipient of this suggestion';
  end if;

  next_responses := coalesce(s.responses, '{}'::jsonb)
    || jsonb_build_object(uid::text, response);

  foreach rec in array s.recipients loop
    if not (next_responses ? rec::text) then
      all_responded := false;
    elsif next_responses ->> rec::text = 'declined' then
      any_declined := true;
    end if;
  end loop;

  if any_declined then
    update public.movie_suggestions
       set responses = next_responses,
           status = 'declined'
     where id = suggestion_id
     returning * into s;
  elsif all_responded then
    foreach participant in array array_append(s.recipients, s.from_user) loop
      insert into public.events (
        owner_id, title, description, starts_at, ends_at, all_day, color
      ) values (
        participant,
        'Кино: ' || s.title,
        s.overview,
        s.proposed_starts_at,
        s.proposed_ends_at,
        false,
        movie_color
      );
    end loop;

    update public.movie_suggestions
       set responses = next_responses,
           status = 'accepted'
     where id = suggestion_id
     returning * into s;
  else
    update public.movie_suggestions
       set responses = next_responses
     where id = suggestion_id
     returning * into s;
  end if;

  return s;
end;
$$;

revoke all on function public.respond_to_movie_suggestion(uuid, text) from public;
grant execute on function public.respond_to_movie_suggestion(uuid, text) to authenticated;

create or replace function public.cancel_movie_suggestion(suggestion_id uuid)
returns public.movie_suggestions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s public.movie_suggestions%rowtype;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select * into s from public.movie_suggestions
    where id = suggestion_id
    for update;
  if not found then raise exception 'suggestion not found'; end if;
  if s.from_user <> uid then raise exception 'only sender can cancel'; end if;
  if s.status <> 'pending' then
    raise exception 'cannot cancel a % suggestion', s.status;
  end if;

  update public.movie_suggestions
     set status = 'cancelled'
   where id = suggestion_id
   returning * into s;

  return s;
end;
$$;

revoke all on function public.cancel_movie_suggestion(uuid) from public;
grant execute on function public.cancel_movie_suggestion(uuid) to authenticated;

-- Enable realtime for the suggestions table so the inbox updates instantly.
alter publication supabase_realtime add table public.movie_suggestions;
