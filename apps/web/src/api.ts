import type {
  CreateProjectCommand,
  CreateTaskCommand,
  CreateWorkspaceCommand,
  PersistedTaskDto,
  ProjectDto,
  WorkspaceDto,
  ActivityDto,
  AttachmentCommand,
  AttachmentDto,
  ProjectMemberDto,
  TaskCommentDto,
  UpdateTaskCommand,
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
    const translations: Record<string, string> = {
      "Target column WIP limit reached": "У цій колонці вичерпано WIP-ліміт.",
      "Task version is outdated":
        "Задачу вже змінили. Оновіть дошку й повторіть дію.",
      "Task state transition is not allowed":
        "Цей перехід між статусами заборонений.",
      "User must sign in once before being added":
        "Цей користувач має один раз увійти в Tessera.",
      "Owner role cannot be changed": "Роль власника не можна змінити.",
      "Task attachment limit reached": "До задачі можна додати до 10 файлів.",
      "Assignee must be a project member":
        "Виконавця потрібно додати до команди проєкту.",
    };
    const fallback =
      response.status === 401
        ? "Сеанс завершився. Увійдіть знову."
        : response.status === 403
          ? "Недостатньо прав для цієї дії."
          : response.status === 400
            ? "Перевірте дані форми."
            : response.status === 404
              ? "Запис не знайдено."
              : `Не вдалося виконати запит (HTTP ${response.status}).`;
    throw new Error((message && translations[message]) || fallback);
  }

  return response.json() as Promise<T>;
}

export function listWorkspaces() {
  return request<WorkspaceDto[]>("/workspaces");
}

export function listProjects(workspaceId: string) {
  return request<ProjectDto[]>(`/workspaces/${workspaceId}/projects`);
}

export function deleteProject(projectId: string) {
  return request<{ deleted: true }>(`/projects/${projectId}`, {
    method: "DELETE",
  });
}

export function removeProjectMember(projectId: string, memberId: string) {
  return request<{ removed: true }>(
    `/projects/${projectId}/members/${memberId}`,
    { method: "DELETE" },
  );
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

export function listMembers(projectId: string) {
  return request<ProjectMemberDto[]>(`/projects/${projectId}/members`);
}

export function listActivity(projectId: string) {
  return request<ActivityDto[]>(`/projects/${projectId}/activity`);
}

export function updateTask(taskId: string, command: UpdateTaskCommand) {
  return request<PersistedTaskDto>(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(command),
  });
}

export function deleteTask(taskId: string, expectedVersion: number) {
  return request<{ deleted: true }>(`/tasks/${taskId}`, {
    method: "DELETE",
    body: JSON.stringify({ expectedVersion }),
  });
}

export function getDiscussion(taskId: string) {
  return request<{ comments: TaskCommentDto[]; attachments: AttachmentDto[] }>(
    `/tasks/${taskId}/discussion`,
  );
}

export function addComment(taskId: string, body: string) {
  return request<TaskCommentDto>(`/tasks/${taskId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function addAttachment(taskId: string, command: AttachmentCommand) {
  return request<AttachmentDto>(`/tasks/${taskId}/attachments`, {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export function getAttachment(taskId: string, attachmentId: string) {
  return request<{ name: string; content: string }>(
    `/tasks/${taskId}/attachments/${attachmentId}`,
  );
}
