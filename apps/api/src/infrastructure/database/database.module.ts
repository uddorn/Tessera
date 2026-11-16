import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DrizzleModule } from '@nestjs/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

@Module({
  imports: [
    DrizzleModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        drizzle,
        connection: {
          connectionString: config.getOrThrow<string>('DATABASE_URL'),
          max: 10,
        },
        schema,
      }),
    }),
  ],
  exports: [DrizzleModule],
})
export class DatabaseModule {}
