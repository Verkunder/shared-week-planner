import { AppHeader } from "@/components/app-header";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-svh flex-col">
      <AppHeader />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
