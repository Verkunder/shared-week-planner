const KP_BASE = "https://api.kinopoisk.dev";

export type KpMovie = {
  id: number;
  name: string | null;
  alternativeName: string | null;
  enName: string | null;
  description: string | null;
  shortDescription: string | null;
  year: number | null;
  movieLength: number | null;
  rating: { kp?: number; imdb?: number; tmdb?: number } | null;
  poster: { url?: string; previewUrl?: string } | null;
  genres: { name: string }[] | null;
};

export type KpGenre = { name: string; slug?: string };

export type KpListResponse<T> = {
  docs: T[];
  total: number;
  limit: number;
  page: number;
  pages: number;
};

const SELECT_FIELDS = [
  "id",
  "name",
  "alternativeName",
  "enName",
  "description",
  "shortDescription",
  "year",
  "movieLength",
  "rating",
  "poster",
  "genres",
];

function key(): string {
  const k = process.env.KINOPOISK_API_KEY;
  if (!k) throw new Error("KINOPOISK_API_KEY is not set");
  return k;
}

async function kpFetch<T>(
  path: string,
  params: Array<[string, string | number]> = [],
  revalidate = 60 * 60,
): Promise<T> {
  const url = new URL(KP_BASE + path);
  for (const [k, v] of params) url.searchParams.append(k, String(v));

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "X-API-KEY": key(),
        Accept: "application/json",
      },
      next: { revalidate },
    });
  } catch (e) {
    const cause = (e as { cause?: unknown }).cause;
    const detail =
      cause instanceof Error
        ? `${cause.name}: ${cause.message}`
        : String(cause ?? (e as Error).message);
    throw new Error(`Kinopoisk fetch failed (${url.host}): ${detail}`);
  }
  if (!res.ok) {
    throw new Error(
      `Kinopoisk ${res.status}: ${await res.text().catch(() => "")}`,
    );
  }
  return res.json() as Promise<T>;
}

export async function getGenres(): Promise<KpGenre[]> {
  const data = await kpFetch<KpGenre[]>(
    "/v1/movie/possible-values-by-field",
    [["field", "genres.name"]],
    24 * 60 * 60,
  );
  return data
    .filter((g) => g.name && g.name.trim().length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

function emptyPage(): KpListResponse<KpMovie> {
  return { docs: [], total: 0, limit: 50, page: 0, pages: 0 };
}

export async function discoverByGenre(
  genreName: string,
  page = 1,
): Promise<KpListResponse<KpMovie>> {
  const params: Array<[string, string | number]> = [
    ["page", page],
    ["limit", 50],
    ["type", "movie"],
    ["type", "cartoon"],
    ["type", "anime"],
    ["sortField", "votes.kp"],
    ["sortType", "-1"],
    ["genres.name", genreName],
    ["votes.kp", "1000-9999999"],
  ];
  for (const f of SELECT_FIELDS) params.push(["selectFields", f]);

  return kpFetch<KpListResponse<KpMovie>>("/v1.4/movie", params);
}

export async function searchMovies(
  query: string,
  page = 1,
): Promise<KpListResponse<KpMovie>> {
  if (!query.trim()) return emptyPage();
  const params: Array<[string, string | number]> = [
    ["page", page],
    ["limit", 50],
    ["query", query.trim()],
  ];
  return kpFetch<KpListResponse<KpMovie>>(
    "/v1.4/movie/search",
    params,
    10 * 60,
  );
}

export async function getMovieDetails(id: number): Promise<KpMovie> {
  return kpFetch<KpMovie>(`/v1.4/movie/${id}`, [], 24 * 60 * 60);
}
