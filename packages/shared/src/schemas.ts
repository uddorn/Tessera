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

const taskDetails = {
  description: z.string().trim().max(4000),
  dueDate: z.iso.date().nullable(),
  assigneeId: resourceIdSchema.nullable(),
};

export const createTaskSchema = z.strictObject({
  title: z.string().trim().min(1).max(240),
  priority: taskPrioritySchema.optional().default("NORMAL"),
  storyPoints: z.number().int().min(0).max(100).optional().default(0),
  description: taskDetails.description.optional(),
  dueDate: taskDetails.dueDate.optional(),
  assigneeId: taskDetails.assigneeId.optional(),
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
  ...taskDetails,
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

export const updateTaskSchema = z.strictObject({
  title: createTaskSchema.shape.title.optional(),
  priority: taskPrioritySchema.optional(),
  storyPoints: z.number().int().min(0).max(100).optional(),
  description: taskDetails.description.optional(),
  dueDate: taskDetails.dueDate.optional(),
  assigneeId: taskDetails.assigneeId.optional(),
  expectedVersion: z.number().int().positive(),
});
export const taskVersionSchema = updateTaskSchema.pick({
  expectedVersion: true,
});
export const commentSchema = z.strictObject({
  body: z.string().trim().min(1).max(2000),
});
export const maxAttachmentBytes = 2 * 1024 * 1024;
export const attachmentSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[^\\/\p{Cc}]+$/u),
  content: z
    .base64()
    .min(4)
    .max(Math.ceil(maxAttachmentBytes / 3) * 4),
});

export interface ProjectMemberDto {
  userId: string;
  displayName: string;
  email: string;
  role: ProjectRole;
}

export interface TaskCommentDto {
  commentId: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface AttachmentDto {
  attachmentId: string;
  name: string;
  size: number;
  sha256: string;
}

export interface ActivityDto {
  eventId: string;
  kind: "CREATED" | "UPDATED" | "MOVED" | "DELETED" | "COMMENTED" | "ATTACHED";
  taskKey: string;
  actor: string;
  createdAt: string;
  fromStatus: PersistedTaskDto["status"] | null;
  toStatus: PersistedTaskDto["status"] | null;
}

export type UpdateTaskCommand = z.infer<typeof updateTaskSchema>;
export type AttachmentCommand = z.infer<typeof attachmentSchema>;

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
