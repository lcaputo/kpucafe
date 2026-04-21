import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn().mockResolvedValue({}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    appLog: {
      create: mockCreate,
    },
  },
}));

import { log } from '@/lib/logger';

describe('log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls prisma.appLog.create with provided params', async () => {
    log({
      level: 'info',
      type: 'auth',
      action: 'login_success',
      message: 'Usuario autenticado',
      userId: 'user-uuid-1',
    });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        level: 'info',
        type: 'auth',
        action: 'login_success',
        message: 'Usuario autenticado',
        userId: 'user-uuid-1',
      },
    });
  });

  it('does not throw when prisma.appLog.create rejects', async () => {
    mockCreate.mockRejectedValueOnce(new Error('DB connection lost'));
    expect(() =>
      log({ level: 'error', type: 'system', action: 'unhandled_error', message: 'Fallo crítico' })
    ).not.toThrow();
    await new Promise(resolve => setTimeout(resolve, 10));
  });
});
