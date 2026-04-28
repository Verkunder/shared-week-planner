import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CalendarView } from "@/components/calendar-view";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Календарь",
};

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: events }, { data: profiles }] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, owner_id, title, description, starts_at, ends_at, all_day, category_id",
      )
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
    />
  );
}
