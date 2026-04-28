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
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { updateEvent } from "@/app/(app)/events/actions";
import { type EventCategory } from "@/app/(app)/profile/actions";
import {
  EventDialog,
  type EventDialogState,
} from "@/components/event-dialog";
import { createClient } from "@/lib/supabase/client";
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
};

export type ProfileRow = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  event_categories: EventCategory[] | null;
};

const FALLBACK_COLOR = "#6b7280";
const DEFAULT_DURATION_MS = 30 * 60 * 1000;

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
  const router = useRouter();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mq.matches);
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
        const color = cat?.color ?? FALLBACK_COLOR;
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

  const headerToolbar = isMobile
    ? {
        left: "prev,next",
        center: "title",
        right: "timeGridDay,timeGridWeek",
      }
    : {
        left: "prev,next today",
        center: "title",
        right: "timeGridDay,timeGridWeek,dayGridMonth",
      };

  return (
    <>
      <div className="h-full p-2 sm:p-4">
        <FullCalendar
          key={isMobile ? "mobile" : "desktop"}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          locale={ruLocale}
          initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
          firstDay={1}
          headerToolbar={headerToolbar}
          buttonText={
            isMobile
              ? { today: "Сегодня", day: "День", week: "Неделя" }
              : undefined
          }
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
      <EventDialog
        state={dialog}
        currentUserId={currentUserId}
        categories={myCategories}
        ownerName={editingOwnerName}
        onClose={() => setDialog(null)}
      />
    </>
  );
}
