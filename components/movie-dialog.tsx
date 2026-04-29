"use client";

import { CalendarPlusIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { useEffect, useState, useTransition } from "react";

import {
  proposeMovie,
  scheduleMovieForSelf,
  suggestMovieSlot,
  type MovieListItem,
  type ProposedSlot,
} from "@/app/(app)/movies/actions";
import type { MoviesViewProfile } from "@/components/movies-view";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initials } from "@/lib/user";

type Mode = "view" | "self" | "propose";

export function MovieDialog({
  movie,
  profiles,
  onClose,
}: {
  movie: MovieListItem | null;
  profiles: MoviesViewProfile[];
  onClose: () => void;
}) {
  return (
    <Dialog
      open={movie !== null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {movie ? (
          <MovieDialogBody
            key={movie.id}
            movie={movie}
            profiles={profiles}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MovieDialogBody({
  movie,
  profiles,
  onClose,
}: {
  movie: MovieListItem;
  profiles: MoviesViewProfile[];
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>("view");
  const [recipients, setRecipients] = useState<Set<string>>(new Set());
  const [slot, setSlot] = useState<ProposedSlot | null>(null);
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();

  const poster = movie.poster_url;

  useEffect(() => {
    if (mode === "view") return;
    const recipientIds = mode === "propose" ? Array.from(recipients) : [];
    if (mode === "propose" && recipientIds.length === 0) return;
    let active = true;
    suggestMovieSlot(movie.id, recipientIds)
      .then((s) => {
        if (!active) return;
        setSlot(s);
        setStartInput(formatLocal(s.starts_at));
        setEndInput(formatLocal(s.ends_at));
        setError(undefined);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Не удалось подобрать время.");
      });
    return () => {
      active = false;
    };
  }, [mode, recipients, movie.id]);

  function toggleRecipient(id: string) {
    setRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelfSchedule() {
    setError(undefined);
    const startsIso = parseLocal(startInput);
    const endsIso = parseLocal(endInput);
    startTransition(async () => {
      const result = await scheduleMovieForSelf(movie.id, startsIso, endsIso);
      if (result?.error) setError(result.error);
      else {
        setDone("Добавлено в ваш календарь.");
        setTimeout(onClose, 700);
      }
    });
  }

  function handlePropose() {
    setError(undefined);
    if (recipients.size === 0) {
      setError("Выберите получателей.");
      return;
    }
    const startsIso = parseLocal(startInput);
    const endsIso = parseLocal(endInput);
    startTransition(async () => {
      const result = await proposeMovie({
        kp_id: movie.id,
        recipients: Array.from(recipients),
        starts_at: startsIso,
        ends_at: endsIso,
      });
      if (result?.error) setError(result.error);
      else {
        setDone("Предложение отправлено. Ждём ответы.");
        setTimeout(onClose, 900);
      }
    });
  }

  return (
    <div className="grid gap-3">
      <DialogHeader>
        <DialogTitle>{movie.title}</DialogTitle>
        <DialogDescription>
          {[movie.release_year, movie.vote_average ? `★ ${movie.vote_average.toFixed(1)}` : null]
            .filter(Boolean)
            .join(" • ") || "Описание ниже"}
        </DialogDescription>
      </DialogHeader>

      <div className="flex gap-3">
        <div className="shrink-0">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt=""
              className="h-40 w-28 object-cover ring-1 ring-foreground/10"
            />
          ) : (
            <div className="grid h-40 w-28 place-items-center bg-muted text-[10px] text-muted-foreground ring-1 ring-foreground/10">
              Нет постера
            </div>
          )}
        </div>
        <p className="flex-1 overflow-y-auto text-xs/relaxed text-muted-foreground">
          {movie.overview || "Без описания."}
        </p>
      </div>

      {mode === "view" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => setMode("self")}
            className="h-11 flex-1 text-sm sm:h-8 sm:text-xs"
          >
            <CalendarPlusIcon /> Запланировать себе
          </Button>
          <Button
            type="button"
            onClick={() => setMode("propose")}
            className="h-11 flex-1 text-sm sm:h-8 sm:text-xs"
            disabled={profiles.length === 0}
          >
            <UsersThreeIcon /> Предложить друзьям
          </Button>
        </div>
      ) : null}

      {mode === "propose" ? (
        <div className="grid gap-1.5">
          <Label>Кому предложить</Label>
          {profiles.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Нет других пользователей.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {profiles.map((p) => {
                const active = recipients.has(p.id);
                const name = p.name ?? "—";
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleRecipient(p.id)}
                    aria-pressed={active}
                    className={
                      "flex items-center gap-1.5 rounded-none border px-1.5 py-1 text-xs transition-colors " +
                      (active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted")
                    }
                  >
                    <Avatar size="sm">
                      {p.avatar_url ? (
                        <AvatarImage src={p.avatar_url} alt="" />
                      ) : null}
                      <AvatarFallback>{initials(name)}</AvatarFallback>
                    </Avatar>
                    <span>{name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {mode !== "view" ? (
        <>
          {slot?.fallback ? (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Не нашлось общего «личного» времени в ближайшие 14 дней — выберите
              время вручную.
            </p>
          ) : slot ? (
            <p className="text-[11px] text-muted-foreground">
              Подобрано в общем личном времени · длительность {slot.runtime_minutes} мин.
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="movie-start">Начало</Label>
              <Input
                id="movie-start"
                type="datetime-local"
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="movie-end">Окончание</Label>
              <Input
                id="movie-end"
                type="datetime-local"
                value={endInput}
                onChange={(e) => setEndInput(e.target.value)}
                required
              />
            </div>
          </div>
        </>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {done ? <p className="text-xs text-emerald-500">{done}</p> : null}

      {mode !== "view" ? (
        <div className="flex justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMode("view")}
            disabled={pending}
            className="h-11 text-sm sm:h-8 sm:text-xs"
          >
            Назад
          </Button>
          <Button
            type="button"
            onClick={mode === "self" ? handleSelfSchedule : handlePropose}
            disabled={pending || !startInput || !endInput}
            className="h-11 text-sm sm:h-8 sm:text-xs"
          >
            {pending
              ? "Сохраняем…"
              : mode === "self"
                ? "Добавить в календарь"
                : "Отправить предложение"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseLocal(value: string): string {
  return new Date(value).toISOString();
}
