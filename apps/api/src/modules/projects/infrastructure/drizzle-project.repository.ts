import { createHash } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import type {
  CreateProjectCommand,
  CreateTaskCommand,
  CreateWorkspaceCommand,
  PersistedTaskDto,
  ProjectDto,
  WorkspaceDto,
  MovePersistedTaskCommand,
  UpdateTaskCommand,
  AttachmentCommand,
} from '@tessera/shared';
import { maxAttachmentBytes } from '@tessera/shared';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { TaskStateContext } from '../../../domain/task-state.pattern.js';
import {
  WipLimitPolicy,
  WipLimitViolation,
} from '../../../domain/wip-limit.policy.js';
import type { Database } from '../../../infrastructure/database/database.js';
import { hasPostgresErrorCode } from '../../../infrastructure/database/postgres-error.js';
import {
  boardColumns,
  boards,
  projectMemberships,
  projects,
  tasks,
  taskActivity,
  taskAttachments,
  taskComments,
  workspaces,
  workspaceMemberships,
  type ProjectRow,
  type TaskRow,
  type WorkspaceRow,
} from '../../../infrastructure/database/schema.js';
import {
  ResourceConflictError,
  ResourceNotFoundError,
} from '../application/application.errors.js';
import type { ProjectRepository } from '../application/project.repository.js';

const defaultColumns = [
  { title: 'Planned', status: 'PLANNED', position: 0, wipLimit: 100 },
  {
    title: 'In Progress',
    status: 'IN_PROGRESS',
    position: 1,
    wipLimit: 4,
  },
  {
    title: 'Code Review',
    status: 'CODE_REVIEW',
    position: 2,
    wipLimit: 3,
  },
  { title: 'Done', status: 'DONE', position: 3, wipLimit: 1000 },
] as const;

function toWorkspaceDto(row: WorkspaceRow): WorkspaceDto {
  return {
    workspaceId: row.id,
    slug: row.slug,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  };
}

