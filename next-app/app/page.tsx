import { prisma } from '@/lib/prisma';
import Header from '@/components/header';
import Hero from '@/components/hero';
import ProductsSection from '@/components/products-section';
import SubscriptionSection from '@/components/subscription-section';
import Footer from '@/components/footer';
import CartDrawer from '@/components/cart-drawer';
import type { Metadata } from 'next';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'KPU Cafe -- Cafe de Especialidad Colombiano',
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  const [products, categories, plans] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: { variants: { where: { isActive: true } }, category: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  const productsJsonLd = products.map((p) => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description || '',
    image: p.imageUrl || '',
    brand: { '@type': 'Brand', name: 'KPU Cafe' },
    offers: {
      '@type': 'Offer',
      price: p.basePrice,
      priceCurrency: 'COP',
      availability: 'https://schema.org/InStock',
    },
  }));

  // Serialize Prisma objects to plain objects for client components
  const plainProducts = JSON.parse(JSON.stringify(products));
  const plainCategories = JSON.parse(JSON.stringify(categories));
  const plainPlans = JSON.parse(JSON.stringify(plans));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productsJsonLd) }}
      />
      <div className="min-h-screen">
        <Header />
        <main id="main-content">
          <Hero />
          <ProductsSection products={plainProducts} categories={plainCategories} />
          <SubscriptionSection plans={plainPlans} />
        </main>
        <Footer />
        <CartDrawer />
      </div>
    </>
  );
}
