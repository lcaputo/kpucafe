import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken, hashPassword, signAccessToken, signRefreshToken, setAuthCookies } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password || password.length < 6) {
      return NextResponse.json(
        { message: 'Token y contrasena (min 6 caracteres) son requeridos' },
        { status: 400 }
      );
    }

    let payload: { sub: string; email: string };
    try {
      payload = await verifyAccessToken(token);
    } catch {
      return NextResponse.json({ message: 'Token invalido o expirado' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
    }
    if (user.registrationComplete) {
      return NextResponse.json({ message: 'Este usuario ya completo su registro' }, { status: 400 });
    }

    const hashed = await hashPassword(password);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashed,
        registrationComplete: true,
      },
    });

    const accessToken = await signAccessToken({ sub: user.id, email: user.email });
    const refreshToken = await signRefreshToken({ sub: user.id, email: user.email });
    await setAuthCookies(accessToken, refreshToken);

    return NextResponse.json({ message: 'Registro completado exitosamente' });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Error interno' }, { status: 500 });
  }
}
