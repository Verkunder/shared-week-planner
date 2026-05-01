import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { fetchGenres, fetchMoviesByGenre } from "@/app/(app)/movies/actions";
import { MoviesView } from "@/components/movies-view";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Фильмы",
};

export default async function MoviesPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [genresResult, { data: profiles }] = await Promise.all([
    fetchGenres(),
    supabase.from("profiles").select("id, name, avatar_url").neq("id", user.id),
  ]);

  const { genres, error: genresError } = genresResult;
  const initialGenreId = genres[0]?.id ?? null;
  const initialPage = initialGenreId
    ? await fetchMoviesByGenre(initialGenreId)
    : { movies: [], page: 0, pages: 0, error: genresError };

  return (
    <MoviesView
      genres={genres}
      initialGenreId={initialGenreId}
      initialPage={initialPage}
      profiles={profiles ?? []}
    />
  );
}
