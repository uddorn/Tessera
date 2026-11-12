import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: '@tessera/api',
      sprint: 1,
      timestamp: new Date().toISOString(),
    };
  }

  getArchitecture() {
    return {
      style: 'modular-monolith',
      layers: ['boundary', 'application', 'domain', 'infrastructure'],
      migratedPatterns: ['Factory Method', 'Builder', 'Singleton', 'State'],
      infrastructure: ['PostgreSQL', 'Valkey', 'Garage', 'Keycloak', 'Mailpit'],
    };
  }
}
