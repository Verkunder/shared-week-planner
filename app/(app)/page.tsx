import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CalendarView } from "@/components/calendar-view";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Календарь",
};

export default async function CalendarPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const initialRange = calendarInitialRange();
  const [{ data: events }, { data: profiles }] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, owner_id, title, description, starts_at, ends_at, all_day, category_id, color",
      )
      .lt("starts_at", initialRange.to)
      .gt("ends_at", initialRange.from)
      .order("starts_at"),
    supabase
      .from("profiles")
      .select("id, name, avatar_url, event_categories"),
  ]);

  return (
    <CalendarView
      currentUserId={user.id}
      events={events ?? []}
      profiles={profiles ?? []}
      initialRange={initialRange}
    />
  );
}

function calendarInitialRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  from.setDate(1);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - 7);

  const to = new Date(now);
  to.setMonth(to.getMonth() + 1, 1);
  to.setHours(0, 0, 0, 0);
  to.setDate(to.getDate() + 7);

  return { from: from.toISOString(), to: to.toISOString() };
}
