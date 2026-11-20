import { Module } from '@nestjs/common';
import { PROJECT_REPOSITORY } from './application/project.repository.js';
import { ProjectsService } from './application/projects.service.js';
import { ProjectsController } from './boundary/projects.controller.js';
import { DrizzleProjectRepository } from './infrastructure/drizzle-project.repository.js';

@Module({
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    {
      provide: PROJECT_REPOSITORY,
      useClass: DrizzleProjectRepository,
    },
  ],
})
export class ProjectsModule {}
