import { prisma } from '@/lib/prisma';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogType = 'auth' | 'order' | 'payment' | 'subscription' | 'admin' | 'system';

export interface LogParams {
  level: LogLevel;
  type: LogType;
  action: string;
  message: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  ipAddress?: string;
}

export function log(params: LogParams): void {
  prisma.appLog.create({
    data: {
      level: params.level,
      type: params.type,
      action: params.action,
      message: params.message,
      userId: params.userId,
      metadata: params.metadata as any,
      error: params.error,
      ipAddress: params.ipAddress,
    },
  }).catch(() => {});
}
