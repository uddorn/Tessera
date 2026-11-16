import { randomUUID } from 'node:crypto';
import {
  type INestApplication,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { Test, type TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { ApplicationErrorFilter } from '../src/boundary/http/application-error.filter.js';
import type { Database } from '../src/infrastructure/database/database.js';
import { workspaces } from '../src/infrastructure/database/schema.js';

describe('Sprint 2 persistence (e2e)', () => {
  let app: INestApplication<App>;
  let database: Database;
  let workspaceId: string;
  let projectId: string;
  let taskId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    database = moduleFixture.get<Database>(getDrizzleToken());
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
          sprint: 2,
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
      .send({ targetStatus: 'DONE', expectedVersion: 1 })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/tasks/${taskId}/status`)
      .send({ targetStatus: 'IN_PROGRESS', expectedVersion: 1 })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ status: 'IN_PROGRESS', version: 2 });
      });
    await request(app.getHttpServer())
      .patch(`/api/tasks/${taskId}/status`)
      .send({ targetStatus: 'CODE_REVIEW', expectedVersion: 1 })
      .expect(409);
    const updated = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/board`)
      .expect(200);
    expect(updated.body.columns[1].tasks).toHaveLength(1);
    await request(app.getHttpServer())
      .get(`/api/projects/${randomUUID()}/board`)
      .expect(404);
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
      .expect(404);
  });

  afterAll(async () => {
    if (workspaceId) {
      await database.delete(workspaces).where(eq(workspaces.id, workspaceId));
    }
    await app.close();
  });
});
