import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import type {
  CreateProjectCommand,
  CreateTaskCommand,
  CreateWorkspaceCommand,
  PersistedTaskDto,
  ProjectDto,
  WorkspaceDto,
  MovePersistedTaskCommand,
} from '@tessera/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import { TaskStateContext } from '../../../domain/task-state.pattern.js';
import type { Database } from '../../../infrastructure/database/database.js';
import { hasPostgresErrorCode } from '../../../infrastructure/database/postgres-error.js';
import {
  boardColumns,
  boards,
  projects,
  tasks,
  workspaces,
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
    priority: row.priority,
    status: row.status,
    storyPoints: row.storyPoints,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class DrizzleProjectRepository implements ProjectRepository {
  constructor(@InjectDrizzle() private readonly db: Database) {}

  async createWorkspace(
    command: CreateWorkspaceCommand,
  ): Promise<WorkspaceDto> {
    try {
      const [created] = await this.db
        .insert(workspaces)
        .values(command)
        .returning();

      return toWorkspaceDto(created);
    } catch (error) {
      if (hasPostgresErrorCode(error, '23505')) {
        throw new ResourceConflictError(
          `Workspace slug ${command.slug} is already in use`,
        );
      }
      throw error;
    }
  }

  async createProject(
    workspaceId: string,
    command: CreateProjectCommand,
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

  async listProjects(workspaceId: string): Promise<ProjectDto[]> {
    const rows = await this.db
      .select()
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId))
      .orderBy(asc(projects.createdAt));

    return rows.map(toProjectDto);
  }

  async createTask(
    projectId: string,
    command: CreateTaskCommand,
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
        .select({ id: boardColumns.id })
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
      const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
      if (!task) throw new ResourceNotFoundError('Task', taskId);
      if (task.version !== command.expectedVersion)
        throw new ResourceConflictError('Task version is outdated');
      try {
        new TaskStateContext().assertTransition(
          task.status,
          command.targetStatus,
        );
      } catch {
        throw new ResourceConflictError('Task state transition is not allowed');
      }
      const [target] = await tx
        .select({ id: boardColumns.id, wipLimit: boardColumns.wipLimit })
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
      const [{ total }] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(tasks)
        .where(eq(tasks.columnId, target.id));
      if (total >= target.wipLimit)
        throw new ResourceConflictError('Target column WIP limit reached');
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
      return toTaskDto(updated);
    });
  }
}
