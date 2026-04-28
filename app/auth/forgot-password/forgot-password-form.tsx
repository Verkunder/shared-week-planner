"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  requestPasswordReset,
  type ForgotPasswordState,
} from "./actions";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<
    ForgotPasswordState,
    FormData
  >(requestPasswordReset, undefined);

  if (state?.sent) {
    return (
      <div className="grid gap-3 text-xs">
        <p>
          Если адрес зарегистрирован, мы отправили на него ссылку для сброса
          пароля. Проверьте почту.
        </p>
        <Link href="/login" className="text-primary hover:underline">
          Назад ко входу
        </Link>
      </div>
    );
  }

  return (
    <form className="grid gap-4" action={formAction}>
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      {state?.error ? (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Отправляем…" : "Отправить ссылку"}
      </Button>
      <Link
        href="/login"
        className="text-center text-xs text-muted-foreground hover:text-foreground"
      >
        Назад ко входу
      </Link>
    </form>
  );
}
