import { cn } from "@/lib/utils";

export function LoadingSpinner({
  className,
}: {
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-3 animate-spin rounded-full border border-current border-t-transparent",
        className,
      )}
    />
  );
}

export function LoadingBar({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-1 text-[11px] text-muted-foreground"
    >
      <LoadingSpinner />
      <span>{label}</span>
    </div>
  );
}

export function AppRouteLoading({ label = "Загружаем..." }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid h-full min-h-48 place-items-center px-4"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <LoadingSpinner className="size-4" />
        <span>{label}</span>
      </div>
    </div>
  );
}
