import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { fetchGenres, fetchMoviesByGenre } from "@/app/(app)/movies/actions";
import { MoviesView } from "@/components/movies-view";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Фильмы",
};

export default async function MoviesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { genres, error: genresError } = await fetchGenres();
  const initialGenreId = genres[0]?.id ?? null;
  const initialPage = initialGenreId
    ? await fetchMoviesByGenre(initialGenreId)
    : { movies: [], page: 0, pages: 0, error: genresError };

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, avatar_url")
    .neq("id", user.id);

  return (
    <MoviesView
      genres={genres}
      initialGenreId={initialGenreId}
      initialPage={initialPage}
      profiles={profiles ?? []}
    />
  );
}
