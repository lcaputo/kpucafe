import { NextResponse } from 'next/server';
import { clearAuthCookies, getSession } from '@/lib/auth';
import { log } from '@/lib/logger';

export async function POST() {
  try {
    const session = await getSession();
    await clearAuthCookies();
    if (session) {
      log({ level: 'info', type: 'auth', action: 'logout', message: 'Sesión cerrada', userId: session.id });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
