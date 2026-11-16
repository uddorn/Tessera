import { describe, expect, it } from 'vitest';
import { hasPostgresErrorCode } from './postgres-error.js';

describe('hasPostgresErrorCode', () => {
  it('recognizes a direct PostgreSQL driver error', () => {
    expect(hasPostgresErrorCode({ code: '23505' }, '23505')).toBe(true);
  });

  it('recognizes an error wrapped by Drizzle', () => {
    const driverError = Object.assign(new Error('duplicate key'), {
      code: '23505',
    });
    const drizzleError = new Error('query failed', { cause: driverError });

    expect(hasPostgresErrorCode(drizzleError, '23505')).toBe(true);
  });

  it('returns false for a different code or a cyclic cause chain', () => {
    const error: { code: string; cause?: unknown } = { code: '23503' };
    error.cause = error;

    expect(hasPostgresErrorCode(error, '23505')).toBe(false);
  });
});
