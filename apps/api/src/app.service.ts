import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { sql } from 'drizzle-orm';
import type { Database } from './infrastructure/database/database.js';

@Injectable()
export class AppService {
  constructor(@InjectDrizzle() private readonly db: Database) {}

  async getHealth() {
    await this.db.execute(sql`select 1`);

    return {
      status: 'ok',
      service: '@tessera/api',
      sprint: 2,
      database: 'up',
      timestamp: new Date().toISOString(),
    };
  }

  getArchitecture() {
    return {
      style: 'modular-monolith',
      layers: ['boundary', 'application', 'domain', 'infrastructure'],
      migratedPatterns: ['Factory Method', 'Builder', 'Singleton', 'State'],
      infrastructure: ['PostgreSQL', 'Valkey', 'Garage', 'Keycloak', 'Mailpit'],
      persistence: {
        orm: 'Drizzle ORM',
        database: 'PostgreSQL 18',
        strategy: 'repository adapters with versioned SQL migrations',
      },
    };
  }
}
