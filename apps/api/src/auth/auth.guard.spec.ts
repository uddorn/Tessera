import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { AuthGuard } from './auth.guard.js';
import type { AuthService } from './auth.service.js';

function context(authorization?: string): ExecutionContext {
  const request = { headers: { authorization } };
  return {
    getHandler: () => () => null,
    getClass: () => class Test {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('authentication guard', () => {
  const auth = { authenticate: vi.fn() };
  const guard = new AuthGuard(auth as unknown as AuthService, new Reflector());

  it('rejects a request without a bearer token', async () => {
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(auth.authenticate).not.toHaveBeenCalled();
  });

  it('rejects an invalid token', async () => {
    auth.authenticate.mockRejectedValueOnce(new Error('bad signature'));
    await expect(
      guard.canActivate(context('Bearer invalid')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
