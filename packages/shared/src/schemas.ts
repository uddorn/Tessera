import { z } from "zod";

export const taskStatusSchema = z.enum([
  "PLANNED",
  "IN_PROGRESS",
  "CODE_REVIEW",
  "DONE",
]);

export const taskPrioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]);

export const taskSchema = z.object({
  taskId: z.string().min(1),
  taskKey: z.string().regex(/^[A-Z][A-Z0-9]+-\d+$/),
  workspaceId: z.string().min(1),
  title: z.string().trim().min(1).max(240),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  storyPoints: z.number().int().min(0).max(100),
  version: z.number().int().positive(),
});

export const moveTaskCommandSchema = z.object({
  taskId: z.string().min(1),
  targetColumnId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
});

export const domainEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.enum(["TASK_MOVED", "USER_MENTIONED", "SPRINT_DEADLINE"]),
  workspaceId: z.string().min(1),
  aggregateId: z.string().min(1),
  occurredAt: z.iso.datetime(),
  payload: z.record(z.string(), z.unknown()),
});

export type TaskDto = z.infer<typeof taskSchema>;
export type MoveTaskCommand = z.infer<typeof moveTaskCommandSchema>;
export type DomainEventDto = z.infer<typeof domainEventSchema>;
