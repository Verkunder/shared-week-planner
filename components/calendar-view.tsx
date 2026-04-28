"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ruLocale from "@fullcalendar/core/locales/ru";
import type { EventInput } from "@fullcalendar/core";

const initialEvents: EventInput[] = [
  {
    id: "1",
    title: "Дейли",
    start: "2026-04-28T09:00:00",
    end: "2026-04-28T09:30:00",
  },
  {
    id: "2",
    title: "Ревью дизайна",
    start: "2026-04-29T14:00:00",
    end: "2026-04-29T15:30:00",
  },
  {
    id: "3",
    title: "1:1 с Леной",
    start: "2026-04-30T11:00:00",
    end: "2026-04-30T11:45:00",
  },
  {
    id: "4",
    title: "Глубокая работа",
    start: "2026-05-01T10:00:00",
    end: "2026-05-01T12:00:00",
  },
];

export function CalendarView() {
  return (
    <div className="h-full p-4">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        locale={ruLocale}
        initialView="timeGridWeek"
        firstDay={1}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "timeGridDay,timeGridWeek,dayGridMonth",
        }}
        nowIndicator
        editable
        selectable
        slotMinTime="07:00:00"
        slotMaxTime="22:00:00"
        events={initialEvents}
        height="100%"
      />
    </div>
  );
}
