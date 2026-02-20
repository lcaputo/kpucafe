-- Create categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active categories"
  ON public.categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add category_id to products table
ALTER TABLE public.products ADD COLUMN category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Add has_variants flag to products (for equipment that has no weight/grind variants)
ALTER TABLE public.products ADD COLUMN has_variants BOOLEAN NOT NULL DEFAULT true;

-- Add updated_at trigger for categories
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default categories
INSERT INTO public.categories (name, description, icon, sort_order) VALUES
  ('Café', 'Granos y molidos de especialidad', 'Coffee', 0),
  ('Cafeteras', 'Equipos para preparar café', 'Cpu', 1),
  ('Moledoras', 'Molinos y molinillos', 'Settings', 2),
  ('Accesorios', 'Complementos para tu ritual de café', 'Package', 3);