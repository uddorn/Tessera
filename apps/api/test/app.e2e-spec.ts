import { randomUUID } from 'node:crypto';
import {
  type INestApplication,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { AuthGuard } from '../src/auth/auth.guard.js';
import { Test, type TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { ApplicationErrorFilter } from '../src/boundary/http/application-error.filter.js';
import type { Database } from '../src/infrastructure/database/database.js';
import {
  projectMemberships,
  users,
  workspaces,
} from '../src/infrastructure/database/schema.js';

describe('Coursework Kanban (e2e)', () => {
  let app: INestApplication<App>;
  let database: Database;
  let workspaceId: string;
  let projectId: string;
  let taskId: string;
  const userId = randomUUID();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { user: unknown } };
        }) => {
          context.switchToHttp().getRequest().user = {
            id: userId,
            subject: 'e2e',
            email: 'e2e@tessera.local',
            displayName: 'E2E',
          };
          return true;
        },
      })
      .compile();

    database = moduleFixture.get<Database>(getDrizzleToken());
    await database.insert(users).values({
      id: userId,
      keycloakSubject: `e2e-${userId}`,
      email: `${userId}@test.local`,
      displayName: 'E2E Tester',
      handle: `e2e-${userId}`,
    });
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    app.useGlobalFilters(new ApplicationErrorFilter());
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('reports PostgreSQL as healthy', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: 'ok',
          sprint: 3,
          database: 'up',
        });
      });
  });

  it('persists a workspace, project, board and sequential tasks', async () => {
    const slug = `tessera-${randomUUID().slice(0, 8)}`;

    const workspaceResponse = await request(app.getHttpServer())
      .post('/api/workspaces')
      .send({ slug, name: 'Tessera E2E' })
      .expect(201);

    workspaceId = workspaceResponse.body.workspaceId as string;
    expect(workspaceResponse.body).toMatchObject({
      slug,
      name: 'Tessera E2E',
    });

    const projectResponse = await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/projects`)
      .send({
        code: 'tes',
        name: 'Persistence Vertical Slice',
        description: 'Created by the Sprint 2 e2e test',
      })
      .expect(201);

    projectId = projectResponse.body.projectId as string;
    expect(projectResponse.body).toMatchObject({
      workspaceId,
      code: 'TES',
      name: 'Persistence Vertical Slice',
    });

    const firstTask = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/tasks`)
      .send({
        title: 'Create PostgreSQL schema',
        priority: 'HIGH',
        storyPoints: 5,
      })
      .expect(201);

    const secondTask = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: 'Verify repository adapter' })
      .expect(201);

    taskId = firstTask.body.taskId as string;

    expect(firstTask.body).toMatchObject({
      taskKey: 'TES-1',
      status: 'PLANNED',
      priority: 'HIGH',
      version: 1,
    });
    expect(secondTask.body).toMatchObject({
      taskKey: 'TES-2',
      status: 'PLANNED',
      priority: 'NORMAL',
      storyPoints: 0,
    });

    const projectsResponse = await request(app.getHttpServer())
      .get(`/api/workspaces/${workspaceId}/projects`)
      .expect(200);
    expect(projectsResponse.body).toHaveLength(1);

    const tasksResponse = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/tasks`)
      .expect(200);
    expect(tasksResponse.body).toHaveLength(2);
  });

  it('reads the board and applies guarded task transitions', async () => {
    const board = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/board`)
      .expect(200);
    expect(board.body.columns).toHaveLength(4);
    expect(board.body.columns[0].tasks).toHaveLength(2);
    await request(app.getHttpServer())
      .patch(`/api/tasks/${taskId}/status`)
      .send({ targetStatus: 'PLANNED', expectedVersion: 1 })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/tasks/${taskId}/status`)
      .send({ targetStatus: 'DONE', expectedVersion: 1 })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ status: 'DONE', version: 2 });
      });
    await request(app.getHttpServer())
      .patch(`/api/tasks/${taskId}/status`)
      .send({ targetStatus: 'CODE_REVIEW', expectedVersion: 1 })
      .expect(409);
    const updated = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/board`)
      .expect(200);
    expect(updated.body.columns[3].tasks).toHaveLength(1);
    await request(app.getHttpServer())
      .get(`/api/projects/${randomUUID()}/board`)
      .expect(403);
  });

  it('rejects invalid payloads, duplicate codes and missing parents', async () => {
    await request(app.getHttpServer())
      .post('/api/workspaces')
      .send({ slug: 'Invalid Workspace', name: '' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/workspaces/${workspaceId}/projects`)
      .send({ code: 'TES', name: 'Duplicate code' })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/api/workspaces/${randomUUID()}/projects`)
      .send({ code: 'NEW', name: 'Missing workspace' })
      .expect(403);
  });

  it('denies a viewer task writes while allowing board reads', async () => {
    await database
      .update(projectMemberships)
      .set({ role: 'VIEWER' })
      .where(eq(projectMemberships.projectId, projectId));
    await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/board`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: 'Forbidden' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/tasks/${taskId}`)
      .send({ title: 'Forbidden', expectedVersion: 2 })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/tasks/${taskId}/comments`)
      .send({ body: 'Forbidden' })
      .expect(403);
    await database
      .update(projectMemberships)
      .set({ role: 'OWNER' })
      .where(eq(projectMemberships.projectId, projectId));
  });

  it('persists a task lifecycle with discussion, attachments and audit history', async () => {
    const api = request(app.getHttpServer());
    const updated = await api
      .patch(`/api/tasks/${taskId}`)
      .send({
        expectedVersion: 2,
        description: 'Review the migration',
        dueDate: '2026-12-01',
        assigneeId: userId,
      })
      .expect(200);
    expect(updated.body).toMatchObject({
      version: 3,
      dueDate: '2026-12-01',
      assigneeId: userId,
      priority: 'HIGH',
      storyPoints: 5,
    });
    await api
      .patch(`/api/tasks/${taskId}`)
      .send({ expectedVersion: 2, title: 'Stale write' })
      .expect(409);
    await api
      .post(`/api/tasks/${taskId}/comments`)
      .send({ body: 'Reviewed with the team' })
      .expect(201);
    const content = Buffer.from('Fixture file').toString('base64');
    const { body: attachment } = await api
      .post(`/api/tasks/${taskId}/attachments`)
      .send({ name: 'review.txt', content })
      .expect(201);
    expect(attachment.sha256).toMatch(/^[a-f0-9]{64}$/);
    await api
      .get(`/api/tasks/${taskId}/attachments/${attachment.attachmentId}`)
      .expect(200, { name: 'review.txt', content });
    const { body: discussion } = await api
      .get(`/api/tasks/${taskId}/discussion`)
      .expect(200);
    expect(discussion.comments[0].body).toBe('Reviewed with the team');
    expect(discussion.attachments[0]).toMatchObject({
      name: 'review.txt',
      size: 12,
    });
    expect(discussion.attachments[0]).not.toHaveProperty('content');
    await api
      .delete(`/api/tasks/${taskId}`)
      .send({ expectedVersion: 2 })
      .expect(409);
    await api
      .delete(`/api/tasks/${taskId}`)
      .send({ expectedVersion: 3 })
      .expect(200);
    await api.get(`/api/tasks/${taskId}/discussion`).expect(404);
    const { body: activity } = await api
      .get(`/api/projects/${projectId}/activity`)
      .expect(200);
    expect(
      activity
        .filter((item: { taskKey: string }) => item.taskKey === 'TES-1')
        .map((item: { kind: string }) => item.kind),
    ).toEqual([
      'DELETED',
      'ATTACHED',
      'COMMENTED',
      'UPDATED',
      'MOVED',
      'CREATED',
    ]);
  });

  it('prevents concurrent requests from exceeding the column WIP limit', async () => {
    const api = request(app.getHttpServer());
    const entries = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        api
          .post(`/api/projects/${projectId}/tasks`)
          .send({ title: `WIP test ${index}` })
          .expect(201),
      ),
    );
    const moves = await Promise.all(
      entries.map(({ body }) =>
        api
          .patch(`/api/tasks/${body.taskId}/status`)
          .send({ expectedVersion: 1, targetStatus: 'IN_PROGRESS' }),
      ),
    );
    expect(moves.map(({ status }) => status).sort((a, b) => a - b)).toEqual([
      200, 200, 200, 200, 409,
    ]);
    expect(moves.find(({ status }) => status === 409)?.body.message).toBe(
      'Target column WIP limit reached',
    );
  });

  it('removes a member, clears assignments and restricts project deletion to the owner', async () => {
    const api = request(app.getHttpServer());
    const memberId = randomUUID();
    const email = `${memberId}@test.local`;
    await database.insert(users).values({
      id: memberId,
      keycloakSubject: `e2e-${memberId}`,
      email,
      displayName: 'Former member',
      handle: `e2e-${memberId}`,
    });
    await api
      .post(`/api/projects/${projectId}/members`)
      .send({ email, role: 'MEMBER' })
      .expect(201);
    const { body: board } = await api
      .get(`/api/projects/${projectId}/board`)
      .expect(200);
    const assignedTask = board.columns[0].tasks[0];
    await api
      .patch(`/api/tasks/${assignedTask.taskId}`)
      .send({ expectedVersion: assignedTask.version, assigneeId: memberId })
      .expect(200);
    await api
      .delete(`/api/projects/${projectId}/members/${userId}`)
      .expect(403);
    await api
      .delete(`/api/projects/${projectId}/members/${memberId}`)
      .expect(200, { removed: true });
    const { body: afterRemoval } = await api
      .get(`/api/projects/${projectId}/board`)
      .expect(200);
    expect(
      afterRemoval.columns[0].tasks.find(
        (task: { taskId: string }) => task.taskId === assignedTask.taskId,
      ).assigneeId,
    ).toBeNull();
    expect(
      afterRemoval.columns[0].tasks.find(
        (task: { taskId: string }) => task.taskId === assignedTask.taskId,
      ).version,
    ).toBe(assignedTask.version + 2);
    await database.delete(users).where(eq(users.id, memberId));

    await database
      .update(projectMemberships)
      .set({ role: 'ADMIN' })
      .where(eq(projectMemberships.projectId, projectId));
    await api.delete(`/api/projects/${projectId}`).expect(403);
    await database
      .update(projectMemberships)
      .set({ role: 'OWNER' })
      .where(eq(projectMemberships.projectId, projectId));
    await api
      .delete(`/api/projects/${projectId}`)
      .expect(200, { deleted: true });
    const { body: projects } = await api
      .get(`/api/workspaces/${workspaceId}/projects`)
      .expect(200);
    expect(projects).toHaveLength(0);
  });

  afterAll(async () => {
    if (workspaceId) {
      await database.delete(workspaces).where(eq(workspaces.id, workspaceId));
    }
    await database.delete(users).where(eq(users.id, userId));
    await app.close();
  });
});
