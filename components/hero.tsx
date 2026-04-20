import Image from 'next/image';

export default function Hero() {
  return (
    <section aria-label="Presentacion del cafe KPU" className="relative min-h-screen flex items-center overflow-hidden bg-gradient-coffee border-0">
      {/* Background Pattern */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url(/assets/pattern-mountains.png)`,
          backgroundSize: 'cover',
          backgroundPosition: 'bottom',
        }}
      />

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/90 via-secondary/70 to-primary/20" />

      <div className="container mx-auto px-4 pt-24 pb-12 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="text-center lg:text-left">
            <span className="inline-block px-4 py-2 bg-primary/20 text-primary rounded-full text-sm font-semibold mb-6 animate-fade-in">
              Cafe de especialidad colombiano
            </span>

            <h1
              className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-secondary-foreground leading-tight mb-6 animate-fade-in"
              style={{ animationDelay: '0.1s' }}
            >
              El mejor cafe de las{' '}
              <span className="text-primary">montanas colombianas</span>
            </h1>

            <p
              className="text-secondary-foreground/80 text-lg md:text-xl max-w-xl mx-auto lg:mx-0 mb-8 animate-fade-in"
              style={{ animationDelay: '0.2s' }}
            >
              Notas de miel, canela y frutos amarillos. Desde las montanas del sur de Colombia
              directamente a tu taza.
            </p>

            <div
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in"
              style={{ animationDelay: '0.3s' }}
            >
              <a href="#productos" className="btn-kpu text-center">
                Ver productos
              </a>
              <a
                href="#suscripciones"
                className="px-8 py-4 border-2 border-primary text-primary font-semibold rounded-full hover:bg-primary hover:text-primary-foreground transition-all duration-300 text-center"
              >
                Suscribirse
              </a>
            </div>

            {/* Features */}
            <div className="grid grid-cols-3 gap-6 mt-12 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="text-center">
                <div className="text-3xl font-display font-bold text-primary">100%</div>
                <div className="text-secondary-foreground/70 text-sm">Arabica</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-display font-bold text-primary">1.800m</div>
                <div className="text-secondary-foreground/70 text-sm">Altitud</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-display font-bold text-primary">Fresco</div>
                <div className="text-secondary-foreground/70 text-sm">Tostado</div>
              </div>
            </div>
          </div>

          {/* Product Image */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative animate-float">
              <div className="absolute inset-0 bg-primary/30 rounded-3xl blur-3xl scale-75" />
              <Image
                src="/lovable-uploads/e6674358-dd79-4b5f-bf86-43889f8eb283.jpg"
                alt="KPU Cafe Colombiano - Amarillo Exclusivo 500gr"
                width={500}
                height={500}
                priority
                className="relative z-10 max-w-sm md:max-w-md lg:max-w-lg rounded-2xl shadow-elevated"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0 leading-[0] -mb-px">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
          <path
            d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
            fill="hsl(30 25% 97%)"
          />
        </svg>
      </div>
    </section>
  );
}
