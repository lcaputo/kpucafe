
-- Add sort_order to products
ALTER TABLE public.products ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Update existing products with sequential sort_order
DO $$
DECLARE
  r RECORD;
  i INTEGER := 0;
BEGIN
  FOR r IN SELECT id FROM public.products ORDER BY created_at ASC
  LOOP
    UPDATE public.products SET sort_order = i WHERE id = r.id;
    i := i + 1;
  END LOOP;
END $$;

-- Subscription plans table (admin-managed, shown on landing)
CREATE TABLE public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL,
  frequency_label TEXT NOT NULL,
  price INTEGER NOT NULL,
  original_price INTEGER,
  discount TEXT,
  is_popular BOOLEAN DEFAULT false,
  features TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
ON public.subscription_plans FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage plans"
ON public.subscription_plans FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default plans
INSERT INTO public.subscription_plans (name, frequency, frequency_label, price, original_price, discount, is_popular, features, sort_order) VALUES
('Semanal', 'weekly', 'Cada semana', 32000, 35000, '9%', false, ARRAY['Café fresco cada 7 días', 'Envío gratis incluido', 'Cancela cuando quieras', 'Elige tu presentación favorita'], 0),
('Quincenal', 'biweekly', 'Cada 15 días', 30000, 35000, '14%', true, ARRAY['Café fresco cada 15 días', 'Envío gratis incluido', 'Cancela cuando quieras', 'Elige tu presentación favorita', 'Acceso a ediciones limitadas'], 1),
('Mensual', 'monthly', 'Cada mes', 28000, 35000, '20%', false, ARRAY['Café fresco cada mes', 'Envío gratis incluido', 'Cancela cuando quieras', 'Elige tu presentación favorita', 'Kit de barista de regalo'], 2);
