import { z } from "zod";

export const taskStatusSchema = z.enum([
  "PLANNED",
  "IN_PROGRESS",
  "CODE_REVIEW",
  "DONE",
]);

export const taskPrioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]);

export const projectRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);

export const resourceIdSchema = z.uuid();

export const createWorkspaceSchema = z.strictObject({
  slug: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(160),
});

export const workspaceSchema = createWorkspaceSchema.extend({
  workspaceId: resourceIdSchema,
  createdAt: z.iso.datetime(),
});

export const createProjectSchema = z.strictObject({
  code: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z][A-Z0-9]*$/)),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().default(""),
});

export const projectSchema = createProjectSchema.extend({
  projectId: resourceIdSchema,
  workspaceId: resourceIdSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const createTaskSchema = z.strictObject({
  title: z.string().trim().min(1).max(240),
  priority: taskPrioritySchema.optional().default("NORMAL"),
  storyPoints: z.number().int().min(0).max(100).optional().default(0),
});

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

export const persistedTaskSchema = taskSchema.extend({
  projectId: resourceIdSchema,
  columnId: resourceIdSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const movePersistedTaskSchema = z.strictObject({
  targetStatus: taskStatusSchema,
  expectedVersion: z.number().int().positive(),
});
export type MovePersistedTaskCommand = z.infer<typeof movePersistedTaskSchema>;

export const domainEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.enum(["TASK_MOVED", "USER_MENTIONED", "SPRINT_DEADLINE"]),
  workspaceId: z.string().min(1),
  aggregateId: z.string().min(1),
  occurredAt: z.iso.datetime(),
  payload: z.record(z.string(), z.unknown()),
});

export type TaskDto = z.infer<typeof taskSchema>;
export type CreateWorkspaceCommand = z.infer<typeof createWorkspaceSchema>;
export type WorkspaceDto = z.infer<typeof workspaceSchema>;
export type CreateProjectCommand = z.infer<typeof createProjectSchema>;
export type ProjectDto = z.infer<typeof projectSchema>;
export type CreateTaskCommand = z.infer<typeof createTaskSchema>;
export type PersistedTaskDto = z.infer<typeof persistedTaskSchema>;
export type ProjectRole = z.infer<typeof projectRoleSchema>;
export type MoveTaskCommand = z.infer<typeof moveTaskCommandSchema>;
export type DomainEventDto = z.infer<typeof domainEventSchema>;
