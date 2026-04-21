import { prisma } from './prisma';

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
  prisma.appLog.create({ data: params }).catch(() => {});
}
