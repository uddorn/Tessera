import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import type {
  CreateProjectCommand,
  CreateTaskCommand,
  CreateWorkspaceCommand,
  PersistedTaskDto,
  ProjectDto,
  WorkspaceDto,
} from '@tessera/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../../infrastructure/database/database.js';
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

function isPostgresError(error: unknown, code: string): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === code
  );
}

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
      if (isPostgresError(error, '23505')) {
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
      if (isPostgresError(error, '23503')) {
        throw new ResourceNotFoundError('Workspace', workspaceId);
      }
      if (isPostgresError(error, '23505')) {
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
}
