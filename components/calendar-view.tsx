"use client";

import type {
  DateSelectArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import ruLocale from "@fullcalendar/core/locales/ru";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, {
  type DateClickArg,
  type EventResizeDoneArg,
} from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { CaretLeftIcon, CaretRightIcon, PlusIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { updateEvent } from "@/app/(app)/events/actions";
import { type EventCategory } from "@/app/(app)/profile/actions";
import {
  EventDialog,
  type EventDialogState,
} from "@/components/event-dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/user";

export type EventRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  category_id: string | null;
  color: string | null;
};

export type ProfileRow = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  event_categories: EventCategory[] | null;
};

const FALLBACK_COLOR = "#6b7280";
const DEFAULT_DURATION_MS = 30 * 60 * 1000;
const DEFAULT_AGENDA_HOUR = 12;

type ViewMode = "day" | "week" | "month" | "agenda";

function fcViewName(mode: Exclude<ViewMode, "agenda">): string {
  if (mode === "day") return "timeGridDay";
  if (mode === "week") return "timeGridWeek";
  return "dayGridMonth";
}

export function CalendarView({
  currentUserId,
  events,
  profiles,
}: {
  currentUserId: string;
  events: EventRow[];
  profiles: ProfileRow[];
}) {
  const [dialog, setDialog] = useState<EventDialogState | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const fcRef = useRef<FullCalendar>(null);
  const router = useRouter();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => {
      const mobile = mq.matches;
      setIsMobile(mobile);
      if (mobile) {
        setViewMode((m) => (m === "week" || m === "month" ? "day" : m));
      }
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("events-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const profilesById = useMemo(() => {
    const m = new Map<string, ProfileRow>();
    for (const p of profiles) m.set(p.id, p);
    return m;
  }, [profiles]);

  const myCategories = useMemo(
    () => profilesById.get(currentUserId)?.event_categories ?? [],
    [profilesById, currentUserId],
  );

  const fcEvents = useMemo<EventInput[]>(
    () =>
      events.map((e) => {
        const profile = profilesById.get(e.owner_id);
        const cat = profile?.event_categories?.find(
          (c) => c.id === e.category_id,
        );
        const color = e.color ?? cat?.color ?? FALLBACK_COLOR;
        return {
          id: e.id,
          title: e.title,
          start: e.starts_at,
          end: e.ends_at,
          allDay: e.all_day,
          backgroundColor: color,
          borderColor: color,
          editable: e.owner_id === currentUserId,
          extendedProps: {
            ownerId: e.owner_id,
          },
        };
      }),
    [events, profilesById, currentUserId],
  );

  function openCreate(starts_at: string, ends_at: string, all_day: boolean) {
    setDialog({ mode: "create", starts_at, ends_at, all_day });
  }

  function handleSelect(arg: DateSelectArg) {
    openCreate(arg.start.toISOString(), arg.end.toISOString(), arg.allDay);
  }

  function handleDateClick(arg: DateClickArg) {
    const start = arg.date;
    const end = new Date(start.getTime() + DEFAULT_DURATION_MS);
    openCreate(start.toISOString(), end.toISOString(), arg.allDay);
  }

  function handleEventClick(arg: EventClickArg) {
    const e = events.find((ev) => ev.id === arg.event.id);
    if (!e) return;
    setDialog({
      mode: "edit",
      id: e.id,
      ownerId: e.owner_id,
      title: e.title,
      description: e.description,
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      all_day: e.all_day,
      category_id: e.category_id,
      color: e.color,
    });
  }

  async function handleEventChange(arg: EventDropArg | EventResizeDoneArg) {
    const e = events.find((ev) => ev.id === arg.event.id);
    if (!e || e.owner_id !== currentUserId) {
      arg.revert();
      return;
    }
    const start = arg.event.start;
    if (!start) {
      arg.revert();
      return;
    }
    const end =
      arg.event.end ?? new Date(start.getTime() + DEFAULT_DURATION_MS);
    const result = await updateEvent(e.id, {
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      all_day: arg.event.allDay,
    });
    if (result?.error) arg.revert();
  }

  function renderEventContent(arg: EventContentArg) {
    const ownerId = arg.event.extendedProps.ownerId as string | undefined;
    const profile = ownerId ? profilesById.get(ownerId) : undefined;
    const name = profile?.name ?? "";
    const avatar = profile?.avatar_url;

    return (
      <div className="flex w-full items-center gap-1 overflow-hidden px-1 py-0.5 text-[11px] leading-tight">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            className="size-5 shrink-0 rounded-full object-cover ring-1 ring-white/40"
          />
        ) : (
          <span
            className="grid size-5 shrink-0 place-items-center rounded-full bg-black/25 text-[10px] font-semibold text-white ring-1 ring-white/40"
            aria-label={name}
          >
            {initials(name) || "?"}
          </span>
        )}
        {arg.timeText ? (
          <span className="shrink-0 opacity-80">{arg.timeText}</span>
        ) : null}
        <span className="truncate">{arg.event.title}</span>
      </div>
    );
  }

  const editingOwnerName =
    dialog?.mode === "edit"
      ? profilesById.get(dialog.ownerId)?.name ?? ""
      : "";

  const dialogCategories =
    dialog?.mode === "edit"
      ? profilesById.get(dialog.ownerId)?.event_categories ?? []
      : myCategories;

  function shiftAnchor(direction: 1 | -1) {
    const next = new Date(anchorDate);
    if (viewMode === "day") {
      next.setDate(next.getDate() + direction);
    } else if (viewMode === "month") {
      next.setMonth(next.getMonth() + direction);
    } else {
      next.setDate(next.getDate() + direction * 7);
    }
    next.setHours(0, 0, 0, 0);
    setAnchorDate(next);
    if (viewMode !== "agenda") fcRef.current?.getApi().gotoDate(next);
  }

  function goToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setAnchorDate(today);
    if (viewMode !== "agenda") fcRef.current?.getApi().gotoDate(today);
  }

  function changeView(mode: ViewMode) {
    setViewMode(mode);
    if (mode !== "agenda") {
      fcRef.current?.getApi().changeView(fcViewName(mode), anchorDate);
    }
  }

  function openEdit(event: EventRow) {
    setDialog({
      mode: "edit",
      id: event.id,
      ownerId: event.owner_id,
      title: event.title,
      description: event.description,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      all_day: event.all_day,
      category_id: event.category_id,
      color: event.color,
    });
  }

  function createOnDay(day: Date) {
    const start = new Date(day);
    start.setHours(DEFAULT_AGENDA_HOUR, 0, 0, 0);
    const end = new Date(start.getTime() + DEFAULT_DURATION_MS);
    setDialog({
      mode: "create",
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      all_day: false,
    });
  }

  const initialFcView = isMobile ? "timeGridDay" : "timeGridWeek";
  const showAgenda = viewMode === "agenda";

  return (
    <>
      <div className="flex h-full flex-col">
        <ViewToolbar
          mode={viewMode}
          anchor={anchorDate}
          isMobile={isMobile}
          onMode={changeView}
          onPrev={() => shiftAnchor(-1)}
          onNext={() => shiftAnchor(1)}
          onToday={goToday}
        />
        <div className={cn("flex-1 overflow-hidden", showAgenda ? "" : "p-2 sm:p-4")}>
          <div className={cn("h-full", showAgenda ? "hidden" : "block")}>
            <FullCalendar
              ref={fcRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              locale={ruLocale}
              initialView={initialFcView}
              initialDate={anchorDate.toISOString()}
              firstDay={1}
              headerToolbar={false}
              nowIndicator
              editable
              selectable
              select={handleSelect}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              eventDrop={handleEventChange}
              eventResize={handleEventChange}
              eventContent={renderEventContent}
              slotMinTime="07:00:00"
              slotMaxTime="24:00:00"
              events={fcEvents}
              height="100%"
            />
          </div>
          {showAgenda ? (
            <AgendaView
              anchor={anchorDate}
              events={events}
              profilesById={profilesById}
              onEventClick={openEdit}
              onCreate={createOnDay}
            />
          ) : null}
        </div>
      </div>
      <EventDialog
        state={dialog}
        currentUserId={currentUserId}
        categories={dialogCategories}
        ownerName={editingOwnerName}
        onClose={() => setDialog(null)}
      />
    </>
  );
}

