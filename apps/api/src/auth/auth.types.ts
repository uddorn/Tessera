import type { Request } from 'express';

export interface AuthUser {
  id: string;
  subject: string;
  email: string;
  displayName: string;
}

export type AuthenticatedRequest = Request & { user: AuthUser };
