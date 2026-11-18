import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Patch,
  Req,
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
import { z } from 'zod';
import type { AuthenticatedRequest } from '../../../auth/auth.types.js';
import { ProjectsService } from '../application/projects.service.js';

@Controller()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post('workspaces')
  @HttpCode(HttpStatus.CREATED)
  createWorkspace(
    @Body({ schema: createWorkspaceSchema }) command: CreateWorkspaceCommand,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.createWorkspace(command, request.user);
  }

  @Get('workspaces')
  listWorkspaces(@Req() request: AuthenticatedRequest) {
    return this.projectsService.listWorkspaces(request.user);
  }

  @Post('workspaces/:workspaceId/projects')
  @HttpCode(HttpStatus.CREATED)
  createProject(
    @Param('workspaceId', { schema: resourceIdSchema }) workspaceId: string,
    @Body({ schema: createProjectSchema }) command: CreateProjectCommand,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.createProject(
      workspaceId,
      command,
      request.user,
    );
  }

  @Get('workspaces/:workspaceId/projects')
  listProjects(
    @Param('workspaceId', { schema: resourceIdSchema }) workspaceId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.listProjects(workspaceId, request.user);
  }

  @Post('projects/:projectId/tasks')
  @HttpCode(HttpStatus.CREATED)
  createTask(
    @Param('projectId', { schema: resourceIdSchema }) projectId: string,
    @Body({ schema: createTaskSchema }) command: CreateTaskCommand,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.createTask(projectId, command, request.user);
  }

  @Get('projects/:projectId/tasks')
  listTasks(
    @Param('projectId', { schema: resourceIdSchema }) projectId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.listTasks(projectId, request.user);
  }

  @Get('projects/:projectId/board')
  getBoard(
    @Param('projectId', { schema: resourceIdSchema }) projectId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.getBoard(projectId, request.user);
  }

  @Patch('tasks/:taskId/status')
  moveTask(
    @Param('taskId', { schema: resourceIdSchema }) taskId: string,
    @Body({ schema: movePersistedTaskSchema })
    command: MovePersistedTaskCommand,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.moveTask(taskId, command, request.user);
  }

  @Get('projects/:projectId/my-role')
  myRole(
    @Param('projectId', { schema: resourceIdSchema }) projectId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.myProjectRole(projectId, request.user);
  }

  @Post('projects/:projectId/members')
  addMember(
    @Param('projectId', { schema: resourceIdSchema }) projectId: string,
    @Body({
      schema: z.strictObject({
        email: z.email(),
        role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
      }),
    })
    command: { email: string; role: 'ADMIN' | 'MEMBER' | 'VIEWER' },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.addMember(
      projectId,
      command.email,
      command.role,
      request.user,
    );
  }
}
