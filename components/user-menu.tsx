"use client";

import { useRouter } from "next/navigation";
import { SignOutIcon, UserIcon, GearIcon } from "@phosphor-icons/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials, mockUser } from "@/lib/mock-user";

export function UserMenu() {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Меню пользователя"
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Avatar size="sm">
          {mockUser.avatarUrl ? (
            <AvatarImage src={mockUser.avatarUrl} alt={mockUser.name} />
          ) : null}
          <AvatarFallback>{initials(mockUser.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-44">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-foreground">{mockUser.name}</span>
            <span className="text-muted-foreground">{mockUser.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <UserIcon />
          Профиль
        </DropdownMenuItem>
        <DropdownMenuItem>
          <GearIcon />
          Настройки
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => router.push("/login")}
        >
          <SignOutIcon />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
