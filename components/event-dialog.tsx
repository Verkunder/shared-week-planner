"use client";

import { TrashIcon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";

import {
  createEvent,
  deleteEvent,
  updateEvent,
} from "@/app/(app)/events/actions";
import { type EventCategory } from "@/app/(app)/profile/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const NO_CATEGORY = "__none__";

export type EventDialogState =
  | {
      mode: "create";
      starts_at: string;
      ends_at: string;
      all_day: boolean;
    }
  | {
      mode: "edit";
      id: string;
      ownerId: string;
      title: string;
      description: string | null;
      starts_at: string;
      ends_at: string;
      all_day: boolean;
      category_id: string | null;
    };

export function EventDialog({
  state,
  currentUserId,
  categories,
  ownerName,
  onClose,
}: {
  state: EventDialogState | null;
  currentUserId: string;
  categories: EventCategory[];
  ownerName: string;
  onClose: () => void;
}) {
  const open = state !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        {state ? (
          <EventDialogBody
            key={state.mode === "edit" ? state.id : "create"}
            state={state}
            currentUserId={currentUserId}
            categories={categories}
            ownerName={ownerName}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EventDialogBody({
  state,
  currentUserId,
  categories,
  ownerName,
  onClose,
}: {
  state: EventDialogState;
  currentUserId: string;
  categories: EventCategory[];
  ownerName: string;
  onClose: () => void;
}) {
  const isEdit = state.mode === "edit";
  const isOwner = !isEdit || state.ownerId === currentUserId;
  const readOnly = isEdit && !isOwner;

  const [title, setTitle] = useState(isEdit ? state.title : "");
  const [description, setDescription] = useState(
    isEdit ? state.description ?? "" : "",
  );
  const [allDay, setAllDay] = useState(state.all_day);
  const [startInput, setStartInput] = useState(() =>
    formatForInput(state.starts_at, state.all_day, "start"),
  );
  const [endInput, setEndInput] = useState(() =>
    formatForInput(state.ends_at, state.all_day, "end"),
  );
  const [categoryId, setCategoryId] = useState<string>(
    isEdit && state.category_id ? state.category_id : NO_CATEGORY,
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function handleAllDayToggle(checked: boolean) {
    const startIso = parseFromInput(startInput, allDay, "start");
    const endIso = parseFromInput(endInput, allDay, "end");
    setAllDay(checked);
    setStartInput(formatForInput(startIso, checked, "start"));
    setEndInput(formatForInput(endIso, checked, "end"));
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (readOnly) return;
    setError(undefined);

    const starts_at = parseFromInput(startInput, allDay, "start");
    const ends_at = parseFromInput(endInput, allDay, "end");

    const input = {
      title: title.trim(),
      description: description.trim() || null,
      starts_at,
      ends_at,
      all_day: allDay,
      category_id: categoryId === NO_CATEGORY ? null : categoryId,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateEvent(state.id, input)
        : await createEvent(input);
      if (result?.error) setError(result.error);
      else onClose();
    });
  }

  function handleDelete() {
    if (!isEdit || !isOwner) return;
    setError(undefined);
    startTransition(async () => {
      const result = await deleteEvent(state.id);
      if (result?.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>
          {isEdit ? "Событие" : "Новое событие"}
        </DialogTitle>
        <DialogDescription>
          {readOnly
            ? `Создал: ${ownerName || "другой пользователь"}`
            : isEdit
              ? "Измените или удалите событие."
              : "Заполните детали события."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-1.5">
        <Label htmlFor="event-title">Название</Label>
        <Input
          id="event-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          disabled={readOnly}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="event-description">Описание</Label>
        <Textarea
          id="event-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={readOnly}
          rows={3}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="event-all-day">Весь день</Label>
        <Switch
          id="event-all-day"
          checked={allDay}
          onCheckedChange={handleAllDayToggle}
          disabled={readOnly}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="event-start">Начало</Label>
          <Input
            id="event-start"
            type={allDay ? "date" : "datetime-local"}
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
            required
            disabled={readOnly}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="event-end">Окончание</Label>
          <Input
            id="event-end"
            type={allDay ? "date" : "datetime-local"}
            value={endInput}
            onChange={(e) => setEndInput(e.target.value)}
            required
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="event-category">Категория</Label>
        <Select
          value={categoryId}
          onValueChange={(v) => setCategoryId(v ?? NO_CATEGORY)}
          disabled={readOnly}
        >
          <SelectTrigger id="event-category" className="w-full">
            <SelectValue placeholder="Без категории">
              {(value: string | null) => {
                if (!value || value === NO_CATEGORY) {
                  return (
                    <>
                      <span
                        className="inline-block size-3 shrink-0 rounded-full bg-muted-foreground/40"
                        aria-hidden
                      />
                      Без категории
                    </>
                  );
                }
                const cat = categories.find((c) => c.id === value);
                if (!cat) return value;
                return (
                  <>
                    <span
                      className="inline-block size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color }}
                      aria-hidden
                    />
                    {cat.label}
                  </>
                );
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CATEGORY}>
              <span
                className="inline-block size-3 shrink-0 rounded-full bg-muted-foreground/40"
                aria-hidden
              />
              Без категории
            </SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span
                  className="inline-block size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: c.color }}
                  aria-hidden
                />
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2 pt-2">
        {isEdit && isOwner ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={pending}
          >
            <TrashIcon /> Удалить
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={pending}
          >
            {readOnly ? "Закрыть" : "Отмена"}
          </Button>
          {!readOnly ? (
            <Button type="submit" disabled={pending}>
              {pending ? "Сохраняем…" : isEdit ? "Сохранить" : "Создать"}
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatForInput(
  iso: string,
  allDay: boolean,
  bound: "start" | "end",
): string {
  const d = new Date(iso);
  if (allDay) {
    // For all-day events the stored end is exclusive (next-day midnight).
    // Show it as the inclusive last day in the picker.
    if (bound === "end") d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseFromInput(
  value: string,
  allDay: boolean,
  bound: "start" | "end",
): string {
  if (allDay) {
    const d = new Date(`${value}T00:00:00`);
    if (bound === "end") d.setDate(d.getDate() + 1);
    return d.toISOString();
  }
  return new Date(value).toISOString();
}
