"use client";

import { CopyIcon, TrashIcon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";

import {
  createEvent,
  deleteEvent,
  duplicateEventToDays,
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
import { cn } from "@/lib/utils";

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
      color: string | null;
    };

const FALLBACK_COLOR = "#6b7280";

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
  const initialCategoryId =
    isEdit && state.category_id ? state.category_id : NO_CATEGORY;
  const initialCategory = categories.find((c) => c.id === initialCategoryId);
  const [categoryId, setCategoryId] = useState<string>(initialCategoryId);
  const [color, setColor] = useState<string>(
    (isEdit ? state.color : null) ?? initialCategory?.color ?? FALLBACK_COLOR,
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [copyMode, setCopyMode] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());

  function handleCategoryChange(next: string) {
    setCategoryId(next);
    const cat = categories.find((c) => c.id === next);
    if (cat) setColor(cat.color);
  }

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
      color,
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

  function toggleDay(key: string) {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function exitCopyMode() {
    setCopyMode(false);
    setSelectedDays(new Set());
    setError(undefined);
  }

  function handleConfirmCopy() {
    if (!isEdit || !isOwner) return;
    if (selectedDays.size === 0) return;
    setError(undefined);
    const targets = computeCopyTargets(
      { starts_at: state.starts_at, ends_at: state.ends_at, all_day: state.all_day },
      Array.from(selectedDays),
    );
    startTransition(async () => {
      const result = await duplicateEventToDays(state.id, targets);
      if (result?.error) setError(result.error);
      else onClose();
    });
  }

  if (isEdit && copyMode) {
    return (
      <div className="grid gap-4">
        <DialogHeader>
          <DialogTitle>Скопировать в другие дни</DialogTitle>
          <DialogDescription>
            Выберите дни — в каждый из них будет создана копия события с тем же
            временем.
          </DialogDescription>
        </DialogHeader>

        <MultiDayPicker
          anchor={new Date(state.starts_at)}
          selected={selectedDays}
          onToggle={toggleDay}
        />

        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={exitCopyMode}
            disabled={pending}
            className="h-11 text-sm sm:h-8 sm:text-xs"
          >
            Назад
          </Button>
          <Button
            type="button"
            onClick={handleConfirmCopy}
            disabled={pending || selectedDays.size === 0}
            className="h-11 text-sm sm:h-8 sm:text-xs"
          >
            {pending
              ? "Копируем…"
              : selectedDays.size === 0
                ? "Скопировать"
                : `Скопировать (${selectedDays.size})`}
          </Button>
        </div>
      </div>
    );
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
        <Label htmlFor="event-category">Категория и цвет</Label>
        <div className="flex gap-2">
        <Select
          value={categoryId}
          onValueChange={(v) => handleCategoryChange(v ?? NO_CATEGORY)}
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
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          disabled={readOnly}
          className="h-8 w-10 shrink-0 cursor-pointer rounded-none border border-input bg-transparent disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Цвет события"
        />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        {isEdit && isOwner ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={pending}
            >
              <TrashIcon /> Удалить
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCopyMode(true)}
              disabled={pending}
            >
              <CopyIcon /> Скопировать в…
            </Button>
          </div>
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

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function computeCopyTargets(
  source: { starts_at: string; ends_at: string; all_day: boolean },
  targetKeys: string[],
): { starts_at: string; ends_at: string; all_day: boolean }[] {
  const origStart = new Date(source.starts_at);
  const duration =
    new Date(source.ends_at).getTime() - origStart.getTime();
  return targetKeys.map((key) => {
    const [y, m, d] = key.split("-").map(Number);
    if (source.all_day) {
      const start = new Date(y, m - 1, d, 0, 0, 0, 0);
      const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
      return {
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        all_day: true,
      };
    }
    const start = new Date(
      y,
      m - 1,
      d,
      origStart.getHours(),
      origStart.getMinutes(),
      0,
      0,
    );
    const end = new Date(start.getTime() + duration);
    return {
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      all_day: false,
    };
  });
}

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const PICKER_WEEKS = 6;

function MultiDayPicker({
  anchor,
  selected,
  onToggle,
}: {
  anchor: Date;
  selected: Set<string>;
  onToggle: (key: string) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  if (start < today) start.setTime(today.getTime());
  const dayOfWeek = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayOfWeek);

  const days: Date[] = [];
  for (let i = 0; i < PICKER_WEEKS * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }

  const sourceKey = dayKey(anchor);
  const monthFmt = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  });
  const rangeLabel = `${capitalizeFirst(monthFmt.format(days[0]))} — ${capitalizeFirst(monthFmt.format(days[days.length - 1]))}`;

  return (
    <div className="grid gap-2">
      <div className="text-[11px] text-muted-foreground">{rangeLabel}</div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const key = dayKey(d);
          const isSelected = selected.has(key);
          const isPast = d < today;
          const isSource = key === sourceKey;
          const disabled = isPast || isSource;
          return (
            <button
              key={key}
              type="button"
              onClick={() => !disabled && onToggle(key)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={cn(
                "grid aspect-square place-items-center rounded-none border text-xs transition-colors",
                isSelected
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-background hover:bg-muted",
                disabled && "cursor-not-allowed opacity-40 hover:bg-background",
                isSource && "ring-1 ring-foreground/30",
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
