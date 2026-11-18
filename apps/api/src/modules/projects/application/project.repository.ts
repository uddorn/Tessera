import type {
  CreateProjectCommand,
  CreateTaskCommand,
  CreateWorkspaceCommand,
  PersistedTaskDto,
  ProjectDto,
  WorkspaceDto,
  MovePersistedTaskCommand,
} from '@tessera/shared';

export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');

export interface ProjectRepository {
  createWorkspace(
    command: CreateWorkspaceCommand,
    ownerId: string,
  ): Promise<WorkspaceDto>;
  listWorkspaces(userId: string): Promise<WorkspaceDto[]>;
  createProject(
    workspaceId: string,
    command: CreateProjectCommand,
    ownerId: string,
  ): Promise<ProjectDto>;
  listProjects(workspaceId: string): Promise<ProjectDto[]>;
  createTask(
    projectId: string,
    command: CreateTaskCommand,
  ): Promise<PersistedTaskDto>;
  listTasks(projectId: string): Promise<PersistedTaskDto[]>;
  getBoard(projectId: string): Promise<unknown>;
  moveTask(
    taskId: string,
    command: MovePersistedTaskCommand,
  ): Promise<PersistedTaskDto>;
}
