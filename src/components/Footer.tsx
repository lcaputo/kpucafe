import { MapPin, Phone, Mail, Instagram, Facebook } from 'lucide-react';
import logoKpu from '@/assets/logo-kpu.png';

export default function Footer() {
  return (
    <footer id="contacto" className="bg-secondary text-secondary-foreground">
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <img
                src={logoKpu}
                alt="KPU Café"
                className="h-14 w-14 rounded-full object-cover" />

              <div>
                <span className="font-display text-2xl font-bold">KPU</span>
                <span className="text-primary font-display text-sm block">Café Colombiano</span>
              </div>
            </div>
            <p className="text-secondary-foreground/70 text-sm leading-relaxed">
              Desde las montañas del sur de Colombia, llevamos el mejor café de especialidad 
              directamente a tu taza. 100% Arábica, tostado con pasión.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-display text-lg font-semibold mb-6">Enlaces</h3>
            <ul className="space-y-3">
              <li>
                <a href="#productos" className="text-secondary-foreground/70 hover:text-primary transition-colors text-sm">
                  Productos
                </a>
              </li>
              <li>
                <a href="#suscripciones" className="text-secondary-foreground/70 hover:text-primary transition-colors text-sm">
                  Suscripciones
                </a>
              </li>
              <li>
                <a href="#nosotros" className="text-secondary-foreground/70 hover:text-primary transition-colors text-sm">
                  Sobre Nosotros
                </a>
              </li>
              <li>
                <a href="#" className="text-secondary-foreground/70 hover:text-primary transition-colors text-sm">
                  Términos y Condiciones
                </a>
              </li>
              <li>
                <a href="#" className="text-secondary-foreground/70 hover:text-primary transition-colors text-sm">
                  Política de Privacidad
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
                <span className="text-secondary-foreground/70 text-sm">hola@kpucafe.com</span>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-secondary-foreground/70 text-sm">
                  Barranquilla, Colombia
                </span>
              </li>
            </ul>
          </div>

          {/* Social & Newsletter */}
          <div>
            <h3 className="font-display text-lg font-semibold mb-6">Síguenos</h3>
            <div className="flex gap-4 mb-8">
              <a
                href="#"
                className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all">

                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all">

                <Facebook className="h-5 w-5" />
              </a>
            </div>

            
            









          </div>
        </div>

        {/* Bottom */}
        






      </div>
    </footer>);

}