import { CalendarBlankIcon } from "@phosphor-icons/react/ssr";

import { type EventCategory } from "@/app/(app)/profile/actions";
import { UserMenu } from "@/components/user-menu";
import type { SessionUser } from "@/lib/user";

export function AppHeader({
  user,
  categories,
}: {
  user: SessionUser;
  categories: EventCategory[];
}) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
        <CalendarBlankIcon className="size-4 shrink-0" />
        <span className="truncate">
          <span className="sm:hidden">Планер</span>
          <span className="hidden sm:inline">Общий планер недели</span>
        </span>
      </div>
      <UserMenu user={user} categories={categories} />
    </header>
  );
}
