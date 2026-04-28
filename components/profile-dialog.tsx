"use client";

import Link from "next/link";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import {
  updateEventCategories,
  updateProfile,
  type EventCategory,
} from "@/app/(app)/profile/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { initials, type SessionUser } from "@/lib/user";

const THEME_LABELS: Record<string, string> = {
  light: "Светлая",
  dark: "Тёмная",
  system: "Системная",
};

function ThemeRow() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="theme-select">Тема</Label>
      <Select
        value={mounted ? theme ?? "system" : "system"}
        onValueChange={(v) => v && setTheme(v)}
      >
        <SelectTrigger id="theme-select" className="w-full">
          <SelectValue placeholder="Тема">
            {(value: string | null) =>
              THEME_LABELS[value ?? "system"] ?? "Системная"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="light">Светлая</SelectItem>
          <SelectItem value="dark">Тёмная</SelectItem>
          <SelectItem value="system">Системная</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export type ProfileTab = "profile" | "settings";

const DEFAULT_CATEGORIES: EventCategory[] = [
  { id: "work", label: "Работа", color: "#3b82f6" },
  { id: "personal", label: "Личное", color: "#10b981" },
  { id: "sport", label: "Спорт", color: "#f97316" },
];

export function ProfileDialog({
  user,
  categories,
  openTab,
  onOpenChange,
}: {
  user: SessionUser;
  categories: EventCategory[];
  openTab: ProfileTab | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = openTab !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Профиль и настройки</DialogTitle>
          <DialogDescription>
            Управляйте своим профилем и предпочтениями.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <ProfileDialogBody
            user={user}
            categories={categories}
            initialTab={openTab}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ProfileDialogBody({
  user,
  categories,
  initialTab,
}: {
  user: SessionUser;
  categories: EventCategory[];
  initialTab: ProfileTab;
}) {
  const [tab, setTab] = useState<ProfileTab>(initialTab);

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as ProfileTab)}>
      <TabsList className="w-full">
        <TabsTrigger value="profile">Профиль</TabsTrigger>
        <TabsTrigger value="settings">Настройки</TabsTrigger>
      </TabsList>
      <TabsContent value="profile">
        <ProfileTabPanel user={user} />
      </TabsContent>
      <TabsContent value="settings">
        <SettingsTabPanel categories={categories} />
      </TabsContent>
    </Tabs>
  );
}

function ProfileTabPanel({ user }: { user: SessionUser }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ error?: string; ok?: boolean }>({});
  const [name, setName] = useState(user.name);
  const [preview, setPreview] = useState<string | undefined>(user.avatarUrl);
  const previewUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreview(url);
  }

  async function action(formData: FormData) {
    setState({});
    startTransition(async () => {
      const result = await updateProfile(formData);
      if (result?.error) setState({ error: result.error });
      else setState({ ok: true });
    });
  }

  return (
    <form action={action} className="grid gap-4 pt-4">
      <div className="flex items-center gap-3">
        <Avatar size="lg">
          {preview ? <AvatarImage src={preview} alt="" /> : null}
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
        <div className="grid gap-1.5">
          <Label htmlFor="avatar">Аватар</Label>
          <Input
            id="avatar"
            type="file"
            name="avatar"
            accept="image/*"
            onChange={handleFileChange}
          />
          <span className="text-[10px] text-muted-foreground">
            До 2 МБ, любая картинка.
          </span>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="name">Имя</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={1}
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="text-xs text-emerald-500">Сохранено.</p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Сохраняем…" : "Сохранить"}
        </Button>
      </div>
    </form>
  );
}

function SettingsTabPanel({
  categories: initial,
}: {
  categories: EventCategory[];
}) {
  const [items, setItems] = useState<EventCategory[]>(() =>
    initial.length > 0 ? initial : DEFAULT_CATEGORIES,
  );
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ error?: string; ok?: boolean }>({});

  function update(id: string, patch: Partial<EventCategory>) {
    setItems((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function remove(id: string) {
    setItems((cs) => cs.filter((c) => c.id !== id));
  }

  function add() {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `cat_${Date.now()}`;
    setItems((cs) => [...cs, { id, label: "", color: "#888888" }]);
  }

  function save() {
    setState({});
    startTransition(async () => {
      const result = await updateEventCategories(items);
      if (result?.error) setState({ error: result.error });
      else setState({ ok: true });
    });
  }

  return (
    <div className="grid gap-4 pt-4">
      <ThemeRow />
      <div className="grid gap-2">
        <Label>Категории событий</Label>
        <div className="grid gap-2">
          {items.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2">
              <input
                type="color"
                value={cat.color}
                onChange={(e) => update(cat.id, { color: e.target.value })}
                className="h-8 w-8 shrink-0 cursor-pointer rounded-none border border-input bg-transparent"
                aria-label="Цвет"
              />
              <Input
                value={cat.label}
                onChange={(e) => update(cat.id, { label: e.target.value })}
                placeholder="Название"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(cat.id)}
                aria-label="Удалить категорию"
              >
                <TrashIcon />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          className="justify-self-start"
        >
          <PlusIcon /> Добавить категорию
        </Button>
      </div>
      {state.error ? (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="text-xs text-emerald-500">Сохранено.</p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/auth/update-password"
          className="text-xs text-primary hover:underline"
        >
          Сменить пароль
        </Link>
        <Button type="button" disabled={pending} onClick={save}>
          {pending ? "Сохраняем…" : "Сохранить"}
        </Button>
      </div>
    </div>
  );
}
