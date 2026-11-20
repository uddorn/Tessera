import {
  Body,
  Controller,
  Delete,
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
  updateTaskSchema,
  taskVersionSchema,
  commentSchema,
  attachmentSchema,
  type UpdateTaskCommand,
  type AttachmentCommand,
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

  @Delete('projects/:projectId')
  deleteProject(
    @Param('projectId', { schema: resourceIdSchema }) projectId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.deleteProject(projectId, request.user);
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

  @Get('projects/:projectId/members')
  members(
    @Param('projectId', { schema: resourceIdSchema }) projectId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.listMembers(projectId, request.user);
  }

  @Get('projects/:projectId/activity')
  activity(
    @Param('projectId', { schema: resourceIdSchema }) projectId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.listActivity(projectId, request.user);
  }

  @Patch('tasks/:taskId')
  updateTask(
    @Param('taskId', { schema: resourceIdSchema }) taskId: string,
    @Body({ schema: updateTaskSchema }) command: UpdateTaskCommand,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.updateTask(taskId, command, request.user);
  }

  @Delete('tasks/:taskId')
  deleteTask(
    @Param('taskId', { schema: resourceIdSchema }) taskId: string,
    @Body({ schema: taskVersionSchema }) command: { expectedVersion: number },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.deleteTask(
      taskId,
      command.expectedVersion,
      request.user,
    );
  }

  @Get('tasks/:taskId/discussion')
  taskDiscussion(
    @Param('taskId', { schema: resourceIdSchema }) taskId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.taskDiscussion(taskId, request.user);
  }

  @Post('tasks/:taskId/comments')
  comment(
    @Param('taskId', { schema: resourceIdSchema }) taskId: string,
    @Body({ schema: commentSchema }) command: { body: string },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.addComment(taskId, command.body, request.user);
  }

  @Post('tasks/:taskId/attachments')
  attach(
    @Param('taskId', { schema: resourceIdSchema }) taskId: string,
    @Body({ schema: attachmentSchema }) command: AttachmentCommand,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.addAttachment(taskId, command, request.user);
  }

  @Get('tasks/:taskId/attachments/:attachmentId')
  attachment(
    @Param('taskId', { schema: resourceIdSchema }) taskId: string,
    @Param('attachmentId', { schema: resourceIdSchema }) attachmentId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.getAttachment(
      taskId,
      attachmentId,
      request.user,
    );
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

  @Delete('projects/:projectId/members/:memberId')
  removeMember(
    @Param('projectId', { schema: resourceIdSchema }) projectId: string,
    @Param('memberId', { schema: resourceIdSchema }) memberId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.removeMember(projectId, memberId, request.user);
  }
}
