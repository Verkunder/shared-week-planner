export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
};

export const mockUser: User = {
  id: "u_1",
  name: "Степан Капустин",
  email: "stepan@example.com",
  avatarUrl: undefined,
};

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
