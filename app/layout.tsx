import type { Metadata } from 'next';
import { Open_Sans, Paytone_One } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-open-sans',
  display: 'swap',
});

const paytoneOne = Paytone_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-paytone-one',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'https://kpucafe.com',
  ),
  title: {
    default: 'KPU Café — Café de Especialidad Colombiano',
    template: '%s | KPU Café',
  },
  description:
    'Café de especialidad 100% arábica de las montañas del sur de Colombia. Envíos a toda Colombia. Suscripciones disponibles.',
  keywords: [
    'café colombiano',
    'café de especialidad',
    'café arábica',
    'café en grano',
    'suscripción café',
    'KPU café',
  ],
  icons: {
    icon: '/lovable-uploads/b5ca903b-190c-42d1-bc05-a7b7aa79b434.png',
    apple: '/lovable-uploads/b5ca903b-190c-42d1-bc05-a7b7aa79b434.png',
  },
  authors: [{ name: 'KPU Café' }],
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    siteName: 'KPU Café',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'KPU Café — Café de Especialidad Colombiano' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@kpucafe',
    images: ['/og-image.png'],
  },
  alternates: {
    languages: {
      'es-CO': 'https://kpucafe.com',
      'es': 'https://kpucafe.com',
    },
  },
  robots: { index: true, follow: true },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'KPU Café',
  url: 'https://kpucafe.com',
  logo: 'https://kpucafe.com/og-image.png',
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+57-324-320-8547',
    contactType: 'customer service',
    areaServed: 'CO',
    availableLanguage: 'Spanish',
  },
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Barranquilla',
    addressCountry: 'CO',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${openSans.variable} ${paytoneOne.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-primary focus:text-primary-foreground"
        >
          Saltar al contenido
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
