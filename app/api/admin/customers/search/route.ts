import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const q = req.nextUrl.searchParams.get('q')?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json([]);
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { profile: { fullName: { contains: q, mode: 'insensitive' } } },
          { profile: { phone: { contains: q } } },
        ],
      },
      include: { profile: true },
      take: 10,
    });

    const results = users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.profile?.fullName || null,
      phone: u.profile?.phone || null,
      address: u.profile?.address || null,
      city: u.profile?.city || null,
      department: u.profile?.department || null,
      registrationComplete: u.registrationComplete,
    }));

    return NextResponse.json(results);
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (err.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
