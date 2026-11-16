import type {
  CreateProjectCommand,
  CreateTaskCommand,
  CreateWorkspaceCommand,
  PersistedTaskDto,
  ProjectDto,
  WorkspaceDto,
} from "@tessera/shared";

export type TaskStatus = PersistedTaskDto["status"];

export interface BoardColumnDto {
  columnId: string;
  title: string;
  status: TaskStatus;
  position: number;
  wipLimit: number;
  tasks: PersistedTaskDto[];
}

export interface BoardDto {
  boardId: string;
  projectId: string;
  name: string;
  columns: BoardColumnDto[];
}

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(". ")
      : body?.message;
    throw new Error(message ?? `HTTP ${response.status}: request failed`);
  }

  return response.json() as Promise<T>;
}

export function createWorkspace(command: CreateWorkspaceCommand) {
  return request<WorkspaceDto>("/workspaces", {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export function createProject(
  workspaceId: string,
  command: CreateProjectCommand,
) {
  return request<ProjectDto>(`/workspaces/${workspaceId}/projects`, {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export function getBoard(projectId: string) {
  return request<BoardDto>(`/projects/${projectId}/board`);
}

export function createTask(projectId: string, command: CreateTaskCommand) {
  return request<PersistedTaskDto>(`/projects/${projectId}/tasks`, {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export function moveTask(
  taskId: string,
  targetStatus: TaskStatus,
  expectedVersion: number,
) {
  return request<PersistedTaskDto>(`/tasks/${taskId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ targetStatus, expectedVersion }),
  });
}
