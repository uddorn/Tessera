import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type {
  CreateProjectCommand,
  CreateTaskCommand,
  CreateWorkspaceCommand,
  MovePersistedTaskCommand,
  UpdateTaskCommand,
  AttachmentCommand,
} from '@tessera/shared';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from './project.repository.js';
import { AuthService } from '../../../auth/auth.service.js';
import type { AuthUser } from '../../../auth/auth.types.js';

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly repository: ProjectRepository,
    private readonly auth: AuthService,
  ) {}

  createWorkspace(command: CreateWorkspaceCommand, user: AuthUser) {
    return this.repository.createWorkspace(command, user.id);
  }

  listWorkspaces(user: AuthUser) {
    return this.repository.listWorkspaces(user.id);
  }

  async createProject(
    workspaceId: string,
    command: CreateProjectCommand,
    user: AuthUser,
  ) {
    await this.auth.requireWorkspace(workspaceId, user.id, 'project:write');
    return this.repository.createProject(workspaceId, command, user.id);
  }

  async listProjects(workspaceId: string, user: AuthUser) {
    await this.auth.requireWorkspace(workspaceId, user.id, 'read');
    return this.repository.listProjects(workspaceId, user.id);
  }

  async deleteProject(projectId: string, user: AuthUser) {
    const role = await this.auth.requireProject(
      projectId,
      user.id,
      'project:write',
    );
    if (role !== 'OWNER')
      throw new ForbiddenException('Only project owner can delete it');
    return this.repository.deleteProject(projectId);
  }

  async removeMember(projectId: string, memberId: string, user: AuthUser) {
    await this.auth.requireProject(projectId, user.id, 'member:write');
    return this.auth.removeProjectMember(
      projectId,
      memberId,
      user.id,
      user.displayName,
    );
  }

  async createTask(
    projectId: string,
    command: CreateTaskCommand,
    user: AuthUser,
  ) {
    await this.auth.requireProject(projectId, user.id, 'task:write');
    return this.repository.createTask(projectId, command, user.displayName);
  }

  async listTasks(projectId: string, user: AuthUser) {
    await this.auth.requireProject(projectId, user.id, 'read');
    return this.repository.listTasks(projectId);
  }

  async getBoard(projectId: string, user: AuthUser) {
    await this.auth.requireProject(projectId, user.id, 'read');
    return this.repository.getBoard(projectId);
  }
  async moveTask(
    taskId: string,
    command: MovePersistedTaskCommand,
    user: AuthUser,
  ) {
    await this.auth.requireTask(taskId, user.id, 'task:write');
    return this.repository.moveTask(taskId, command, user.displayName);
  }

  async addMember(
    projectId: string,
    email: string,
    role: 'ADMIN' | 'MEMBER' | 'VIEWER',
    user: AuthUser,
  ) {
    await this.auth.requireProject(projectId, user.id, 'member:write');
    return this.auth.addProjectMember(projectId, email, role);
  }

  async myProjectRole(projectId: string, user: AuthUser) {
    return { role: await this.auth.projectRole(projectId, user.id) };
  }

  async listMembers(projectId: string, user: AuthUser) {
    await this.auth.requireProject(projectId, user.id, 'read');
    return this.auth.listProjectMembers(projectId);
  }

  async listActivity(projectId: string, user: AuthUser) {
    await this.auth.requireProject(projectId, user.id, 'read');
    return this.repository.listActivity(projectId);
  }

  async updateTask(taskId: string, command: UpdateTaskCommand, user: AuthUser) {
    await this.auth.requireTask(taskId, user.id, 'task:write');
    return this.repository.updateTask(taskId, command, user.displayName);
  }

  async deleteTask(taskId: string, expectedVersion: number, user: AuthUser) {
    await this.auth.requireTask(taskId, user.id, 'project:write');
    return this.repository.deleteTask(
      taskId,
      expectedVersion,
      user.displayName,
    );
  }

  async taskDiscussion(taskId: string, user: AuthUser) {
    await this.auth.requireTask(taskId, user.id, 'read');
    return this.repository.taskDiscussion(taskId);
  }

  async addComment(taskId: string, body: string, user: AuthUser) {
    await this.auth.requireTask(taskId, user.id, 'task:write');
    return this.repository.addComment(taskId, body, user.displayName);
  }

  async addAttachment(
    taskId: string,
    command: AttachmentCommand,
    user: AuthUser,
  ) {
    await this.auth.requireTask(taskId, user.id, 'task:write');
    return this.repository.addAttachment(taskId, command, user.displayName);
  }

  async getAttachment(taskId: string, attachmentId: string, user: AuthUser) {
    await this.auth.requireTask(taskId, user.id, 'read');
    return this.repository.getAttachment(taskId, attachmentId);
  }
}
