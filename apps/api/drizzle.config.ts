import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { defineConfig } from 'drizzle-kit';

try {
  loadEnvFile(resolve(process.cwd(), '../../.env'));
} catch (error) {
  if (
    !error ||
    typeof error !== 'object' ||
    !('code' in error) ||
    error.code !== 'ENOENT'
  ) {
    throw error;
  }
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/database/schema.ts',
  out: './drizzle',
  dbCredentials: process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : undefined,
  strict: true,
  verbose: true,
});
