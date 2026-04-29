<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Movies feature

Data source is `kinopoisk.dev` (not TMDB — TMDB is blocked from Russian networks). Auth: `KINOPOISK_API_KEY` from `@kinopoiskdev_bot`. Free tier ~200 req/day; 403/429 are caught and surfaced via `MoviePage.error = "rate-limit"` plus a banner, not thrown.

KP quirks worth remembering:
- `selectFields` accepts only top-level keys (`rating`, `poster`, `genres`) — no dotted paths.
- Genres are filtered by name string (`genres.name=драма`); there are no numeric genre IDs, so `GenreEntry.id === GenreEntry.name`.
- Posters come as full URLs (`poster.url`); no `posterUrl()` helper, render the URL directly.
- Discover filters by `type=movie|cartoon|anime` so the "аниме" and "мультфильм" genres aren't empty.

## Supabase migrations

Files in `supabase/migrations/` aren't auto-applied. Run them manually in Supabase Studio SQL Editor (or via `supabase db push` if the CLI is set up) before relying on schema changes locally.
