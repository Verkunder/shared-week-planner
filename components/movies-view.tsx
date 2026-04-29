"use client";

import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  fetchMoviesByGenre,
  fetchMovieSearch,
  type GenreEntry,
  type MovieListItem,
  type MoviePage,
} from "@/app/(app)/movies/actions";
import { MovieDialog } from "@/components/movie-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { proxiedImageSrc } from "@/lib/image-proxy";

export type MoviesViewProfile = {
  id: string;
  name: string | null;
  avatar_url: string | null;
};

const SEARCH_DEBOUNCE_MS = 350;
const SEARCH_MIN_LENGTH = 2;

type GenreState = {
  genreId: string | null;
  movies: MovieListItem[];
  page: number;
  pages: number;
};

type SearchState = {
  query: string;
  movies: MovieListItem[];
  page: number;
  pages: number;
};

export function MoviesView({
  genres,
  initialGenreId,
  initialPage,
  profiles,
}: {
  genres: GenreEntry[];
  initialGenreId: string | null;
  initialPage: MoviePage;
  profiles: MoviesViewProfile[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMovie, setActiveMovie] = useState<MovieListItem | null>(null);
  const [rateLimit, setRateLimit] = useState(
    initialPage.error === "rate-limit",
  );

  const [genreState, setGenreState] = useState<GenreState>({
    genreId: initialGenreId,
    movies: initialPage.movies,
    page: initialPage.page,
    pages: initialPage.pages,
  });
  const [searchState, setSearchState] = useState<SearchState>({
    query: "",
    movies: [],
    page: 0,
    pages: 0,
  });

  const [searching, startSearch] = useTransition();
  const [genreLoading, startGenreLoad] = useTransition();
  const [genreLoadingMore, setGenreLoadingMore] = useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);

  const genreVersion = useRef(0);
  const searchVersion = useRef(0);

  const isSearching = searchQuery.trim().length >= SEARCH_MIN_LENGTH;

  const handleResult = useCallback((result: MoviePage) => {
    if (result.error === "rate-limit") setRateLimit(true);
  }, []);

  useEffect(() => {
    if (!isSearching) return;
    const handle = setTimeout(() => {
      const q = searchQuery.trim();
      const version = ++searchVersion.current;
      startSearch(async () => {
        const result = await fetchMovieSearch(q, 1);
        if (searchVersion.current !== version) return;
        handleResult(result);
        setSearchState({
          query: q,
          movies: result.movies,
          page: result.page,
          pages: result.pages,
        });
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchQuery, isSearching, handleResult]);

  function pickGenre(id: string) {
    setSearchQuery("");
    const version = ++genreVersion.current;
    setGenreState({ genreId: id, movies: [], page: 0, pages: 0 });
    startGenreLoad(async () => {
      const result = await fetchMoviesByGenre(id, 1);
      if (genreVersion.current !== version) return;
      handleResult(result);
      setGenreState({
        genreId: id,
        movies: result.movies,
        page: result.page,
        pages: result.pages,
      });
    });
  }

  function clearSearch() {
    setSearchQuery("");
  }

  const loadMoreGenre = useCallback(async () => {
    if (genreLoading || genreLoadingMore || rateLimit) return;
    if (
      genreState.genreId === null ||
      genreState.page === 0 ||
      genreState.page >= genreState.pages
    ) {
      return;
    }
    setGenreLoadingMore(true);
    const version = genreVersion.current;
    try {
      const result = await fetchMoviesByGenre(
        genreState.genreId,
        genreState.page + 1,
      );
      if (genreVersion.current !== version) return;
      handleResult(result);
      if (result.error) return;
      setGenreState((s) => ({
        ...s,
        movies: [...s.movies, ...result.movies],
        page: result.page,
        pages: result.pages,
      }));
    } finally {
      setGenreLoadingMore(false);
    }
  }, [genreState, genreLoading, genreLoadingMore, rateLimit, handleResult]);

  const loadMoreSearch = useCallback(async () => {
    if (searching || searchLoadingMore || rateLimit) return;
    if (
      searchState.query === "" ||
      searchState.page === 0 ||
      searchState.page >= searchState.pages
    ) {
      return;
    }
    setSearchLoadingMore(true);
    const version = searchVersion.current;
    try {
      const result = await fetchMovieSearch(
        searchState.query,
        searchState.page + 1,
      );
      if (searchVersion.current !== version) return;
      handleResult(result);
      if (result.error) return;
      setSearchState((s) => ({
        ...s,
        movies: [...s.movies, ...result.movies],
        page: result.page,
        pages: result.pages,
      }));
    } finally {
      setSearchLoadingMore(false);
    }
  }, [searchState, searching, searchLoadingMore, rateLimit, handleResult]);

  return (
    <>
      <div className="flex h-full flex-col md:flex-row">
        <aside className="flex shrink-0 flex-col gap-2 border-b border-border px-2 py-2 sm:px-4 md:w-60 md:gap-3 md:border-r md:border-b-0 md:py-4 md:overflow-y-auto">
          <div className="relative flex items-center">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск фильма…"
              className="pl-7 pr-7"
              type="search"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-1 grid size-6 place-items-center text-muted-foreground hover:text-foreground"
                aria-label="Очистить поиск"
              >
                <XIcon className="size-3.5" />
              </button>
            ) : null}
          </div>
          <div className={isSearching ? "hidden md:block" : ""}>
            <GenresFilter
              genres={genres}
              activeId={genreState.genreId}
              onPick={pickGenre}
              disabled={genreLoading}
            />
          </div>
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden">
          {rateLimit ? <RateLimitBanner /> : null}
          <ResultsPane
            hidden={isSearching}
            movies={genreState.movies}
            loading={genreLoading}
            loadingMore={genreLoadingMore}
            hasMore={genreState.page > 0 && genreState.page < genreState.pages}
            onLoadMore={loadMoreGenre}
            onPickMovie={setActiveMovie}
            emptyText="В этой категории фильмов нет."
          />
          <ResultsPane
            hidden={!isSearching}
            movies={searchState.movies}
            loading={searching}
            loadingMore={searchLoadingMore}
            hasMore={
              searchState.page > 0 && searchState.page < searchState.pages
            }
            onLoadMore={loadMoreSearch}
            onPickMovie={setActiveMovie}
            emptyText="Ничего не нашлось."
          />
        </div>
      </div>

      <MovieDialog
        movie={activeMovie}
        profiles={profiles}
        onClose={() => setActiveMovie(null)}
      />
    </>
  );
}

function RateLimitBanner() {
  return (
    <div
      role="alert"
      className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 sm:px-4 dark:text-amber-400"
    >
      Превышен дневной лимит Кинопоиска. Поиск и подгрузка фильмов будут
      доступны завтра.
    </div>
  );
}

function ResultsPane({
  hidden,
  movies,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  onPickMovie,
  emptyText,
}: {
  hidden: boolean;
  movies: MovieListItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onPickMovie: (m: MovieListItem) => void;
  emptyText: string;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (hidden || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hidden, hasMore, onLoadMore]);

  return (
    <div
      className={`flex-1 overflow-y-auto px-2 py-3 sm:px-4 ${
        hidden ? "hidden" : ""
      }`}
    >
      {loading && movies.length === 0 ? (
        <p className="text-xs text-muted-foreground">Загружаем…</p>
      ) : movies.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          <MovieGrid movies={movies} onPick={onPickMovie} />
          {hasMore ? (
            <div
              ref={sentinelRef}
              className="mt-4 grid h-8 place-items-center"
            >
              {loadingMore ? (
                <p className="text-xs text-muted-foreground">Загружаем…</p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function GenresFilter({
  genres,
  activeId,
  onPick,
  disabled,
}: {
  genres: GenreEntry[];
  activeId: string | null;
  onPick: (id: string) => void;
  disabled: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (el!.scrollWidth <= el!.clientWidth + 1) return;
      if (e.deltaY === 0) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      el!.scrollLeft += e.deltaY;
      e.preventDefault();
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || activeId === null) return;
    const idx = genres.findIndex((g) => g.id === activeId);
    const btn = el.children[idx] as HTMLElement | undefined;
    btn?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "smooth",
    });
  }, [activeId, genres]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex flex-row gap-1 overflow-x-auto md:flex-col md:overflow-x-visible md:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {genres.map((g) => (
          <Button
            key={g.id}
            size="xs"
            variant={activeId === g.id ? "secondary" : "outline"}
            onClick={() => onPick(g.id)}
            disabled={disabled}
            className="shrink-0 md:h-8 md:w-full md:justify-start md:gap-2 md:px-3 md:text-sm"
          >
            {g.name}
          </Button>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-linear-to-r from-background to-transparent md:hidden" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-linear-to-l from-background to-transparent md:hidden" />
    </div>
  );
}

function MovieGrid({
  movies,
  onPick,
}: {
  movies: MovieListItem[];
  onPick: (movie: MovieListItem) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 md:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] md:gap-4">
      {movies.map((m) => (
        <MovieGridCard key={m.id} movie={m} onPick={() => onPick(m)} />
      ))}
    </div>
  );
}

function MovieGridCard({
  movie,
  onPick,
}: {
  movie: MovieListItem;
  onPick: () => void;
}) {
  const poster = movie.poster_url;
  return (
    <button
      type="button"
      onClick={onPick}
      className="group flex flex-col gap-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-2/3 w-full overflow-hidden bg-muted ring-1 ring-foreground/10">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxiedImageSrc(poster)}
            alt={movie.title}
            className="size-full object-cover transition-transform group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="grid size-full place-items-center text-[10px] text-muted-foreground">
            Нет постера
          </div>
        )}
        {movie.vote_average ? (
          <span className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {movie.vote_average.toFixed(1)}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col px-0.5">
        <span className="line-clamp-2 text-xs font-medium">{movie.title}</span>
        {movie.release_year ? (
          <span className="text-[10px] text-muted-foreground">
            {movie.release_year}
          </span>
        ) : null}
      </div>
    </button>
  );
}
