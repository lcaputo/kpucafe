import Link from 'next/link';
import { Check, Coffee, Truck, CreditCard, Sparkles } from 'lucide-react';

interface SubscriptionSectionProps {
  plans: any[];
}

const HOW_IT_WORKS = [
  {
    icon: Coffee,
    title: 'Elige tu cafe',
    description: 'Selecciona tu cafe favorito, presentacion y tipo de molido',
  },
  {
    icon: CreditCard,
    title: 'Cobro automatico',
    description: 'Tu tarjeta se cobra automaticamente segun tu plan',
  },
  {
    icon: Truck,
    title: 'Recibe en casa',
    description: 'Envio gratis directamente a la puerta de tu casa',
  },
];

const howToJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'Cómo funciona la suscripción de café KPU',
  description: 'Recibe café de especialidad colombiano fresco en tu puerta de forma automática con nuestros planes de suscripción.',
  image: 'https://kpucafe.com/og-image.png',
  step: [
    {
      '@type': 'HowToStep',
      position: 1,
      name: 'Elige tu café',
      text: 'Selecciona tu café favorito, presentación y tipo de molido.',
    },
    {
      '@type': 'HowToStep',
      position: 2,
      name: 'Cobro automático',
      text: 'Tu tarjeta se cobra automáticamente según el plan elegido (mensual, bimestral o trimestral).',
    },
    {
      '@type': 'HowToStep',
      position: 3,
      name: 'Recibe en casa',
      text: 'Envío gratis directamente a la puerta de tu casa con café recién tostado.',
    },
  ],
};