function toProjectDto(row: ProjectRow): ProjectDto {
  return {
    projectId: row.id,
    workspaceId: row.workspaceId,
    code: row.code,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toTaskDto(row: TaskRow): PersistedTaskDto {
  return {
    taskId: row.id,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    columnId: row.columnId,
    taskKey: row.taskKey,
    title: row.title,
    description: row.description,
    dueDate: row.dueDate,
    assigneeId: row.assigneeId,
    priority: row.priority,
    status: row.status,
    storyPoints: row.storyPoints,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

async function recordActivity(
  tx: Transaction,
  task: TaskRow,
  actor: string,
  kind: typeof taskActivity.$inferInsert.kind,
  fromStatus?: TaskRow['status'],
) {
  await tx.insert(taskActivity).values({
    projectId: task.projectId,
    taskKey: task.taskKey,
    actor,
    kind,
    fromStatus,
    toStatus: kind === 'MOVED' ? task.status : undefined,
  });
}

async function lockTask(
  tx: Transaction,
  taskId: string,
  expectedVersion?: number,
) {
  const [task] = await tx
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .for('update');
  if (!task) throw new ResourceNotFoundError('Task', taskId);
  if (expectedVersion !== undefined && task.version !== expectedVersion)
    throw new ResourceConflictError('Task version is outdated');
  return task;
}

async function verifyAssignee(
  tx: Transaction,
  projectId: string,
  assigneeId?: string | null,
) {
  if (!assigneeId) return;
  const [member] = await tx
    .select({ id: projectMemberships.userId })
    .from(projectMemberships)
    .where(
      and(
        eq(projectMemberships.projectId, projectId),
        eq(projectMemberships.userId, assigneeId),
      ),
    );
  if (!member)
    throw new BadRequestException('Assignee must be a project member');
}

async function assertColumnCapacity(
  tx: Transaction,
  column: { id: string; title: string; wipLimit: number },
) {
  const [{ total }] = await tx
    .select({ total: sql<number>`count(*)::int` })
    .from(tasks)
    .where(eq(tasks.columnId, column.id));
  try {
    new WipLimitPolicy().assertCapacity(total, column.wipLimit, column.title);
  } catch (error) {
    if (!(error instanceof WipLimitViolation)) throw error;
    throw new ResourceConflictError('Target column WIP limit reached');
  }
}

@Injectable()
export class DrizzleProjectRepository implements ProjectRepository {
  constructor(@InjectDrizzle() private readonly db: Database) {}

  async createWorkspace(
    command: CreateWorkspaceCommand,
    ownerId: string,
  ): Promise<WorkspaceDto> {
    try {
      return await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(workspaces)
          .values(command)
          .returning();
        await tx
          .insert(workspaceMemberships)
          .values({ workspaceId: created.id, userId: ownerId, role: 'OWNER' });
        return toWorkspaceDto(created);
      });
    } catch (error) {
      if (hasPostgresErrorCode(error, '23505')) {
        throw new ResourceConflictError(
          `Workspace slug ${command.slug} is already in use`,
        );
      }
      throw error;
    }
  }

  async listWorkspaces(userId: string): Promise<WorkspaceDto[]> {
    const rows = await this.db
      .select({ workspace: workspaces })
      .from(workspaceMemberships)
      .innerJoin(
        workspaces,
        eq(workspaceMemberships.workspaceId, workspaces.id),
      )
      .where(eq(workspaceMemberships.userId, userId));
    return rows.map(({ workspace }) => toWorkspaceDto(workspace));
  }

  async createProject(
    workspaceId: string,
    command: CreateProjectCommand,
    ownerId: string,
  ): Promise<ProjectDto> {
    try {
      return await this.db.transaction(async (tx) => {
        const [createdProject] = await tx
          .insert(projects)
          .values({ workspaceId, ...command })
          .returning();

        const [board] = await tx
          .insert(boards)
          .values({
            projectId: createdProject.id,
            name: `${createdProject.name} Kanban`,
          })
          .returning({ id: boards.id });

        await tx.insert(boardColumns).values(
          defaultColumns.map((column) => ({
            boardId: board.id,
            ...column,
          })),
        );

        await tx.insert(projectMemberships).values({
          projectId: createdProject.id,
          userId: ownerId,
          role: 'OWNER',
        });

        return toProjectDto(createdProject);
      });
    } catch (error) {
      if (hasPostgresErrorCode(error, '23503')) {
        throw new ResourceNotFoundError('Workspace', workspaceId);
      }
      if (hasPostgresErrorCode(error, '23505')) {
        throw new ResourceConflictError(
          `Project code ${command.code} already exists in this workspace`,
        );
      }
      throw error;
    }
  }

  async listProjects(
    workspaceId: string,
    userId: string,
  ): Promise<ProjectDto[]> {
    const rows = await this.db
      .select({ project: projects })
      .from(projects)
      .innerJoin(
        projectMemberships,
        and(
          eq(projectMemberships.projectId, projects.id),
          eq(projectMemberships.userId, userId),
        ),
      )
      .where(eq(projects.workspaceId, workspaceId))
      .orderBy(asc(projects.createdAt));

    return rows.map(({ project }) => toProjectDto(project));
  }

  async deleteProject(projectId: string): Promise<{ deleted: true }> {
    return this.db.transaction(async (tx) => {
      const [project] = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
        .for('update');
      if (!project) throw new ResourceNotFoundError('Project', projectId);
      await tx.delete(tasks).where(eq(tasks.projectId, projectId));
      await tx.delete(projects).where(eq(projects.id, projectId));
      return { deleted: true };
    });
  }

  async createTask(
    projectId: string,
    command: CreateTaskCommand,
    actor: string,
  ): Promise<PersistedTaskDto> {
    return this.db.transaction(async (tx) => {
      const [projectCounter] = await tx
        .update(projects)
        .set({
          nextTaskNumber: sql`${projects.nextTaskNumber} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId))
        .returning({
          code: projects.code,
          workspaceId: projects.workspaceId,
          taskNumber: sql<number>`${projects.nextTaskNumber} - 1`,
        });

      if (!projectCounter) {
        throw new ResourceNotFoundError('Project', projectId);
      }

      const [plannedColumn] = await tx
        .select({
          id: boardColumns.id,
          title: boardColumns.title,
          wipLimit: boardColumns.wipLimit,
        })
        .from(boardColumns)
        .innerJoin(boards, eq(boardColumns.boardId, boards.id))
        .where(
          and(
            eq(boards.projectId, projectId),
            eq(boardColumns.status, 'PLANNED'),
          ),
        )
        .limit(1);

      if (!plannedColumn) {
        throw new ResourceNotFoundError(
          'Planned column for project',
          projectId,
        );
      }
      await assertColumnCapacity(tx, plannedColumn);
      await verifyAssignee(tx, projectId, command.assigneeId);

      const [created] = await tx
        .insert(tasks)
        .values({
          workspaceId: projectCounter.workspaceId,
          projectId,
          columnId: plannedColumn.id,
          taskKey: `${projectCounter.code}-${projectCounter.taskNumber}`,
          ...command,
        })
        .returning();

      await recordActivity(tx, created, actor, 'CREATED');
      return toTaskDto(created);
    });
  }

  async listTasks(projectId: string): Promise<PersistedTaskDto[]> {
    const rows = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(asc(tasks.createdAt));

    return rows.map(toTaskDto);
  }

  async getBoard(projectId: string) {
    const [board] = await this.db
      .select()
      .from(boards)
      .where(eq(boards.projectId, projectId));
    if (!board) throw new ResourceNotFoundError('Board for project', projectId);
    const columns = await this.db
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.boardId, board.id))
      .orderBy(asc(boardColumns.position));
    const projectTasks = await this.listTasks(projectId);
    return {
      boardId: board.id,
      projectId,
      name: board.name,
      columns: columns.map((column) => ({
        columnId: column.id,
        title: column.title,
        status: column.status,
        position: column.position,
        wipLimit: column.wipLimit,
        tasks: projectTasks.filter((task) => task.columnId === column.id),
      })),
    };
  }

  async moveTask(
    taskId: string,
    command: MovePersistedTaskCommand,
    actor: string,
  ): Promise<PersistedTaskDto> {
    return this.db.transaction(async (tx) => {
      const [initial] = await tx
        .select()
        .from(tasks)
        .where(eq(tasks.id, taskId));
      if (!initial) throw new ResourceNotFoundError('Task', taskId);
      // Serialize all board moves for the project, including WIP checks.
      await tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, initial.projectId))
        .for('update');
      const task = await lockTask(tx, taskId, command.expectedVersion);
      try {
        new TaskStateContext().assertTransition(
          task.status,
          command.targetStatus,
        );
      } catch {
        throw new ResourceConflictError('Task state transition is not allowed');
      }
      const [target] = await tx
        .select({
          id: boardColumns.id,
          title: boardColumns.title,
          wipLimit: boardColumns.wipLimit,
        })
        .from(boardColumns)
        .innerJoin(boards, eq(boards.id, boardColumns.boardId))
        .where(
          and(
            eq(boards.projectId, task.projectId),
            eq(boardColumns.status, command.targetStatus),
          ),
        );
      if (!target)
        throw new ResourceNotFoundError(
          'Target column for project',
          task.projectId,
        );
      await assertColumnCapacity(tx, target);
      const [updated] = await tx
        .update(tasks)
        .set({
          columnId: target.id,
          status: command.targetStatus,
          version: task.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId))
        .returning();
      await recordActivity(tx, updated, actor, 'MOVED', task.status);
      return toTaskDto(updated);
    });
  }

  updateTask(
    taskId: string,
    { expectedVersion, ...changes }: UpdateTaskCommand,
    actor: string,
  ) {
    return this.db.transaction(async (tx) => {
      const task = await lockTask(tx, taskId, expectedVersion);
      await verifyAssignee(tx, task.projectId, changes.assigneeId);
      const [updated] = await tx
        .update(tasks)
        .set({ ...changes, version: task.version + 1, updatedAt: new Date() })
        .where(eq(tasks.id, taskId))
        .returning();
      await recordActivity(tx, updated, actor, 'UPDATED');
      return toTaskDto(updated);
    });
  }

  deleteTask(taskId: string, expectedVersion: number, actor: string) {
    return this.db.transaction(async (tx) => {
      const task = await lockTask(tx, taskId, expectedVersion);
      await tx.delete(tasks).where(eq(tasks.id, taskId));
      await recordActivity(tx, task, actor, 'DELETED');
      return { deleted: true as const };
    });
  }

  async taskDiscussion(taskId: string) {
    const [comments, attachments] = await Promise.all([
      this.db
        .select({
          commentId: taskComments.id,
          author: taskComments.author,
          body: taskComments.body,
          createdAt: taskComments.createdAt,
        })
        .from(taskComments)
        .where(eq(taskComments.taskId, taskId))
        .orderBy(desc(taskComments.createdAt))
        .limit(100),
      this.db
        .select({
          attachmentId: taskAttachments.id,
          name: taskAttachments.name,
          size: taskAttachments.size,
          sha256: taskAttachments.sha256,
        })
        .from(taskAttachments)
        .where(eq(taskAttachments.taskId, taskId)),
    ]);
    return {
      comments: comments.map((comment) => ({
        ...comment,
        createdAt: comment.createdAt.toISOString(),
      })),
      attachments,
    };
  }

  addComment(taskId: string, body: string, actor: string) {
    return this.db.transaction(async (tx) => {
      const task = await lockTask(tx, taskId);
      const [comment] = await tx
        .insert(taskComments)
        .values({ taskId, body, author: actor })
        .returning({
          commentId: taskComments.id,
          body: taskComments.body,
          author: taskComments.author,
          createdAt: taskComments.createdAt,
        });
      await recordActivity(tx, task, actor, 'COMMENTED');
      return { ...comment, createdAt: comment.createdAt.toISOString() };
    });
  }

  addAttachment(
    taskId: string,
    { name, content }: AttachmentCommand,
    actor: string,
  ) {
    const bytes = Buffer.from(content, 'base64');
    if (bytes.length === 0 || bytes.length > maxAttachmentBytes)
      throw new BadRequestException(
        'Attachment must be between 1 byte and 2 MiB',
      );
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    return this.db.transaction(async (tx) => {
      const task = await lockTask(tx, taskId);
      const [{ total }] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(taskAttachments)
        .where(eq(taskAttachments.taskId, taskId));
      if (total >= 10)
        throw new ResourceConflictError('Task attachment limit reached');
      const [attachment] = await tx
        .insert(taskAttachments)
        .values({ taskId, name, content, sha256, size: bytes.length })
        .returning({
          attachmentId: taskAttachments.id,
          name: taskAttachments.name,
          size: taskAttachments.size,
          sha256: taskAttachments.sha256,
        });
      await recordActivity(tx, task, actor, 'ATTACHED');
      return attachment;
    });
  }

  async getAttachment(taskId: string, attachmentId: string) {
    const [attachment] = await this.db
      .select({ name: taskAttachments.name, content: taskAttachments.content })
      .from(taskAttachments)
      .where(
        and(
          eq(taskAttachments.taskId, taskId),
          eq(taskAttachments.id, attachmentId),
        ),
      );
    if (!attachment)
      throw new ResourceNotFoundError('Attachment', attachmentId);
    return attachment;
  }

  async listActivity(projectId: string) {
    const rows = await this.db
      .select()
      .from(taskActivity)
      .where(eq(taskActivity.projectId, projectId))
      .orderBy(desc(taskActivity.createdAt), desc(taskActivity.id))
      .limit(100);
    return rows.map(
      ({ id, kind, taskKey, actor, createdAt, fromStatus, toStatus }) => ({
        eventId: id,
        kind,
        taskKey,
        actor,
        createdAt: createdAt.toISOString(),
        fromStatus,
        toStatus,
      }),
    );
  }
}
