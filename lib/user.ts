export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
};

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
