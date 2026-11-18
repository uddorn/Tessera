import type {
  CreateProjectCommand,
  CreateTaskCommand,
  CreateWorkspaceCommand,
  PersistedTaskDto,
  ProjectDto,
  WorkspaceDto,
} from "@tessera/shared";
import { accessToken } from "./auth";

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
  const token = await accessToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
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

export function listWorkspaces() {
  return request<WorkspaceDto[]>("/workspaces");
}

export function listProjects(workspaceId: string) {
  return request<ProjectDto[]>(`/workspaces/${workspaceId}/projects`);
}

export function myProjectRole(projectId: string) {
  return request<{ role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" }>(
    `/projects/${projectId}/my-role`,
  );
}

export function addProjectMember(
  projectId: string,
  email: string,
  role: "ADMIN" | "MEMBER" | "VIEWER",
) {
  return request<{ email: string; role: string }>(
    `/projects/${projectId}/members`,
    {
      method: "POST",
      body: JSON.stringify({ email, role }),
    },
  );
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
