"use server";

import { revalidatePath } from "next/cache";

import type { EventCategory } from "@/app/(app)/profile/actions";
import {
  discoverByGenre,
  getGenres,
  getMovieDetails,
  searchMovies,
  type KpMovie,
} from "@/lib/kinopoisk";
import {
  findCommonSlot,
  personalCategoryIds,
  type ParticipantSchedule,
} from "@/lib/movies/scheduler";
import { createClient } from "@/lib/supabase/server";

export type MovieListItem = {
  id: number;
  title: string;
  poster_url: string | null;
  overview: string;
  release_year: number | null;
  vote_average: number;
};

export type GenreEntry = { id: string; name: string };

export type MoviePageError = "rate-limit" | "unavailable";

export type MoviePage = {
  movies: MovieListItem[];
  page: number;
  pages: number;
  error?: MoviePageError;
};

export type FetchGenresResult = {
  genres: GenreEntry[];
  error?: MoviePageError;
};

function classifyKpError(e: unknown): MoviePageError {
  const msg = e instanceof Error ? e.message : String(e);
  if (/Kinopoisk\s+(403|429)\b/.test(msg)) return "rate-limit";
  return "unavailable";
}

const DEFAULT_RUNTIME_MINUTES = 120;
const SUGGEST_LOOKAHEAD_DAYS = 14;
const DEFAULT_PROPOSAL_HOUR = 20;

function pickTitle(m: KpMovie): string {
  return m.name || m.alternativeName || m.enName || "Без названия";
}

function toListItem(m: KpMovie): MovieListItem {
  return {
    id: m.id,
    title: pickTitle(m),
    poster_url: m.poster?.url ?? null,
    overview: m.description ?? m.shortDescription ?? "",
    release_year: m.year ?? null,
    vote_average: m.rating?.kp ?? 0,
  };
}

export async function fetchGenres(): Promise<FetchGenresResult> {
  try {
    const genres = await getGenres();
    return { genres: genres.map((g) => ({ id: g.name, name: g.name })) };
  } catch (e) {
    return { genres: [], error: classifyKpError(e) };
  }
}

export async function fetchMoviesByGenre(
  genreId: string,
  page = 1,
): Promise<MoviePage> {
  try {
    const data = await discoverByGenre(genreId, page);
    return {
      movies: data.docs.map(toListItem),
      page: data.page,
      pages: data.pages,
    };
  } catch (e) {
    return { movies: [], page: 0, pages: 0, error: classifyKpError(e) };
  }
}

export async function fetchMovieSearch(
  query: string,
  page = 1,
): Promise<MoviePage> {
  try {
    const data = await searchMovies(query, page);
    return {
      movies: data.docs.map(toListItem),
      page: data.page,
      pages: data.pages,
    };
  } catch (e) {
    return { movies: [], page: 0, pages: 0, error: classifyKpError(e) };
  }
}

type SuggestionSnapshot = {
  kp_id: number;
  title: string;
  poster_url: string | null;
  overview: string;
  runtime_minutes: number;
  release_year: number | null;
  vote_average: number;
};

async function buildSnapshot(kpId: number): Promise<SuggestionSnapshot> {
  const details = await getMovieDetails(kpId);
  return {
    kp_id: details.id,
    title: pickTitle(details),
    poster_url: details.poster?.url ?? null,
    overview: details.description ?? details.shortDescription ?? "",
    runtime_minutes: details.movieLength ?? DEFAULT_RUNTIME_MINUTES,
    release_year: details.year ?? null,
    vote_average: details.rating?.kp ?? 0,
  };
}

export type ProposedSlot = {
  starts_at: string;
  ends_at: string;
  fallback: boolean;
  runtime_minutes: number;
};

