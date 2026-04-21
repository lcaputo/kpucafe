import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePassword, signAccessToken, signRefreshToken, setAuthCookies } from '@/lib/auth';
import { log } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: true, profile: true },
    });

    if (!user || !(await comparePassword(password, user.passwordHash))) {
      log({ level: 'warn', type: 'auth', action: 'login_failed', message: 'Credenciales incorrectas', metadata: { email } });
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const accessToken = await signAccessToken({ sub: user.id, email: user.email });
    const refreshToken = await signRefreshToken({ sub: user.id, email: user.email });
    await setAuthCookies(accessToken, refreshToken);

    log({ level: 'info', type: 'auth', action: 'login_success', message: 'Usuario autenticado', userId: user.id, metadata: { email: user.email } });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles.map((r) => r.role),
        profile: user.profile,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
