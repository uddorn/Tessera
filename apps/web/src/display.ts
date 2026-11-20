import type { PersistedTaskDto, ProjectRole } from "@tessera/shared";

export const priorityLabels: Record<PersistedTaskDto["priority"], string> = {
  LOW: "Низький",
  NORMAL: "Звичайний",
  HIGH: "Високий",
  CRITICAL: "Критичний",
};

export const roleLabels: Record<ProjectRole, string> = {
  OWNER: "Власник",
  ADMIN: "Адміністратор",
  MEMBER: "Учасник",
  VIEWER: "Переглядач",
};

const formatter = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
export const dateLabel = (date: string) => formatter.format(new Date(date));
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
export const errorMessage = (error: unknown) =>
  error instanceof TypeError
    ? "Не вдалося підключитися до сервера."
    : error instanceof Error
      ? error.message
      : "Сталася помилка.";
