import { Test, TestingModule } from '@nestjs/testing';
import { getDrizzleToken } from '@nestjs/drizzle';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: getDrizzleToken(),
          useValue: {
            execute: vi.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports a healthy Sprint 3 API with PostgreSQL', async () => {
      await expect(appController.getHealth()).resolves.toMatchObject({
        status: 'ok',
        service: '@tessera/api',
        sprint: 3,
        database: 'up',
      });
    });
  });
});
