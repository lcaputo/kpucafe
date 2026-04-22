import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://kpucafe.com';

  const [products, plans] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, updatedAt: true },
    }),
    prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      select: { id: true, updatedAt: true },
    }),
  ]);

  return [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/auth`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/mis-pedidos`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/mis-suscripciones`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    ...products.map((p) => ({
      url: `${base}/#productos`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...plans.map((p) => ({
      url: `${base}/#suscripciones`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
