import type {
  CreateProjectCommand,
  CreateTaskCommand,
  CreateWorkspaceCommand,
  PersistedTaskDto,
  ProjectDto,
  WorkspaceDto,
  MovePersistedTaskCommand,
  UpdateTaskCommand,
  ActivityDto,
  AttachmentCommand,
  AttachmentDto,
  TaskCommentDto,
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
  listProjects(workspaceId: string, userId: string): Promise<ProjectDto[]>;
  deleteProject(projectId: string): Promise<{ deleted: true }>;
  createTask(
    projectId: string,
    command: CreateTaskCommand,
    actor: string,
  ): Promise<PersistedTaskDto>;
  listTasks(projectId: string): Promise<PersistedTaskDto[]>;
  getBoard(projectId: string): Promise<unknown>;
  moveTask(
    taskId: string,
    command: MovePersistedTaskCommand,
    actor: string,
  ): Promise<PersistedTaskDto>;
  updateTask(
    taskId: string,
    command: UpdateTaskCommand,
    actor: string,
  ): Promise<PersistedTaskDto>;
  deleteTask(
    taskId: string,
    expectedVersion: number,
    actor: string,
  ): Promise<{ deleted: true }>;
  taskDiscussion(
    taskId: string,
  ): Promise<{ comments: TaskCommentDto[]; attachments: AttachmentDto[] }>;
  addComment(
    taskId: string,
    body: string,
    actor: string,
  ): Promise<TaskCommentDto>;
  addAttachment(
    taskId: string,
    command: AttachmentCommand,
    actor: string,
  ): Promise<AttachmentDto>;
  getAttachment(
    taskId: string,
    attachmentId: string,
  ): Promise<{ name: string; content: string }>;
  listActivity(projectId: string): Promise<ActivityDto[]>;
}
