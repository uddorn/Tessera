type ErrorWithCause = {
  code?: unknown;
  cause?: unknown;
};

/**
 * Drizzle wraps driver failures in DrizzleQueryError and exposes the original
 * PostgreSQL error through `cause`. Walk the cause chain so repository code
 * can translate database constraints into application-level errors.
 */
export function hasPostgresErrorCode(
  error: unknown,
  expectedCode: string,
): boolean {
  const visited = new Set<object>();
  let current = error;

  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current);
    const candidate = current as ErrorWithCause;

    if (candidate.code === expectedCode) {
      return true;
    }

    current = candidate.cause;
  }

  return false;
}
