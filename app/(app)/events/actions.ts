"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type EventInput = {
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  category_id: string | null;
};

export type EventResult = { error?: string; id?: string } | undefined;

function validate(input: Partial<EventInput>): string | null {
  if (input.title !== undefined && !input.title.trim()) {
    return "Название не может быть пустым.";
  }
  if (
    input.starts_at &&
    input.ends_at &&
    new Date(input.starts_at) >= new Date(input.ends_at)
  ) {
    return "Окончание должно быть позже начала.";
  }
  return null;
}

export async function createEvent(input: EventInput): Promise<EventResult> {
  const v = validate(input);
  if (v) return { error: v };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован." };

  const { data, error } = await supabase
    .from("events")
    .insert({
      owner_id: user.id,
      title: input.title.trim(),
      description: input.description,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      all_day: input.all_day,
      category_id: input.category_id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/");
  return { id: data.id };
}

export async function updateEvent(
  id: string,
  patch: Partial<EventInput>,
): Promise<EventResult> {
  const v = validate(patch);
  if (v) return { error: v };

  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.starts_at !== undefined) update.starts_at = patch.starts_at;
  if (patch.ends_at !== undefined) update.ends_at = patch.ends_at;
  if (patch.all_day !== undefined) update.all_day = patch.all_day;
  if (patch.category_id !== undefined) update.category_id = patch.category_id;

  const { error } = await supabase
    .from("events")
    .update(update)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return undefined;
}

export async function deleteEvent(id: string): Promise<EventResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/");
  return undefined;
}
