import { PrismaClient } from '@prisma/client';
import * as bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@kpucafe.com';
  const password = 'admin123'; // cámbialo después

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('El usuario admin ya existe:', email);
    return;
  }

  const passwordHash = await bcryptjs.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      roles: {
        create: { role: 'admin' },
      },
      profile: {
        create: {
          fullName: 'Admin KPU',
        },
      },
    },
  });

  console.log('Usuario admin creado:', user.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
