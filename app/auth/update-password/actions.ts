"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type UpdatePasswordState = { error?: string } | undefined;

export async function updatePassword(
  _prev: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { error: "Пароль должен быть не короче 8 символов." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/");
}
