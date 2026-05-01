import { redirect } from "next/navigation";

import { type EventCategory } from "@/app/(app)/profile/actions";
import { AppHeader } from "@/components/app-header";
import { IosInstallPrompt } from "@/components/ios-install-prompt";
import type { IncomingSuggestion } from "@/components/movie-inbox";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/user";

type SuggestionRow = {
  id: string;
  from_user: string;
  title: string;
  poster_url: string | null;
  overview: string | null;
  proposed_starts_at: string;
  proposed_ends_at: string;
  release_year: number | null;
  vote_average: number | null;
  runtime_minutes: number | null;
  responses: Record<string, string> | null;
};

type SenderRow = {
  id: string;
  name: string | null;
  avatar_url: string | null;
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: rawSuggestions }, { data: chatUnreadRaw }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("name, avatar_url, event_categories")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("movie_suggestions")
        .select(
          "id, from_user, title, poster_url, overview, proposed_starts_at, proposed_ends_at, release_year, vote_average, runtime_minutes, responses",
        )
        .contains("recipients", [user.id])
        .eq("status", "pending"),
      supabase.rpc("chat_unread_count"),
    ]);

  const chatUnread =
    typeof chatUnreadRaw === "number" ? chatUnreadRaw : 0;

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email ?? "",
    name: profile?.name ?? user.email ?? "",
    avatarUrl: profile?.avatar_url ?? undefined,
  };

  const categories: EventCategory[] =
    (profile?.event_categories as EventCategory[] | null) ?? [];

  const pending = ((rawSuggestions as SuggestionRow[] | null) ?? []).filter(
    (s) => !s.responses || !s.responses[user.id],
  );

  const senderIds = Array.from(new Set(pending.map((s) => s.from_user)));
  const sendersById = new Map<string, SenderRow>();
  if (senderIds.length > 0) {
    const { data: senders } = await supabase
      .from("profiles")
      .select("id, name, avatar_url")
      .in("id", senderIds);
    for (const p of (senders as SenderRow[] | null) ?? []) {
      sendersById.set(p.id, p);
    }
  }

  const incoming: IncomingSuggestion[] = pending.map((s) => {
    const sender = sendersById.get(s.from_user);
    return {
      id: s.id,
      from_user: s.from_user,
      from_name: sender?.name ?? null,
      from_avatar_url: sender?.avatar_url ?? null,
      title: s.title,
      poster_url: s.poster_url,
      overview: s.overview,
      proposed_starts_at: s.proposed_starts_at,
      proposed_ends_at: s.proposed_ends_at,
      release_year: s.release_year,
      vote_average: s.vote_average,
      runtime_minutes: s.runtime_minutes,
    };
  });

  return (
    <div className="flex h-svh flex-col">
      <AppHeader
        user={sessionUser}
        categories={categories}
        incoming={incoming}
        chatUnread={chatUnread}
      />
      <main className="flex-1 overflow-hidden">{children}</main>
      <IosInstallPrompt />
    </div>
  );
}
