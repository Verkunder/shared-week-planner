import { CalendarBlankIcon } from "@phosphor-icons/react/ssr";
import { UserMenu } from "@/components/user-menu";

export function AppHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CalendarBlankIcon className="size-4" />
        <span>Общий планер недели</span>
      </div>
      <UserMenu />
    </header>
  );
}
