import Image from 'next/image';
import { Coffee, Mountain, Leaf } from 'lucide-react';

export default function Hero() {
  return (
    <section
      aria-label="Presentacion del cafe KPU"
      className="relative min-h-screen flex items-center overflow-hidden bg-gradient-hero border-0"
    >
      {/* Background image */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `url(/assets/pattern-mountains.png)`,
          backgroundSize: 'cover',
          backgroundPosition: 'bottom',
        }}
      />

      {/* Liquid glass ambient blobs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-liquid-pulse pointer-events-none" />
      <div className="absolute bottom-1/3 -right-24 w-80 h-80 bg-accent/15 rounded-full blur-[100px] animate-liquid-pulse pointer-events-none" style={{ animationDelay: '2s' }} />
      <div className="absolute top-2/3 left-1/3 w-64 h-64 bg-primary/10 rounded-full blur-[80px] animate-liquid-pulse pointer-events-none" style={{ animationDelay: '4s' }} />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[hsl(15_45%_10%/0.6)]" />

      <div className="container mx-auto px-4 pt-28 pb-16 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-4 animate-fade-in"
              style={{
                background: 'hsl(14 82% 53% / 0.15)',
                border: '1px solid hsl(14 82% 53% / 0.3)',
                color: 'hsl(14 82% 65%)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <Leaf className="h-3.5 w-3.5" />
              Cafe de especialidad colombiano
            </div>

            {/* Headline — Amatic SC at full glory */}
            <h1
              className="font-display font-bold text-secondary-foreground leading-[1.05] mb-6 animate-fade-in"
              style={{
                fontSize: 'clamp(3.5rem, 8vw, 4rem)',
                animationDelay: '0.1s',
              }}
            >
              El mejor cafe de las{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: 'var(--gradient-warm)' }}
              >
                montanas colombianas
              </span>
            </h1>

            <p
              className="text-secondary-foreground/75 text-lg md:text-xl max-w-xl mx-auto lg:mx-0 mb-4 leading-relaxed animate-fade-in"
              style={{ animationDelay: '0.2s' }}
            >
              Notas de miel, canela y frutos amarillos. Desde las montanas del sur de Colombia
              directamente a tu taza.
            </p>

            {/* CTAs */}
            <div
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in"
              style={{ animationDelay: '0.3s' }}
            >
              <a href="#productos" className="btn-kpu">
                <Coffee className="h-4 w-4" />
                Ver productos
              </a>
              <a href="#suscripciones" className="btn-kpu-outline-light">
                Ver Suscripciones
              </a>
            </div>

          </div>

          {/* Product image */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative animate-float">
              {/* Glow rings */}
              <div className="absolute inset-0 bg-primary/25 rounded-3xl blur-3xl scale-90 animate-liquid-pulse" />
              <div className="absolute inset-4 bg-accent/15 rounded-3xl blur-2xl scale-75" style={{ animationDelay: '1s' }} />

              {/* Glass frame */}
              <div
                className="relative rounded-3xl p-2"
                style={{
                  background: 'hsl(0 0% 100% / 0.08)',
                  border: '1px solid hsl(0 0% 100% / 0.15)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <Image
                  src="/lovable-uploads/e6674358-dd79-4b5f-bf86-43889f8eb283.jpg"
                  alt="KPU Cafe Colombiano - Amarillo Exclusivo 500gr"
                  width={480}
                  height={480}
                  priority
                  sizes="(max-width: 768px) 300px, (max-width: 1024px) 384px, 480px"
                  className="relative z-10 max-w-[300px] md:max-w-sm lg:max-w-md rounded-2xl object-cover"
                  style={{ boxShadow: '0 24px 64px hsl(0 0% 0% / 0.4)' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wave divider */}
      <div className="absolute bottom-0 left-0 right-0 leading-[0] -mb-px pointer-events-none">
        <svg
          viewBox="0 0 1440 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full block"
          aria-hidden="true"
        >
          <path
            d="M0 80L60 73C120 67 240 53 360 47C480 40 600 40 720 43C840 47 960 53 1080 57C1200 60 1320 60 1380 60L1440 60V80H1380C1320 80 1200 80 1080 80C960 80 840 80 720 80C600 80 480 80 360 80C240 80 120 80 60 80H0Z"
            fill="hsl(30 25% 97%)"
          />
        </svg>
      </div>
    </section>
  );
}
