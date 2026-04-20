import { Check, Coffee, Truck, CreditCard } from 'lucide-react';

interface SubscriptionSectionProps {
  plans: any[];
}

export default function SubscriptionSection({ plans }: SubscriptionSectionProps) {
  return (
    <section id="suscripciones" className="py-20 bg-gradient-coffee relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block px-4 py-2 bg-primary/20 text-primary rounded-full text-sm font-semibold mb-4">
            Suscripciones
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary-foreground mb-4">
            Cafe fresco en tu puerta
          </h2>
          <p className="text-secondary-foreground/80 text-lg">
            Suscribete y recibe cafe recien tostado directamente en tu hogar. Cobro automatico y
            envio gratis.
          </p>
        </div>

        {/* How it Works */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Coffee className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-display text-lg font-semibold text-secondary-foreground mb-2">
              Elige tu cafe
            </h3>
            <p className="text-secondary-foreground/70 text-sm">
              Selecciona tu cafe favorito, presentacion y tipo de molido
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CreditCard className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-display text-lg font-semibold text-secondary-foreground mb-2">
              Cobro automatico
            </h3>
            <p className="text-secondary-foreground/70 text-sm">
              Tu tarjeta se cobra automaticamente segun tu plan
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Truck className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-display text-lg font-semibold text-secondary-foreground mb-2">
              Recibe en casa
            </h3>
            <p className="text-secondary-foreground/70 text-sm">
              Envio gratis a la puerta de tu casa
            </p>
          </div>
        </div>

        {/* Plans */}
        {plans.length === 0 ? (
          <p className="text-center text-secondary-foreground/60">
            Proximamente planes de suscripcion disponibles.
          </p>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan: any, index: number) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-8 transition-all duration-300 hover:-translate-y-2 animate-fade-in ${
                  plan.isPopular
                    ? 'bg-primary text-primary-foreground shadow-warm scale-105'
                    : 'bg-card text-card-foreground shadow-elevated'
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {plan.isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-xs font-bold px-4 py-1 rounded-full">
                    Mas popular
                  </span>
                )}

                <div className="text-center mb-6">
                  <h3 className="font-display text-2xl font-bold mb-1">{plan.name}</h3>
                  <p
                    className={`text-sm ${plan.isPopular ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}
                  >
                    {plan.frequencyLabel}
                  </p>
                </div>

                <div className="text-center mb-6">
                  {plan.originalPrice && (
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <span
                        className={`text-sm line-through ${plan.isPopular ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}
                      >
                        ${plan.originalPrice.toLocaleString('es-CO')}
                      </span>
                      {plan.discount && (
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            plan.isPopular ? 'bg-primary-foreground/20' : 'bg-primary/10 text-primary'
                          }`}
                        >
                          -{plan.discount}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-baseline justify-center">
                    <span className="text-4xl font-display font-bold">
                      ${plan.price.toLocaleString('es-CO')}
                    </span>
                    <span
                      className={`text-sm ml-1 ${plan.isPopular ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}
                    >
                      /envio
                    </span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {(plan.features || []).map((feature: string, i: number) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <Check
                        className={`h-5 w-5 flex-shrink-0 ${plan.isPopular ? 'text-primary-foreground' : 'text-primary'}`}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className={`w-full py-3 rounded-full font-semibold transition-all duration-300 ${
                    plan.isPopular
                      ? 'bg-primary-foreground text-primary hover:bg-primary-foreground/90'
                      : 'bg-primary text-primary-foreground hover:shadow-warm'
                  }`}
                >
                  Suscribirse
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
