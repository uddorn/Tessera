import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Patch,
} from '@nestjs/common';
import {
  createProjectSchema,
  createTaskSchema,
  createWorkspaceSchema,
  resourceIdSchema,
  movePersistedTaskSchema,
  type MovePersistedTaskCommand,
  type CreateProjectCommand,
  type CreateTaskCommand,
  type CreateWorkspaceCommand,
} from '@tessera/shared';
import { ProjectsService } from '../application/projects.service.js';

@Controller()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post('workspaces')
  @HttpCode(HttpStatus.CREATED)
  createWorkspace(
    @Body({ schema: createWorkspaceSchema }) command: CreateWorkspaceCommand,
  ) {
    return this.projectsService.createWorkspace(command);
  }

  @Post('workspaces/:workspaceId/projects')
  @HttpCode(HttpStatus.CREATED)
  createProject(
    @Param('workspaceId', { schema: resourceIdSchema }) workspaceId: string,
    @Body({ schema: createProjectSchema }) command: CreateProjectCommand,
  ) {
    return this.projectsService.createProject(workspaceId, command);
  }

  @Get('workspaces/:workspaceId/projects')
  listProjects(
    @Param('workspaceId', { schema: resourceIdSchema }) workspaceId: string,
  ) {
    return this.projectsService.listProjects(workspaceId);
  }

  @Post('projects/:projectId/tasks')
  @HttpCode(HttpStatus.CREATED)
  createTask(
    @Param('projectId', { schema: resourceIdSchema }) projectId: string,
    @Body({ schema: createTaskSchema }) command: CreateTaskCommand,
  ) {
    return this.projectsService.createTask(projectId, command);
  }

  @Get('projects/:projectId/tasks')
  listTasks(
    @Param('projectId', { schema: resourceIdSchema }) projectId: string,
  ) {
    return this.projectsService.listTasks(projectId);
  }

  @Get('projects/:projectId/board')
  getBoard(
    @Param('projectId', { schema: resourceIdSchema }) projectId: string,
  ) {
    return this.projectsService.getBoard(projectId);
  }

  @Patch('tasks/:taskId/status')
  moveTask(
    @Param('taskId', { schema: resourceIdSchema }) taskId: string,
    @Body({ schema: movePersistedTaskSchema })
    command: MovePersistedTaskCommand,
  ) {
    return this.projectsService.moveTask(taskId, command);
  }
}
