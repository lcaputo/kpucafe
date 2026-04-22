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
  title: 'KPU Café — Café de Especialidad Colombiano',
  description: 'Café de especialidad 100% arábica de las montañas del sur de Colombia. Envíos a toda Colombia. Suscripciones disponibles.',
  alternates: { canonical: 'https://kpucafe.com/' },
  openGraph: {
    url: 'https://kpucafe.com',
    title: 'KPU Café — Café de Especialidad Colombiano',
    description: 'Café de especialidad 100% arábica de las montañas del sur de Colombia. Envíos a toda Colombia. Suscripciones disponibles.',
  },
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

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'KPU Café',
    url: 'https://kpucafe.com',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: 'https://kpucafe.com/?q={search_term_string}' },
      'query-input': 'required name=search_term_string',
    },
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: '¿Qué es el café de especialidad?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'El café de especialidad es café de alta calidad evaluado con 80 puntos o más en la escala de la Specialty Coffee Association. KPU Café ofrece café 100% arábica tostado artesanalmente desde las montañas del sur de Colombia.',
        },
      },
      {
        '@type': 'Question',
        name: '¿De dónde viene el café KPU?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Nuestro café 100% arábica proviene de las montañas del sur de Colombia, una de las regiones cafeteras más reconocidas del mundo por su clima, altitud y suelos volcánicos.',
        },
      },
      {
        '@type': 'Question',
        name: '¿Cuál es el tiempo de entrega?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Realizamos envíos a toda Colombia. El tiempo de entrega es de 3 a 5 días hábiles. Ofrecemos envío gratis en compras superiores a $100.000 COP.',
        },
      },
      {
        '@type': 'Question',
        name: '¿Cómo funcionan las suscripciones de café?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Elige tu café favorito y un plan de suscripción (mensual, bimestral o trimestral). Tu tarjeta se cobra automáticamente y recibes café fresco en tu puerta. Puedes cancelar en cualquier momento sin penalidades.',
        },
      },
      {
        '@type': 'Question',
        name: '¿Puedo cancelar mi suscripción?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sí, puedes pausar o cancelar tu suscripción en cualquier momento desde tu perfil, sin cobros adicionales ni penalidades.',
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productsJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
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
