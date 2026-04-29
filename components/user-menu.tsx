"use client";

import { SignOutIcon, UserIcon, GearIcon } from "@phosphor-icons/react";
import { useState } from "react";

import { signOut } from "@/app/(app)/actions";
import { type EventCategory } from "@/app/(app)/profile/actions";
import { ProfileDialog, type ProfileTab } from "@/components/profile-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials, type SessionUser } from "@/lib/user";

export function UserMenu({
  user,
  categories,
}: {
  user: SessionUser;
  categories: EventCategory[];
}) {
  const [openTab, setOpenTab] = useState<ProfileTab | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Меню пользователя"
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Avatar size="sm" className="md:data-[size=sm]:size-8">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user.name} />
            ) : null}
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="min-w-44">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-foreground">{user.name}</span>
                <span className="text-muted-foreground">{user.email}</span>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpenTab("profile")}>
            <UserIcon />
            Профиль
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenTab("settings")}>
            <GearIcon />
            Настройки
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => signOut()}>
            <SignOutIcon />
            Выйти
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProfileDialog
        user={user}
        categories={categories}
        openTab={openTab}
        onOpenChange={(open) => {
          if (!open) setOpenTab(null);
        }}
      />
    </>
  );
}
