-- Switch movie data source from TMDB to kinopoisk.dev.
-- Column types are unchanged; only the names reflect the new source.
-- poster_path used to hold a relative TMDB path; kp poster.url is a full URL.

alter table public.movie_suggestions rename column tmdb_id to kp_id;
alter table public.movie_suggestions rename column poster_path to poster_url;
