"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updatePassword, type UpdatePasswordState } from "./actions";

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState<
    UpdatePasswordState,
    FormData
  >(updatePassword, undefined);

  return (
    <form className="grid gap-4" action={formAction}>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Новый пароль</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>
      {state?.error ? (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Сохраняем…" : "Сохранить пароль"}
      </Button>
    </form>
  );
}
