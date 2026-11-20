import type { BoardDto, TaskStatus } from "./api";

export const statusOrder: readonly TaskStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
  "CODE_REVIEW",
  "DONE",
];

export const statusLabels: Readonly<Record<TaskStatus, string>> = {
  PLANNED: "Заплановано",
  IN_PROGRESS: "У роботі",
  CODE_REVIEW: "На перевірці",
  DONE: "Виконано",
};

export function adjacentStatus(
  current: TaskStatus,
  direction: -1 | 1,
): TaskStatus | null {
  const nextIndex = statusOrder.indexOf(current) + direction;
  return statusOrder[nextIndex] ?? null;
}

export function boardSummary(board: BoardDto | null) {
  const tasks = board?.columns.flatMap((column) => column.tasks) ?? [];
  return {
    total: tasks.length,
    inProgress: tasks.filter((task) => task.status === "IN_PROGRESS").length,
    done: tasks.filter((task) => task.status === "DONE").length,
    storyPoints: tasks.reduce((sum, task) => sum + task.storyPoints, 0),
  };
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