export default function SubscriptionSection({ plans }: SubscriptionSectionProps) {
  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
    />
    <section
      id="suscripciones"
      aria-label="Planes de suscripcion"
      className="pt-32 pb-24 bg-gradient-coffee relative overflow-hidden"
    >
      {/* Top wave divider */}
      <div className="absolute top-0 left-0 right-0 leading-[0] pointer-events-none">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full block" aria-hidden="true">
          <path
            d="M0 0L60 7C120 13 240 27 360 33C480 40 600 40 720 37C840 33 960 27 1080 23C1200 20 1320 20 1380 20L1440 20V0H1380C1320 0 1200 0 1080 0C960 0 840 0 720 0C600 0 480 0 360 0C240 0 120 0 60 0H0Z"
            fill="hsl(30 25% 97%)"
          />
        </svg>
      </div>

      {/* Liquid ambient blobs */}
      <div className="absolute top-0 left-0 w-80 h-80 bg-primary/12 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/8 rounded-full blur-[80px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-6"
            style={{
              background: 'hsl(14 82% 53% / 0.18)',
              border: '1px solid hsl(14 82% 53% / 0.28)',
              color: 'hsl(14 82% 68%)',
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Suscripciones
          </div>
          <h2
            className="font-display font-bold text-secondary-foreground mb-4"
            style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}
          >
            Cafe fresco en tu puerta
          </h2>
          <p className="text-secondary-foreground/70 text-lg leading-relaxed">
            Suscribete y recibe cafe recien tostado directamente en tu hogar. Cobro automatico y
            envio gratis.
          </p>
        </div>

        {/* How it works */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {HOW_IT_WORKS.map(({ icon: Icon, title, description }, i) => (
            <div
              key={title}
              className="text-center p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1"
              style={{
                background: 'hsl(0 0% 100% / 0.06)',
                border: '1px solid hsl(0 0% 100% / 0.10)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{
                  background: 'hsl(14 82% 53% / 0.18)',
                  border: '1px solid hsl(14 82% 53% / 0.25)',
                }}
              >
                <Icon className="h-7 w-7 text-primary" />
              </div>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center mx-auto mb-3 text-xs font-bold"
                style={{ background: 'hsl(14 82% 53% / 0.2)', color: 'hsl(14 82% 65%)' }}
              >
                {i + 1}
              </div>
              <h3 className="font-display text-xl font-bold text-secondary-foreground mb-2">
                {title}
              </h3>
              <p className="text-secondary-foreground/60 text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        {/* Plans */}
        {plans.length === 0 ? (
          <p className="text-center text-secondary-foreground/50 text-lg">
            Proximamente planes de suscripcion disponibles.
          </p>
        ) : (
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {plans.map((plan: any, index: number) => (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-8 transition-all duration-300 animate-fade-in ${
                  plan.isPopular ? 'md:-mt-4' : ''
                }`}
                style={{
                  animationDelay: `${index * 0.1}s`,
                  ...(plan.isPopular
                    ? {
                        background: 'linear-gradient(145deg, hsl(14 82% 50%), hsl(20 75% 42%))',
                        boxShadow: '0 24px 64px hsl(14 82% 53% / 0.45), 0 0 0 1px hsl(14 82% 70% / 0.2)',
                      }
                    : {
                        background: 'hsl(0 0% 100% / 0.07)',
                        border: '1px solid hsl(0 0% 100% / 0.12)',
                        backdropFilter: 'blur(16px)',
                        boxShadow: '0 8px 32px hsl(0 0% 0% / 0.2)',
                      }),
                }}
              >
                {plan.isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-full"
                      style={{
                        background: 'var(--gradient-gold)',
                        color: 'white',
                        boxShadow: '0 4px 12px hsl(38 75% 48% / 0.5)',
                      }}
                    >
                      <Sparkles className="h-3 w-3" />
                      Mas popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3
                    className="font-display font-bold mb-1"
                    style={{
                      fontSize: '1.8rem',
                      color: plan.isPopular ? 'white' : 'hsl(var(--secondary-foreground))',
                    }}
                  >
                    {plan.name}
                  </h3>
                  <p
                    className="text-sm font-medium"
                    style={{
                      color: plan.isPopular
                        ? 'hsl(0 0% 100% / 0.75)'
                        : 'hsl(var(--secondary-foreground) / 0.55)',
                    }}
                  >
                    {plan.frequencyLabel}
                  </p>
                </div>

                <div className="text-center mb-7">
                  {plan.originalPrice && (
                    <div className="flex items-center justify-center gap-2 mb-1.5">
                      <span
                        className="text-sm line-through"
                        style={{
                          color: plan.isPopular
                            ? 'hsl(0 0% 100% / 0.5)'
                            : 'hsl(var(--secondary-foreground) / 0.4)',
                        }}
                      >
                        ${plan.originalPrice.toLocaleString('es-CO')}
                      </span>
                      {plan.discount && (
                        <span
                          className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                          style={
                            plan.isPopular
                              ? { background: 'hsl(0 0% 100% / 0.2)', color: 'white' }
                              : { background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }
                          }
                        >
                          -{plan.discount}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-baseline justify-center gap-1">
                    <span
                      className="font-display"
                      style={{
                        fontSize: '2.5rem',
                        color: plan.isPopular ? 'white' : 'hsl(var(--secondary-foreground))',
                      }}
                    >
                      ${plan.price.toLocaleString('es-CO')}
                    </span>
                    <span
                      className="text-sm"
                      style={{
                        color: plan.isPopular
                          ? 'hsl(0 0% 100% / 0.65)'
                          : 'hsl(var(--secondary-foreground) / 0.5)',
                      }}
                    >
                      /envio
                    </span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {(plan.features || []).map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={
                          plan.isPopular
                            ? { background: 'hsl(0 0% 100% / 0.2)' }
                            : { background: 'hsl(var(--primary) / 0.15)' }
                        }
                      >
                        <Check
                          className="h-3 w-3 flex-shrink-0"
                          style={{ color: plan.isPopular ? 'white' : 'hsl(var(--primary))' }}
                        />
                      </div>
                      <span style={{ color: plan.isPopular ? 'hsl(0 0% 100% / 0.88)' : 'hsl(var(--secondary-foreground) / 0.8)' }}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/suscribirse?plan=${plan.id}`}
                  className={`w-full py-3 rounded-full font-semibold transition-all duration-300 text-center block ${
                    plan.isPopular
                      ? 'hover:opacity-95 hover:scale-[1.02] active:scale-95'
                      : 'hover:scale-[1.02] active:scale-95'
                  }`}
                  style={
                    plan.isPopular
                      ? {
                          background: 'hsl(0 0% 100%)',
                          color: 'hsl(14 82% 50%)',
                          fontWeight: 700,
                          boxShadow: '0 4px 16px hsl(0 0% 0% / 0.15)',
                        }
                      : {
                          background: 'var(--gradient-warm)',
                          color: 'white',
                          boxShadow: 'var(--shadow-warm)',
                        }
                  }
                >
                  Suscribirse
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
    </>
  );
}
