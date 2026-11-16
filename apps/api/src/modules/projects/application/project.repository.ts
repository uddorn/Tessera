import type {
  CreateProjectCommand,
  CreateTaskCommand,
  CreateWorkspaceCommand,
  PersistedTaskDto,
  ProjectDto,
  WorkspaceDto,
} from '@tessera/shared';

export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');

export interface ProjectRepository {
  createWorkspace(command: CreateWorkspaceCommand): Promise<WorkspaceDto>;
  createProject(
    workspaceId: string,
    command: CreateProjectCommand,
  ): Promise<ProjectDto>;
  listProjects(workspaceId: string): Promise<ProjectDto[]>;
  createTask(
    projectId: string,
    command: CreateTaskCommand,
  ): Promise<PersistedTaskDto>;
  listTasks(projectId: string): Promise<PersistedTaskDto[]>;
}
