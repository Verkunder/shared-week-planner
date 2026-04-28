import { redirect } from "next/navigation";

import { type EventCategory } from "@/app/(app)/profile/actions";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/user";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, avatar_url, event_categories")
    .eq("id", user.id)
    .maybeSingle();

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email ?? "",
    name: profile?.name ?? user.email ?? "",
    avatarUrl: profile?.avatar_url ?? undefined,
  };

  const categories: EventCategory[] =
    (profile?.event_categories as EventCategory[] | null) ?? [];

  return (
    <div className="flex h-svh flex-col">
      <AppHeader user={sessionUser} categories={categories} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
