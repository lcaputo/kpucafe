import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KPU Café — Café de Especialidad Colombiano',
    short_name: 'KPU Café',
    description: 'Café de especialidad 100% arábica de Colombia',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf8f5',
    theme_color: '#e8772e',
    icons: [
      { src: '/favicon.png', sizes: '192x192', type: 'image/png' },
    ],
  };
}
