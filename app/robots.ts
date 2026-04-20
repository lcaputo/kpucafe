import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/checkout', '/mis-pedidos', '/mis-suscripciones', '/pago-respuesta'],
      },
    ],
    sitemap: 'https://kpucafe.com/sitemap.xml',
  };
}
