"use client";

import type { ComponentProps } from "react";

import ruLocale from "@fullcalendar/core/locales/ru";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";

type FullCalendarClientProps = Omit<
  ComponentProps<typeof FullCalendar>,
  "locale" | "plugins"
>;

export function FullCalendarClient(props: FullCalendarClientProps) {
  return (
    <FullCalendar
      {...props}
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      locale={ruLocale}
    />
  );
}
