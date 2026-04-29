import {
  CalendarBlankIcon,
  ChatCircleIcon,
  FilmReelIcon,
} from "@phosphor-icons/react/ssr";

import { type EventCategory } from "@/app/(app)/profile/actions";
import { ChatUnreadBadge } from "@/components/chat-unread-badge";
import { HeaderNavLink } from "@/components/header-nav-link";
import {
  MovieInbox,
  type IncomingSuggestion,
} from "@/components/movie-inbox";
import { UserMenu } from "@/components/user-menu";
import type { SessionUser } from "@/lib/user";

export function AppHeader({
  user,
  categories,
  incoming,
  chatUnread,
}: {
  user: SessionUser;
  categories: EventCategory[];
  incoming: IncomingSuggestion[];
  chatUnread: number;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:h-14 md:gap-4 md:px-6">
      <div className="flex shrink-0 items-center gap-1 text-sm font-medium md:gap-1.5 md:text-base">
        <CalendarBlankIcon className="size-4 shrink-0 md:size-5" />
        <span className="hidden truncate sm:inline">Планер</span>
      </div>
      <nav className="flex items-center gap-0.5 md:gap-1">
        <HeaderNavLink href="/" exact>
          <CalendarBlankIcon className="size-3.5 md:size-4" />
          <span>Календарь</span>
        </HeaderNavLink>
        <HeaderNavLink href="/movies">
          <FilmReelIcon className="size-3.5 md:size-4" />
          <span>Фильмы</span>
        </HeaderNavLink>
        <HeaderNavLink href="/chat">
          <ChatCircleIcon className="size-3.5 md:size-4" />
          <span>Чат</span>
          <ChatUnreadBadge count={chatUnread} currentUserId={user.id} />
        </HeaderNavLink>
      </nav>
      <div className="ml-auto flex items-center gap-2 md:gap-3">
        <MovieInbox incoming={incoming} />
        <UserMenu user={user} categories={categories} />
      </div>
    </header>
  );
}
