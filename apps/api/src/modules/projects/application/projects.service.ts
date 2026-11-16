import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateProjectCommand,
  CreateTaskCommand,
  CreateWorkspaceCommand,
} from '@tessera/shared';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from './project.repository.js';

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly repository: ProjectRepository,
  ) {}

  createWorkspace(command: CreateWorkspaceCommand) {
    return this.repository.createWorkspace(command);
  }

  createProject(workspaceId: string, command: CreateProjectCommand) {
    return this.repository.createProject(workspaceId, command);
  }

  listProjects(workspaceId: string) {
    return this.repository.listProjects(workspaceId);
  }

  createTask(projectId: string, command: CreateTaskCommand) {
    return this.repository.createTask(projectId, command);
  }

  listTasks(projectId: string) {
    return this.repository.listTasks(projectId);
  }
}
