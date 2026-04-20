import Image from 'next/image';
import { MapPin, Phone, Mail } from 'lucide-react';

const localBusinessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'KPU Cafe',
  image: 'https://kpucafe.com/assets/logo-kpu.png',
  telephone: '+57-324-320-8547',
  email: 'contacto@kpucafe.com',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Barranquilla',
    addressCountry: 'CO',
  },
  url: 'https://kpucafe.com',
  priceRange: '$$',
  sameAs: [],
};

export default function Footer() {
  return (
    <footer id="contacto" aria-label="Informacion de contacto y enlaces" className="bg-secondary text-secondary-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Image
                src="/assets/logo-kpu.png"
                alt="KPU Cafe"
                width={56}
                height={56}
                className="rounded-full object-cover"
              />
              <div>
                <span className="font-display text-2xl font-bold">KPU</span>
                <span className="text-primary font-display text-sm block">Cafe Colombiano</span>
              </div>
            </div>
            <p className="text-secondary-foreground/70 text-sm leading-relaxed">
              Desde las montanas del sur de Colombia, llevamos el mejor cafe de especialidad
              directamente a tu taza. 100% Arabica, tostado con pasion.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-display text-lg font-semibold mb-6">Enlaces</h3>
            <ul className="space-y-3">
              <li>
                <a
                  href="#productos"
                  className="text-secondary-foreground/70 hover:text-primary transition-colors text-sm"
                >
                  Productos
                </a>
              </li>
              <li>
                <a
                  href="#suscripciones"
                  className="text-secondary-foreground/70 hover:text-primary transition-colors text-sm"
                >
                  Suscripciones
                </a>
              </li>
              <li>
                <a
                  href="#nosotros"
                  className="text-secondary-foreground/70 hover:text-primary transition-colors text-sm"
                >
                  Sobre Nosotros
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-secondary-foreground/70 hover:text-primary transition-colors text-sm"
                >
                  Terminos y Condiciones
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-secondary-foreground/70 hover:text-primary transition-colors text-sm"
                >
                  Politica de Privacidad
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-display text-lg font-semibold mb-6">Contacto</h3>
            <ul className="space-y-4">
              <li className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="text-secondary-foreground/70 text-sm">324 320 8547</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="text-secondary-foreground/70 text-sm">contacto@kpucafe.com</span>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-secondary-foreground/70 text-sm">Barranquilla, Colombia</span>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="font-display text-lg font-semibold mb-6">Siguenos</h3>
            <div className="flex gap-4 mb-8">
              <a
                href="#"
                aria-label="Instagram"
                className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="Facebook"
                className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
