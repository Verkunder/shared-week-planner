"use client";

import {
  CheckIcon,
  FilmReelIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { respondToSuggestion } from "@/app/(app)/movies/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/user";

export type IncomingSuggestion = {
  id: string;
  from_user: string;
  from_name: string | null;
  from_avatar_url: string | null;
  title: string;
  poster_url: string | null;
  overview: string | null;
  proposed_starts_at: string;
  proposed_ends_at: string;
  release_year: number | null;
  vote_average: number | null;
  runtime_minutes: number | null;
};

export function MovieInbox({
  incoming,
}: {
  incoming: IncomingSuggestion[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("movie-suggestions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "movie_suggestions" },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const count = incoming.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:size-9"
        aria-label={`Предложения фильмов${count ? ` (${count})` : ""}`}
      >
        <FilmReelIcon className="size-4 md:size-5" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-background">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Предложения фильмов</DialogTitle>
            <DialogDescription>
              {count > 0
                ? "Согласитесь, чтобы добавить событие в общий календарь."
                : "Пока ничего нового."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto">
            {incoming.map((s) => (
              <SuggestionRow key={s.id} suggestion={s} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SuggestionRow({ suggestion }: { suggestion: IncomingSuggestion }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const poster = suggestion.poster_url;
  const senderName = suggestion.from_name ?? "—";

  function respond(value: "accepted" | "declined") {
    setError(undefined);
    startTransition(async () => {
      const result = await respondToSuggestion(suggestion.id, value);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex gap-2 border border-border p-2">
      <div className="shrink-0">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt=""
            className="h-24 w-16 object-cover ring-1 ring-foreground/10"
          />
        ) : (
          <div className="grid h-24 w-16 place-items-center bg-muted text-[10px] text-muted-foreground">
            Нет постера
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <Avatar size="sm">
            {suggestion.from_avatar_url ? (
              <AvatarImage src={suggestion.from_avatar_url} alt="" />
            ) : null}
            <AvatarFallback>{initials(senderName)}</AvatarFallback>
          </Avatar>
          <span className="text-[11px] text-muted-foreground">
            {senderName} предлагает
          </span>
        </div>
        <div className="flex flex-col">
          <span className="truncate text-xs font-medium">
            {suggestion.title}
            {suggestion.release_year ? ` (${suggestion.release_year})` : ""}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatRange(suggestion.proposed_starts_at, suggestion.proposed_ends_at)}
          </span>
        </div>
        {suggestion.overview ? (
          <p className="line-clamp-3 text-[11px] text-muted-foreground/80">
            {suggestion.overview}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-[11px] text-destructive">
            {error}
          </p>
        ) : null}
        <div className="mt-1 flex gap-1.5">
          <Button
            type="button"
            size="xs"
            onClick={() => respond("accepted")}
            disabled={pending}
          >
            <CheckIcon /> Принять
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => respond("declined")}
            disabled={pending}
          >
            <XIcon /> Отказать
          </Button>
        </div>
      </div>
    </div>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatRange(startsIso: string, endsIso: string): string {
  const s = new Date(startsIso);
  const e = new Date(endsIso);
  const date = new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(s);
  return `${date}, ${pad(s.getHours())}:${pad(s.getMinutes())} — ${pad(e.getHours())}:${pad(e.getMinutes())}`;
}