function ViewToolbar({
  mode,
  anchor,
  isMobile,
  onMode,
  onPrev,
  onNext,
  onToday,
}: {
  mode: ViewMode;
  anchor: Date;
  isMobile: boolean;
  onMode: (m: ViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const title = formatTitle(mode, anchor);

  const viewButton = (m: ViewMode, label: string) => (
    <Button
      variant={mode === m ? "secondary" : "outline"}
      size="sm"
      onClick={() => onMode(m)}
    >
      {label}
    </Button>
  );

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-2 py-2 sm:px-4">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" onClick={onPrev} aria-label="Назад">
          <CaretLeftIcon />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={onNext} aria-label="Вперёд">
          <CaretRightIcon />
        </Button>
        <Button variant="outline" size="sm" onClick={onToday}>
          Сегодня
        </Button>
      </div>
      <div
        className="order-last w-full px-1 text-sm font-medium sm:order-0 sm:w-auto sm:flex-1 sm:text-base"
        suppressHydrationWarning
      >
        {title}
      </div>
      <div className="ml-auto flex">
        {viewButton("day", "День")}
        {!isMobile ? viewButton("week", "Неделя") : null}
        {!isMobile ? viewButton("month", "Месяц") : null}
        {viewButton("agenda", "Список")}
      </div>
    </div>
  );
}

type AgendaItem = { event: EventRow; time: string };
type AgendaDay = {
  key: string;
  date: Date;
  label: string;
  isToday: boolean;
  events: AgendaItem[];
};

function AgendaView({
  anchor,
  events,
  profilesById,
  onEventClick,
  onCreate,
}: {
  anchor: Date;
  events: EventRow[];
  profilesById: Map<string, ProfileRow>;
  onEventClick: (e: EventRow) => void;
  onCreate: (day: Date) => void;
}) {
  const days = useMemo(() => buildAgenda(anchor, events), [anchor, events]);

  return (
    <div className="h-full overflow-y-auto px-2 py-2 sm:px-4">
      <div className="mx-auto max-w-2xl">
        {days.map((day) => (
          <section key={day.key} className="mb-3">
            <div className="mb-1 flex items-center gap-2 px-1">
              <h3
                className={cn(
                  "text-xs font-medium uppercase tracking-wide",
                  day.isToday ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {day.label}
              </h3>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onCreate(day.date)}
                aria-label={`Добавить событие ${day.label}`}
              >
                <PlusIcon />
              </Button>
            </div>
            {day.events.length === 0 ? (
              <button
                type="button"
                onClick={() => onCreate(day.date)}
                className="w-full rounded border border-dashed border-border px-2 py-2 text-left text-xs text-muted-foreground/70 hover:bg-muted/40 hover:text-foreground"
              >
                Нет событий — добавить
              </button>
            ) : (
              <ul className="divide-y divide-border rounded border border-border">
                {day.events.map(({ event, time }) => {
                  const profile = profilesById.get(event.owner_id);
                  const cat = profile?.event_categories?.find(
                    (c) => c.id === event.category_id,
                  );
                  const color = event.color ?? cat?.color ?? FALLBACK_COLOR;
                  const name = profile?.name ?? "";
                  return (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => onEventClick(event)}
                        className="flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-muted/40 active:bg-muted/60"
                      >
                        <span
                          className="h-9 w-1 shrink-0 rounded"
                          style={{ backgroundColor: color }}
                          aria-hidden
                        />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">
                            {event.title}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {time}
                          </span>
                        </div>
                        {profile?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={profile.avatar_url}
                            alt=""
                            className="size-6 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span
                            className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold"
                            aria-label={name}
                          >
                            {initials(name) || "?"}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function buildAgenda(anchor: Date, events: EventRow[]): AgendaDay[] {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  const dayOfWeek = (start.getDay() + 6) % 7; // Mon = 0
  start.setDate(start.getDate() - dayOfWeek);

  const todayKey = dateKey(new Date());
  const labelFmt = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  const result: AgendaDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dEnd = new Date(d);
    dEnd.setDate(dEnd.getDate() + 1);

    const dayEvents: AgendaItem[] = [];
    for (const e of events) {
      const evStart = new Date(e.starts_at);
      const evEnd = new Date(e.ends_at);
      if (evStart < dEnd && evEnd > d) {
        dayEvents.push({ event: e, time: formatAgendaTime(e, d, dEnd) });
      }
    }
    dayEvents.sort((a, b) => {
      if (a.event.all_day !== b.event.all_day) return a.event.all_day ? -1 : 1;
      return a.event.starts_at.localeCompare(b.event.starts_at);
    });

    const key = dateKey(d);
    result.push({
      key,
      date: d,
      label: capitalize(labelFmt.format(d)),
      isToday: key === todayKey,
      events: dayEvents,
    });
  }
  return result;
}

function formatAgendaTime(e: EventRow, dayStart: Date, dayEnd: Date): string {
  if (e.all_day) return "Весь день";
  const s = new Date(e.starts_at);
  const ed = new Date(e.ends_at);
  const startsToday = s >= dayStart && s < dayEnd;
  const endsToday = ed > dayStart && ed <= dayEnd;
  const fmt = (x: Date) =>
    `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
  if (startsToday && endsToday) return `${fmt(s)} — ${fmt(ed)}`;
  if (startsToday) return `с ${fmt(s)}`;
  if (endsToday) return `до ${fmt(ed)}`;
  return "Весь день";
}

function formatTitle(mode: ViewMode, anchor: Date): string {
  if (mode === "day") {
    return capitalize(
      new Intl.DateTimeFormat("ru-RU", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(anchor),
    );
  }
  if (mode === "month") {
    return capitalize(
      new Intl.DateTimeFormat("ru-RU", {
        month: "long",
        year: "numeric",
      }).format(anchor),
    );
  }
  // week or agenda — Mon..Sun range containing anchor
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  const dayOfWeek = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayOfWeek);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatRange(start, end);
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