export async function suggestMovieSlot(
  kpId: number,
  recipientIds: string[],
): Promise<ProposedSlot> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован.");

  const details = await getMovieDetails(kpId);
  const runtime = details.movieLength ?? DEFAULT_RUNTIME_MINUTES;
  const allParticipants = Array.from(new Set([user.id, ...recipientIds]));

  const from = new Date();
  const to = new Date(
    from.getTime() + SUGGEST_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000,
  );

  const [{ data: profiles }, { data: events }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, event_categories")
      .in("id", allParticipants),
    supabase
      .from("events")
      .select("owner_id, starts_at, ends_at, category_id")
      .in("owner_id", allParticipants)
      .gte("ends_at", from.toISOString())
      .lte("starts_at", to.toISOString()),
  ]);

  const profileMap = new Map<string, EventCategory[]>();
  for (const p of profiles ?? []) {
    profileMap.set(p.id, (p.event_categories as EventCategory[] | null) ?? []);
  }

  const schedules: ParticipantSchedule[] = allParticipants.map((id) => ({
    userId: id,
    personalCategoryIds: personalCategoryIds(profileMap.get(id) ?? []),
    events: (events ?? [])
      .filter((e) => e.owner_id === id)
      .map((e) => ({
        starts_at: e.starts_at,
        ends_at: e.ends_at,
        category_id: e.category_id,
      })),
  }));

  const everyoneHasPersonal = schedules.every(
    (s) => s.personalCategoryIds.size > 0,
  );

  if (everyoneHasPersonal) {
    const slot = findCommonSlot(schedules, runtime, from, to);
    if (slot) {
      return {
        starts_at: slot.start.toISOString(),
        ends_at: slot.end.toISOString(),
        fallback: false,
        runtime_minutes: runtime,
      };
    }
  }

  const fallbackStart = new Date();
  fallbackStart.setDate(fallbackStart.getDate() + 1);
  fallbackStart.setHours(DEFAULT_PROPOSAL_HOUR, 0, 0, 0);
  const fallbackEnd = new Date(fallbackStart.getTime() + runtime * 60 * 1000);
  return {
    starts_at: fallbackStart.toISOString(),
    ends_at: fallbackEnd.toISOString(),
    fallback: true,
    runtime_minutes: runtime,
  };
}

export type ActionResult = { error?: string; id?: string } | undefined;

export async function scheduleMovieForSelf(
  kpId: number,
  startsAt: string,
  endsAt: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован." };

  if (new Date(startsAt) >= new Date(endsAt)) {
    return { error: "Окончание должно быть позже начала." };
  }

  const snapshot = await buildSnapshot(kpId);
  const { data, error } = await supabase
    .from("events")
    .insert({
      owner_id: user.id,
      title: `Кино: ${snapshot.title}`,
      description: snapshot.overview || null,
      starts_at: startsAt,
      ends_at: endsAt,
      all_day: false,
      color: "#a855f7",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/");
  return { id: data.id };
}

export async function proposeMovie(input: {
  kp_id: number;
  recipients: string[];
  starts_at: string;
  ends_at: string;
}): Promise<ActionResult> {
  if (input.recipients.length === 0) {
    return { error: "Выберите хотя бы одного получателя." };
  }
  if (new Date(input.starts_at) >= new Date(input.ends_at)) {
    return { error: "Окончание должно быть позже начала." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован." };

  if (input.recipients.includes(user.id)) {
    return { error: "Нельзя предложить фильм самому себе." };
  }

  const snapshot = await buildSnapshot(input.kp_id);

  const { data, error } = await supabase
    .from("movie_suggestions")
    .insert({
      from_user: user.id,
      recipients: input.recipients,
      kp_id: snapshot.kp_id,
      title: snapshot.title,
      poster_url: snapshot.poster_url,
      overview: snapshot.overview,
      runtime_minutes: snapshot.runtime_minutes,
      release_year: snapshot.release_year,
      vote_average: snapshot.vote_average,
      proposed_starts_at: input.starts_at,
      proposed_ends_at: input.ends_at,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/movies");
  return { id: data.id };
}

export async function respondToSuggestion(
  suggestionId: string,
  response: "accepted" | "declined",
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_movie_suggestion", {
    suggestion_id: suggestionId,
    response,
  });
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/movies");
  return undefined;
}

export async function cancelSuggestion(
  suggestionId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_movie_suggestion", {
    suggestion_id: suggestionId,
  });
  if (error) return { error: error.message };
  revalidatePath("/movies");
  return undefined;
}
