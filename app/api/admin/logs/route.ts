import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const level = searchParams.get('level') || undefined;
    const type = searchParams.get('type') || undefined;
    const email = searchParams.get('email') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    const where = {
      ...(level && { level }),
      ...(type && { type }),
      ...(email && { user: { email: { contains: email, mode: 'insensitive' as const } } }),
      ...((from || to) && {
        createdAt: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      }),
    };

    const [logs, total] = await Promise.all([
      prisma.appLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { email: true } } },
      }),
      prisma.appLog.count({ where }),
    ]);

    const formatted = logs.map(l => ({
      id: l.id,
      level: l.level,
      type: l.type,
      action: l.action,
      message: l.message,
      userEmail: l.user?.email ?? null,
      userId: l.userId,
      metadata: l.metadata,
      error: l.error,
      ipAddress: l.ipAddress,
      createdAt: l.createdAt,
    }));

    return NextResponse.json({
      logs: formatted,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (message === 'Unauthorized' || message === 'Forbidden')
      return NextResponse.json({ message }, { status: 401 });
    return NextResponse.json({ message }, { status: 500 });
  }
}
