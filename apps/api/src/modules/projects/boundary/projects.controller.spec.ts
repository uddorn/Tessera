import {
  type INestApplication,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthService } from '../../../auth/auth.service.js';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PROJECT_REPOSITORY } from '../application/project.repository.js';
import { ProjectsService } from '../application/projects.service.js';
import { ProjectsController } from './projects.controller.js';

describe('ProjectsController validation boundary', () => {
  let app: INestApplication<App>;
  const repository = {
    createWorkspace: vi.fn(),
    createProject: vi.fn(),
    listProjects: vi.fn(),
    createTask: vi.fn(),
    listTasks: vi.fn(),
  };
  const user = {
    id: '13708ac3-340a-405f-a700-6c0e89fe0632',
    subject: 'test-subject',
    email: 'test@example.com',
    displayName: 'Tester',
  };
  const auth = { requireWorkspace: vi.fn().mockResolvedValue('OWNER') };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        ProjectsService,
        { provide: PROJECT_REPOSITORY, useValue: repository },
        { provide: AuthService, useValue: auth },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: { user: typeof user }, _res: unknown, next: () => void) => {
      req.user = user;
      next();
    });
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid workspace data before calling the repository', async () => {
    await request(app.getHttpServer())
      .post('/workspaces')
      .send({ slug: 'Invalid Workspace', name: '' })
      .expect(400);

    expect(repository.createWorkspace).not.toHaveBeenCalled();
  });

  it('normalizes project codes before calling the repository', async () => {
    const workspaceId = '0c35d30b-f872-4c5d-ab4b-bed25df3d8c3';
    repository.createProject.mockResolvedValue({
      projectId: 'e5703b29-ce90-4091-9667-ec102dc6a5c0',
      workspaceId,
      code: 'TES',
      name: 'Tessera',
      description: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await request(app.getHttpServer())
      .post(`/workspaces/${workspaceId}/projects`)
      .send({ code: 'tes', name: 'Tessera' })
      .expect(201);

    expect(repository.createProject).toHaveBeenCalledWith(
      workspaceId,
      {
        code: 'TES',
        name: 'Tessera',
        description: '',
      },
      user.id,
    );
  });

  afterAll(async () => {
    await app.close();
  });
});
