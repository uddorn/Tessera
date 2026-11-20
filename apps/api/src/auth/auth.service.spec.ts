import { describe, expect, it } from 'vitest';
import { permits } from './auth.service.js';

describe('project role permissions', () => {
  it('keeps viewers read-only and members out of administration', () => {
    expect(permits('VIEWER', 'read')).toBe(true);
    expect(permits('VIEWER', 'task:write')).toBe(false);
    expect(permits('MEMBER', 'task:write')).toBe(true);
    expect(permits('MEMBER', 'member:write')).toBe(false);
    expect(permits('ADMIN', 'member:write')).toBe(true);
    expect(permits('OWNER', 'project:write')).toBe(true);
  });
});
