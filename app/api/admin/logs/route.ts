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

    if (email && email.length > 254)
      return NextResponse.json({ message: 'Email demasiado largo' }, { status: 400 });

    const rawPage = parseInt(searchParams.get('page') || '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const page = isNaN(rawPage) ? 1 : Math.max(1, rawPage);
    const limit = isNaN(rawLimit) ? 50 : Math.min(200, Math.max(1, rawLimit));

    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    if (fromDate && isNaN(fromDate.getTime()))
      return NextResponse.json({ message: 'Fecha "from" inválida' }, { status: 400 });
    if (toDate && isNaN(toDate.getTime()))
      return NextResponse.json({ message: 'Fecha "to" inválida' }, { status: 400 });

    const skip = (page - 1) * limit;

    const where = {
      ...(level && { level }),
      ...(type && { type }),
      ...(email && { user: { email: { contains: email, mode: 'insensitive' as const } } }),
      ...((fromDate || toDate) && {
        createdAt: {
          ...(fromDate && { gte: fromDate }),
          ...(toDate && { lte: toDate }),
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
    if (message === 'Unauthorized') return NextResponse.json({ message }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ message }, { status: 403 });
    return NextResponse.json({ message }, { status: 500 });
  }
}
