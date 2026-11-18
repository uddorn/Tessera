import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDrizzle } from '@nestjs/drizzle';
import type { ProjectRole } from '@tessera/shared';
import { and, eq } from 'drizzle-orm';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Database } from '../infrastructure/database/database.js';
import {
  projectMemberships,
  projects,
  tasks,
  users,
  workspaceMemberships,
} from '../infrastructure/database/schema.js';
import type { AuthUser } from './auth.types.js';

const permissions = {
  VIEWER: ['read'],
  MEMBER: ['read', 'task:write'],
  ADMIN: ['read', 'task:write', 'project:write', 'member:write'],
  OWNER: ['read', 'task:write', 'project:write', 'member:write'],
} as const;
export type Permission =
  'read' | 'task:write' | 'project:write' | 'member:write';
export function permits(role: ProjectRole, action: Permission): boolean {
  return (permissions[role] as readonly string[]).includes(action);
}

@Injectable()
export class AuthService {
  private readonly issuer: string;
  private readonly clientId: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    @InjectDrizzle() private readonly db: Database,
    config: ConfigService,
  ) {
    this.issuer = config
      .getOrThrow<string>('KEYCLOAK_ISSUER')
      .replace(/\/$/, '');
    this.clientId = config.get<string>('KEYCLOAK_CLIENT_ID') ?? 'tessera-web';
    this.jwks = createRemoteJWKSet(
      new URL(`${this.issuer}/protocol/openid-connect/certs`),
    );
  }

  async authenticate(token: string): Promise<AuthUser> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.issuer,
      algorithms: ['RS256'],
      requiredClaims: ['sub', 'exp', 'iat'],
    });
    if (
      payload.azp !== this.clientId ||
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      !payload.email_verified
    ) {
      throw new Error('Invalid Tessera access token');
    }
    const email = payload.email.toLowerCase();
    const displayName =
      typeof payload.name === 'string'
        ? payload.name
        : typeof payload.preferred_username === 'string'
          ? payload.preferred_username
          : email;
    const [record] = await this.db
      .insert(users)
      .values({
        keycloakSubject: payload.sub,
        email,
        displayName: displayName.slice(0, 160),
        handle: `kc-${payload.sub
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 60)}`,
      })
      .onConflictDoUpdate({
        target: users.keycloakSubject,
        set: { displayName: displayName.slice(0, 160), updatedAt: new Date() },
      })
      .returning();
    return {
      id: record.id,
      subject: payload.sub,
      email: record.email,
      displayName: record.displayName,
    };
  }

  async workspaceRole(
    workspaceId: string,
    userId: string,
  ): Promise<ProjectRole> {
    const [membership] = await this.db
      .select({ role: workspaceMemberships.role })
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.workspaceId, workspaceId),
          eq(workspaceMemberships.userId, userId),
        ),
      );
    if (!membership) throw new ForbiddenException('Workspace access denied');
    return membership.role;
  }

  async projectRole(projectId: string, userId: string): Promise<ProjectRole> {
    const [membership] = await this.db
      .select({ role: projectMemberships.role })
      .from(projectMemberships)
      .where(
        and(
          eq(projectMemberships.projectId, projectId),
          eq(projectMemberships.userId, userId),
        ),
      );
    if (!membership) throw new ForbiddenException('Project access denied');
    return membership.role;
  }

  async requireWorkspace(
    workspaceId: string,
    userId: string,
    permission: Permission,
  ) {
    const role = await this.workspaceRole(workspaceId, userId);
    if (!permits(role, permission))
      throw new ForbiddenException('Insufficient workspace role');
    return role;
  }

  async requireProject(
    projectId: string,
    userId: string,
    permission: Permission,
  ) {
    const role = await this.projectRole(projectId, userId);
    if (!permits(role, permission))
      throw new ForbiddenException('Insufficient project role');
    return role;
  }

  async requireTask(taskId: string, userId: string, permission: Permission) {
    const [task] = await this.db
      .select({ projectId: tasks.projectId })
      .from(tasks)
      .where(eq(tasks.id, taskId));
    if (!task) throw new NotFoundException('Task not found');
    return this.requireProject(task.projectId, userId, permission);
  }

  async addProjectMember(projectId: string, email: string, role: ProjectRole) {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()));
    if (!user)
      throw new NotFoundException('User must sign in once before being added');
    const [existing] = await this.db
      .select({ role: projectMemberships.role })
      .from(projectMemberships)
      .where(
        and(
          eq(projectMemberships.projectId, projectId),
          eq(projectMemberships.userId, user.id),
        ),
      );
    if (existing?.role === 'OWNER')
      throw new ForbiddenException('Owner role cannot be changed');
    await this.db
      .insert(projectMemberships)
      .values({ projectId, userId: user.id, role })
      .onConflictDoUpdate({
        target: [projectMemberships.projectId, projectMemberships.userId],
        set: { role },
      });
    const [project] = await this.db
      .select({ workspaceId: projects.workspaceId })
      .from(projects)
      .where(eq(projects.id, projectId));
    await this.db
      .insert(workspaceMemberships)
      .values({ workspaceId: project.workspaceId, userId: user.id, role })
      .onConflictDoNothing();
    return { email, role };
  }
}
