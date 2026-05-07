import { prisma } from '@/lib/prisma';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogType = 'auth' | 'order' | 'payment' | 'subscription' | 'admin' | 'system' | 'delivery';

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

const CONSOLE_FN: Record<LogLevel, (...args: any[]) => void> = {
  info: console.log,
  warn: console.warn,
  error: console.error,
};

export function log(params: LogParams): void {
  // Print to terminal for delivery/webhook and error events
  if (params.type === 'delivery' || params.level === 'error') {
    const fn = CONSOLE_FN[params.level];
    const prefix = `[${params.level.toUpperCase()}] [${params.type}/${params.action}]`;
    fn(prefix, params.message);
    if (params.metadata) fn('  metadata:', JSON.stringify(params.metadata, null, 2));
    if (params.error) fn('  error:', params.error);
  }

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
