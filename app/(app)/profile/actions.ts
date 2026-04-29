"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type EventCategory = {
  id: string;
  label: string;
  color: string;
  is_personal?: boolean;
};

export type ProfileResult = { error?: string } | undefined;

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export async function updateProfile(
  formData: FormData,
): Promise<ProfileResult> {
  const name = String(formData.get("name") ?? "").trim();
  const avatar = formData.get("avatar");
  const file = avatar instanceof File && avatar.size > 0 ? avatar : null;

  if (!name) return { error: "Имя не может быть пустым." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован." };

  let avatarUrl: string | undefined;

  if (file) {
    if (!file.type.startsWith("image/")) {
      return { error: "Можно загрузить только изображение." };
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return { error: "Размер не больше 2 МБ." };
    }

    const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
    if (uploadError) return { error: uploadError.message };

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    avatarUrl = data.publicUrl;
  }

  const payload: Record<string, unknown> = { id: user.id, name };
  if (avatarUrl) payload.avatar_url = avatarUrl;

  const { error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return undefined;
}

export async function updateEventCategories(
  categories: EventCategory[],
): Promise<ProfileResult> {
  for (const c of categories) {
    if (!c.label.trim()) {
      return { error: "Название категории не может быть пустым." };
    }
    if (!HEX_COLOR.test(c.color)) {
      return { error: "Некорректный цвет." };
    }
  }

  const sanitized: EventCategory[] = categories.map((c) => ({
    id: c.id,
    label: c.label.trim(),
    color: c.color,
    ...(c.is_personal ? { is_personal: true } : {}),
  }));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован." };

  const { error } = await supabase
    .from("profiles")
    .upsert(
      { id: user.id, event_categories: sanitized },
      { onConflict: "id" },
    );

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return undefined;
}
