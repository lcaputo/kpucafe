--
-- PostgreSQL database dump
--

\restrict ELGN8dq2tD2iZ6atEcD3QNfqPTnQWvk7I3axY0LHlY0uw27sITIFNdPeT77fXJq

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'pending',
    'paid',
    'preparing',
    'shipped',
    'delivered',
    'cancelled'
);


--
-- Name: subscription_frequency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_frequency AS ENUM (
    'weekly',
    'biweekly',
    'monthly'
);


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status AS ENUM (
    'active',
    'paused',
    'cancelled'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    icon text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    description text,
    discount_type text DEFAULT 'percentage'::text NOT NULL,
    discount_value integer NOT NULL,
    min_order_amount integer DEFAULT 0,
    max_uses integer,
    current_uses integer DEFAULT 0,
    is_active boolean DEFAULT true,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coupons_discount_type_check CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text])))
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    variant_id uuid,
    product_name text NOT NULL,
    variant_info text NOT NULL,
    quantity integer NOT NULL,
    unit_price integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0))
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    status public.order_status DEFAULT 'pending'::public.order_status,
    total integer NOT NULL,
    shipping_name text NOT NULL,
    shipping_phone text NOT NULL,
    shipping_address text NOT NULL,
    shipping_city text NOT NULL,
    shipping_department text,
    shipping_postal_code text,
    tracking_number text,
    payment_reference text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    carrier text,
    coupon_id uuid,
    discount_amount integer DEFAULT 0
);


--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    weight text NOT NULL,
    grind text NOT NULL,
    price_modifier integer DEFAULT 0,
    stock integer DEFAULT 100,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    base_price integer NOT NULL,
    image_url text,
    origin text,
    roast_level integer DEFAULT 3,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sort_order integer DEFAULT 0,
    category_id uuid,
    has_variants boolean DEFAULT true NOT NULL,
    CONSTRAINT products_roast_level_check CHECK (((roast_level >= 1) AND (roast_level <= 5)))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text,
    phone text,
    address text,
    city text,
    department text,
    postal_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: shipping_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    label text DEFAULT 'Casa'::text NOT NULL,
    full_name text NOT NULL,
    phone text NOT NULL,
    address text NOT NULL,
    city text NOT NULL,
    department text NOT NULL,
    postal_code text,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    frequency text NOT NULL,
    frequency_label text NOT NULL,
    price integer NOT NULL,
    original_price integer,
    discount text,
    is_popular boolean DEFAULT false,
    features text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid,
    variant_id uuid,
    frequency public.subscription_frequency NOT NULL,
    status public.subscription_status DEFAULT 'active'::public.subscription_status,
    next_delivery_date date NOT NULL,
    price integer NOT NULL,
    shipping_address text NOT NULL,
    shipping_city text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL
);


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, name, description, icon, sort_order, is_active, created_at, updated_at) FROM stdin;
8cb3e2ba-81d6-46aa-95fe-c538b836f606	Café	Granos y molidos de especialidad	Coffee	0	t	2026-02-20 22:58:14.916729+00	2026-02-20 22:58:14.916729+00
e31d3a60-b14f-419c-8486-4971e351fd69	Cafeteras	Equipos para preparar café	Cpu	1	t	2026-02-20 22:58:14.916729+00	2026-02-20 22:58:14.916729+00
4305037a-aef3-4046-b3e4-399a79b5431b	Moledoras	Molinos y molinillos	Settings	2	t	2026-02-20 22:58:14.916729+00	2026-02-20 22:58:14.916729+00
152a2b78-7846-4b6d-9032-483f6b668e93	Accesorios	Complementos para tu ritual de café	Package	3	t	2026-02-20 22:58:14.916729+00	2026-02-20 22:58:14.916729+00
\.


--
-- Data for Name: coupons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coupons (id, code, description, discount_type, discount_value, min_order_amount, max_uses, current_uses, is_active, expires_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_items (id, order_id, product_id, variant_id, product_name, variant_info, quantity, unit_price, created_at) FROM stdin;
721cb257-8963-482f-9524-65bec4a525d5	ebbc502b-f976-470d-bfa0-82fcf044177f	\N	\N	Amarillo Exclusivo	500g - Grano	1	60000	2026-01-30 19:17:12.710422+00
8c507d3d-ba9f-43bf-8b47-e9dae6a72f32	ce4e9a2b-a7b5-42d3-991f-c4d466367c07	\N	\N	Tostado Intenso	1kg - Molido	1	98000	2026-02-06 19:55:52.752876+00
349bd7ed-592d-4b3f-b284-503e6e891b7e	2edfaa72-667e-42de-98dc-b95c1e544a9d	\N	\N	Amarillo Exclusivo	250g - Grano	1	35000	2026-02-13 03:38:44.417861+00
4d34693d-d70c-4304-955a-7fb0402c69b8	c25ab7fb-0e73-4762-8d16-f88de043287b	\N	\N	Amarillo Exclusivo	250g - Grano	1	26000	2026-02-16 04:21:08.70565+00
3e943e65-a324-4185-a1b8-1fc0cec8dab4	ffc89883-0280-483b-9e87-0d037e1b9d0b	\N	\N	Amarillo Exclusivo	250g - Grano	1	26000	2026-02-16 04:21:50.883771+00
79153739-4747-412b-bfac-fdfaa216f6a4	60accb0e-06a5-4d4c-85ef-c07b82e7d903	\N	\N	Amarillo Exclusivo	250g - Grano	1	26000	2026-02-16 04:25:32.730087+00
3a2203c0-6992-4380-841a-51646a4ae818	4871da96-5fcb-4b11-ba04-5c191d301ad0	\N	\N	Amarillo Exclusivo	250g - Grano	1	26000	2026-02-16 04:31:48.038071+00
ea0f25f2-0628-4dde-8c6f-89af3912ee5a	9071692e-5e7d-4ecd-b603-6a6ba2b31f73	\N	\N	Amarillo Exclusivo	250g - Grano	1	26000	2026-02-16 04:32:06.896838+00
83aca43f-da16-434f-b610-7bc68a59b45a	e7ab3bc4-0daa-47a3-82ff-7f41989393eb	\N	\N	Amarillo Exclusivo	250g - Grano	1	26000	2026-02-16 20:33:00.526549+00
70a14191-3b54-47ce-9e8b-a2e702f90c13	7a602fb8-bdb8-403c-b734-36548c0f0205	\N	\N	Amarillo Exclusivo	250g - Grano	1	26000	2026-02-16 20:33:25.117835+00
fee30b3e-08b7-4e84-977a-9023e0b23252	7aa64bc0-1c7d-4285-97bd-bb654e8c00bb	\N	\N	Amarillo Exclusivo	250g - Grano	1	26000	2026-02-16 20:35:01.14212+00
11e9fa39-aacd-4230-8929-3131387580e2	76a414b8-2ef4-42bf-acbc-5ea23a37e390	\N	\N	Amarillo Exclusivo	250g - Grano	1	26000	2026-02-16 20:35:27.21939+00
e1224d85-eb2b-463d-b12b-1d2b6b878ede	f5c2c5fa-1c0c-4b03-b786-ff9bbb5143a7	\N	\N	Amarillo Exclusivo	250g - Grano	1	35000	2026-02-16 20:43:48.247273+00
e26abd5b-87e9-4bc1-b411-8eb511d1287a	f5c2c5fa-1c0c-4b03-b786-ff9bbb5143a7	\N	\N	Tostado Intenso	250g - Molido	1	64000	2026-02-16 20:43:48.247273+00
ba4dd0d3-29ad-4492-b44a-88eb54d2cb05	f5c2c5fa-1c0c-4b03-b786-ff9bbb5143a7	\N	\N	Tostado Intenso	500g - Molido	1	87000	2026-02-16 20:43:48.247273+00
d766cac0-0515-4b58-a559-e05f717caeb0	f5c2c5fa-1c0c-4b03-b786-ff9bbb5143a7	\N	\N	Amarillo Exclusivo	250g - Grano	1	26000	2026-02-16 20:43:48.247273+00
603037e1-634d-484f-8ad5-448fd6224dcd	f579eb1c-32ab-44fa-a5a8-77440168fad4	\N	\N	Amarillo Exclusivo	250g - Grano	1	35000	2026-02-16 20:46:10.592196+00
cb5982a6-e62f-4b2e-a670-c0fee17c67c4	f579eb1c-32ab-44fa-a5a8-77440168fad4	\N	\N	Tostado Intenso	250g - Molido	1	64000	2026-02-16 20:46:10.592196+00
284c1e3b-778c-49c6-8197-452932eef1f4	f579eb1c-32ab-44fa-a5a8-77440168fad4	\N	\N	Tostado Intenso	500g - Molido	1	87000	2026-02-16 20:46:10.592196+00
ca4a981f-bd20-433f-9ed5-622edc97f5f7	f579eb1c-32ab-44fa-a5a8-77440168fad4	\N	\N	Amarillo Exclusivo	250g - Grano	1	26000	2026-02-16 20:46:10.592196+00
10304585-45c1-4a3a-b959-dfd9492e66a2	614bcc69-8f35-4716-9c9f-89b5539fb23f	\N	\N	Amarillo Exclusivo	250g - Grano	1	26000	2026-02-16 20:48:43.074009+00
721926c3-77e2-4b7b-be40-87e54581320e	265107a4-a25e-4c9d-9be6-4eec98d62bf7	\N	\N	Amarillo Exclusivo	250g - Grano	1	26000	2026-02-16 20:56:59.717081+00
e62fb6dd-4af8-44ff-9135-ac4bacdbb699	3dbf5722-dd1a-4cf1-8dd6-ce6268cfe482	\N	\N	Amarillo Exclusivo	500g - Grano	1	52000	2026-02-20 23:33:24.375096+00
c9c17672-f1a8-4659-aa58-c166818b3304	3dbf5722-dd1a-4cf1-8dd6-ce6268cfe482	\N	\N	Cafetera Espresso Capuchino	Unidad - -	1	280000	2026-02-20 23:33:24.375096+00
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orders (id, user_id, status, total, shipping_name, shipping_phone, shipping_address, shipping_city, shipping_department, shipping_postal_code, tracking_number, payment_reference, notes, created_at, updated_at, carrier, coupon_id, discount_amount) FROM stdin;
ebbc502b-f976-470d-bfa0-82fcf044177f	9d5a194a-321c-43d7-97c0-77dcf44b7bc9	cancelled	60000	Laszlo Caputo	3028520172	Cra 41G # 113 - 125	Barranquilla	Atlántico	080020	\N	332506848		2026-01-30 19:17:12.239472+00	2026-01-30 19:17:44.432597+00	\N	\N	0
2edfaa72-667e-42de-98dc-b95c1e544a9d	f74892b6-ec69-4e34-99b4-293f6a480e5c	cancelled	35000	Miguel	31313131	Cra	Barranquilla	Atlántico		\N	334860345		2026-02-13 03:38:44.042522+00	2026-02-13 03:40:20.584519+00	\N	\N	0
ce4e9a2b-a7b5-42d3-991f-c4d466367c07	4a3e3399-b79d-4353-b087-f9243b183294	delivered	98000	Miguel	3243208547	Cra 57 # 94 93	Barranquilla	Atlántico	080002	123132	\N	Apt 301	2026-02-06 19:55:52.078923+00	2026-02-13 03:41:29.29199+00	Inter Rapidísimo	\N	0
c25ab7fb-0e73-4762-8d16-f88de043287b	f74892b6-ec69-4e34-99b4-293f6a480e5c	pending	38000	Miguel	31313131	Cra	Barranquilla	Atlántico		\N	\N		2026-02-16 04:21:08.409999+00	2026-02-16 04:21:08.409999+00	\N	\N	0
ffc89883-0280-483b-9e87-0d037e1b9d0b	f74892b6-ec69-4e34-99b4-293f6a480e5c	cancelled	38000	Miguel	31313131	Cra	Barranquilla	Atlántico		\N	335844545		2026-02-16 04:21:50.592619+00	2026-02-16 04:23:41.167261+00	\N	\N	0
60accb0e-06a5-4d4c-85ef-c07b82e7d903	f74892b6-ec69-4e34-99b4-293f6a480e5c	pending	38000	Miguel	31313131	Cra	Barranquilla	Atlántico		\N	\N		2026-02-16 04:25:32.420987+00	2026-02-16 04:25:32.420987+00	\N	\N	0
4871da96-5fcb-4b11-ba04-5c191d301ad0	f74892b6-ec69-4e34-99b4-293f6a480e5c	pending	38000	Miguel	31313131	Cra	Barranquilla	Atlántico		\N	\N		2026-02-16 04:31:47.786763+00	2026-02-16 04:31:47.786763+00	\N	\N	0
9071692e-5e7d-4ecd-b603-6a6ba2b31f73	f74892b6-ec69-4e34-99b4-293f6a480e5c	paid	38000	Miguel	31313131	Cra	Barranquilla	Atlántico		\N	335844947		2026-02-16 04:32:06.663507+00	2026-02-16 04:32:54.437507+00	\N	\N	0
e7ab3bc4-0daa-47a3-82ff-7f41989393eb	f74892b6-ec69-4e34-99b4-293f6a480e5c	pending	38000	Miguel	31313131	Cra	Barranquilla	Atlántico		\N	\N		2026-02-16 20:33:00.162637+00	2026-02-16 20:33:00.162637+00	\N	\N	0
7a602fb8-bdb8-403c-b734-36548c0f0205	f74892b6-ec69-4e34-99b4-293f6a480e5c	pending	38000	Miguel	31313131	Cra	Barranquilla	Atlántico		\N	\N		2026-02-16 20:33:24.867811+00	2026-02-16 20:33:24.867811+00	\N	\N	0
7aa64bc0-1c7d-4285-97bd-bb654e8c00bb	f74892b6-ec69-4e34-99b4-293f6a480e5c	pending	38000	Miguel	31313131	Cra	Barranquilla	Atlántico		\N	\N		2026-02-16 20:35:00.867252+00	2026-02-16 20:35:00.867252+00	\N	\N	0
76a414b8-2ef4-42bf-acbc-5ea23a37e390	f74892b6-ec69-4e34-99b4-293f6a480e5c	pending	38000	Miguel	31313131	Cra	Barranquilla	Atlántico		\N	\N		2026-02-16 20:35:26.975638+00	2026-02-16 20:35:26.975638+00	\N	\N	0
f5c2c5fa-1c0c-4b03-b786-ff9bbb5143a7	f74892b6-ec69-4e34-99b4-293f6a480e5c	pending	212000	Miguel	31313131	Cra	Barranquilla	Atlántico		\N	\N		2026-02-16 20:43:47.831489+00	2026-02-16 20:43:47.831489+00	\N	\N	0
f579eb1c-32ab-44fa-a5a8-77440168fad4	f74892b6-ec69-4e34-99b4-293f6a480e5c	paid	212000	Miguel	31313131	Cra	Barranquilla	Atlántico		\N	336062149		2026-02-16 20:46:10.320598+00	2026-02-16 20:47:33.689345+00	\N	\N	0
614bcc69-8f35-4716-9c9f-89b5539fb23f	f74892b6-ec69-4e34-99b4-293f6a480e5c	pending	38000	Miguel	31313131	Cra	Barranquilla	Atlántico		\N	336062541		2026-02-16 20:48:42.738774+00	2026-02-16 20:49:23.517051+00	\N	\N	0
265107a4-a25e-4c9d-9be6-4eec98d62bf7	f74892b6-ec69-4e34-99b4-293f6a480e5c	preparing	38000	Miguel	31313131	Cra	Barranquilla	Atlántico		\N	TEST123		2026-02-16 20:56:59.415019+00	2026-02-16 21:03:56.178476+00	\N	\N	0
3dbf5722-dd1a-4cf1-8dd6-ce6268cfe482	f74892b6-ec69-4e34-99b4-293f6a480e5c	pending	332000	Miguel	31313131	Cra	Barranquilla	Atlántico		\N	\N		2026-02-20 23:33:24.062604+00	2026-02-20 23:33:24.062604+00	\N	\N	0
\.


--
-- Data for Name: product_variants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_variants (id, product_id, weight, grind, price_modifier, stock, is_active, created_at) FROM stdin;
7611c293-8537-468d-80d5-94fc5e9a815c	d60ac382-be18-4030-8bae-bbe390166e10	250g	Grano	28000	0	f	2026-01-30 19:04:40.781834+00
ad80e453-4cc3-43b8-8878-bd8426fdb428	d60ac382-be18-4030-8bae-bbe390166e10	250g	Molido	28000	0	f	2026-01-30 19:04:40.781834+00
218a78ce-c708-4709-8a3a-6464e469b7aa	d60ac382-be18-4030-8bae-bbe390166e10	500g	Grano	52000	5	t	2026-01-30 19:04:40.781834+00
46735796-5740-425f-b39e-5ac5a866bb24	d60ac382-be18-4030-8bae-bbe390166e10	500g	Molido	52000	5	t	2026-01-30 19:04:40.781834+00
e708bf55-014f-4058-b96d-5af13ea46d3e	209b1e2f-7132-4109-aa8f-a5ab9a8fa9a1	250g	Grano	30000	4	f	2026-01-30 19:04:40.781834+00
9334fe48-2161-40c1-95a6-069403d4432f	209b1e2f-7132-4109-aa8f-a5ab9a8fa9a1	250g	Molido	30000	4	f	2026-01-30 19:04:40.781834+00
6030f4fd-71d0-4487-a893-8b269b2afbed	209b1e2f-7132-4109-aa8f-a5ab9a8fa9a1	500g	Grano	58000	4	f	2026-01-30 19:04:40.781834+00
e5662664-0489-418d-a237-8fb87dbc70b1	209b1e2f-7132-4109-aa8f-a5ab9a8fa9a1	500g	Molido	58000	2	t	2026-01-30 19:04:40.781834+00
631d6a90-7c04-417d-9794-470baf96134b	344a470e-ca1b-4f79-8b44-d4dc171ac2b9	250g	Grano	26000	0	f	2026-01-30 19:04:40.781834+00
9b76a027-70e0-4fe0-ba9b-89297686cacc	344a470e-ca1b-4f79-8b44-d4dc171ac2b9	250g	Molido	26000	2	t	2026-01-30 19:04:40.781834+00
726f0dc6-0e53-4b50-8712-fd341b4f908f	344a470e-ca1b-4f79-8b44-d4dc171ac2b9	500g	Grano	49000	5	t	2026-01-30 19:04:40.781834+00
a7d5c2bb-7ca9-4966-b27a-7cc4ded5a236	344a470e-ca1b-4f79-8b44-d4dc171ac2b9	500g	Molido	49000	0	f	2026-01-30 19:04:40.781834+00
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.products (id, name, description, base_price, image_url, origin, roast_level, is_active, created_at, updated_at, sort_order, category_id, has_variants) FROM stdin;
173fbe30-00e8-41f0-8d3b-32142254235b	Cafetera Espresso Capuchino	Puedes realizar: Espresso, Capuccino, Café Moca, Latte, gracias a la boquilla de vapor para espumar la leche, para un día lleno de sabor y aroma.	280000	https://lrykzwrhsmkjgunytdaa.supabase.co/storage/v1/object/public/product-images/1771629525855-s4zqk.webp		3	t	2026-02-20 23:19:05.50666+00	2026-02-20 23:21:34.917769+00	3	e31d3a60-b14f-419c-8486-4971e351fd69	f
d60ac382-be18-4030-8bae-bbe390166e10	Amarillo Exclusivo	Desde las montañas del sur de Colombia, este café destaca por sus notas de miel, canela y frutos amarillos.	0	https://lrykzwrhsmkjgunytdaa.supabase.co/storage/v1/object/public/product-images/1770956925354-q32ud.png	Huila	3	t	2026-01-30 19:04:40.781834+00	2026-02-20 23:23:11.040044+00	0	8cb3e2ba-81d6-46aa-95fe-c538b836f606	t
344a470e-ca1b-4f79-8b44-d4dc171ac2b9	Rojo Intenso	Un café con cuerpo robusto y notas de chocolate amargo, cacao y nueces tostadas. Perfecto para espresso.	0	https://lrykzwrhsmkjgunytdaa.supabase.co/storage/v1/object/public/product-images/1770956874106-jnvj4.png	Sierra nevada de Santa Marta	4	t	2026-01-30 19:04:40.781834+00	2026-02-20 23:23:16.265973+00	1	8cb3e2ba-81d6-46aa-95fe-c538b836f606	t
209b1e2f-7132-4109-aa8f-a5ab9a8fa9a1	Origen Selecto	Para los amantes del café equilibrado y de origen, notas suaves de chocolate, miel y caramelo	0	https://lrykzwrhsmkjgunytdaa.supabase.co/storage/v1/object/public/product-images/1771003331754-la45ur.png	Boyacá	3	t	2026-01-30 19:04:40.781834+00	2026-02-20 23:23:22.034911+00	2	8cb3e2ba-81d6-46aa-95fe-c538b836f606	t
9c2cb7f2-b923-4bce-b534-45880c8fccb9	Cafetera Italiana		45000	https://lrykzwrhsmkjgunytdaa.supabase.co/storage/v1/object/public/product-images/1771631931948-cpe8ij.webp		3	t	2026-02-20 23:58:41.896591+00	2026-02-20 23:58:41.896591+00	4	e31d3a60-b14f-419c-8486-4971e351fd69	f
cb40cc65-ef85-4e9c-8e29-e5d379c2be0d	Moledor Eléctrico		55000	https://lrykzwrhsmkjgunytdaa.supabase.co/storage/v1/object/public/product-images/1771631953657-64q5nj.webp		3	t	2026-02-20 23:59:05.161578+00	2026-02-20 23:59:05.161578+00	5	4305037a-aef3-4046-b3e4-399a79b5431b	f
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profiles (id, user_id, full_name, phone, address, city, department, postal_code, created_at, updated_at) FROM stdin;
974f167a-5a6c-4206-9344-a863f6a0d12c	27145712-95de-4e10-890f-cbbafa5688c8	\N	\N	\N	\N	\N	\N	2026-01-30 19:05:43.063894+00	2026-01-30 19:05:43.063894+00
4b611d94-666c-4223-aaeb-f2eb6a5bb60a	9d5a194a-321c-43d7-97c0-77dcf44b7bc9	\N	\N	\N	\N	\N	\N	2026-01-30 19:06:04.149238+00	2026-01-30 19:06:04.149238+00
c028ea3c-c086-474f-90b3-964d8072af52	b6b274c8-ef34-431c-a730-d8c51ec4c31e	\N	\N	\N	\N	\N	\N	2026-02-04 21:50:37.914563+00	2026-02-04 21:50:37.914563+00
f7ce3287-1142-4044-b11c-06a64464d3c1	4a3e3399-b79d-4353-b087-f9243b183294	\N	\N	\N	\N	\N	\N	2026-02-06 19:51:18.148111+00	2026-02-06 19:51:18.148111+00
794ab604-4b62-4559-8fba-eb1ced71cc6a	f74892b6-ec69-4e34-99b4-293f6a480e5c	\N	\N	\N	\N	\N	\N	2026-02-13 03:17:42.320144+00	2026-02-13 03:17:42.320144+00
3aeecb3d-6c11-4c6b-9d8c-1ffcf9392f70	3d1fea11-3333-4d76-8d4d-960a84582c55	\N	\N	\N	\N	\N	\N	2026-03-31 14:38:59.779143+00	2026-03-31 14:38:59.779143+00
\.


--
-- Data for Name: shipping_addresses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.shipping_addresses (id, user_id, label, full_name, phone, address, city, department, postal_code, is_default, created_at, updated_at) FROM stdin;
94e3e3fd-4786-4487-b89d-a511c4de65f4	f74892b6-ec69-4e34-99b4-293f6a480e5c	Casa	Miguel	31313131	Cra	Barranquilla	Atlántico	\N	t	2026-02-13 03:38:43.723419+00	2026-02-13 03:38:43.723419+00
\.


--
-- Data for Name: subscription_plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subscription_plans (id, name, frequency, frequency_label, price, original_price, discount, is_popular, features, is_active, sort_order, created_at, updated_at) FROM stdin;
bb80cb79-0baa-4ca7-bd41-effab47a5115	Semanal	weekly	Cada semana	32000	35000	9%	f	{"Café fresco cada 7 días","Envío gratis incluido","Cancela cuando quieras","Elige tu presentación favorita"}	f	0	2026-02-13 03:53:46.552118+00	2026-02-16 20:42:58.140089+00
534b25eb-3dee-40ec-8907-e10d4f98229d	Quincenal	biweekly	Cada 15 días	30000	35000	14%	t	{"Café fresco cada 15 días","Envío gratis incluido","Cancela cuando quieras","Elige tu presentación favorita","Acceso a ediciones limitadas"}	f	1	2026-02-13 03:53:46.552118+00	2026-02-16 20:42:59.374831+00
5307237c-b0a3-460b-9701-8bda624b7b10	Mensual	monthly	Cada mes	28000	35000	20%	f	{"Café fresco cada mes","Envío gratis incluido","Cancela cuando quieras","Elige tu presentación favorita","Kit de barista de regalo"}	f	2	2026-02-13 03:53:46.552118+00	2026-02-16 20:43:00.720799+00
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subscriptions (id, user_id, product_id, variant_id, frequency, status, next_delivery_date, price, shipping_address, shipping_city, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_roles (id, user_id, role) FROM stdin;
4c1b9c42-b06c-450c-8c4e-f109531d64a9	27145712-95de-4e10-890f-cbbafa5688c8	user
da27b844-0a78-45c3-90af-b0ad664bbb23	9d5a194a-321c-43d7-97c0-77dcf44b7bc9	user
226451b5-6946-47df-aa02-534a14646936	9d5a194a-321c-43d7-97c0-77dcf44b7bc9	admin
4526e244-3f0a-4faa-8a00-8eb040df50f5	b6b274c8-ef34-431c-a730-d8c51ec4c31e	user
db48f885-4a9d-4383-a04b-4276e75541ba	4a3e3399-b79d-4353-b087-f9243b183294	user
cd373f9f-7eb2-4e5b-b7bd-e1b3596ed46e	f74892b6-ec69-4e34-99b4-293f6a480e5c	user
a523765e-b1df-4f62-bf5f-f3750a2000de	f74892b6-ec69-4e34-99b4-293f6a480e5c	admin
1125eff5-586d-470d-bc85-b8f46e39c42a	3d1fea11-3333-4d76-8d4d-960a84582c55	user
\.


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key UNIQUE (code);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: shipping_addresses shipping_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_addresses
    ADD CONSTRAINT shipping_addresses_pkey PRIMARY KEY (id);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: categories update_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: coupons update_coupons_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shipping_addresses update_shipping_addresses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_shipping_addresses_updated_at BEFORE UPDATE ON public.shipping_addresses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscription_plans update_subscription_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscriptions update_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: orders orders_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id);


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: categories Admins can manage categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage categories" ON public.categories USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: coupons Admins can manage coupons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage coupons" ON public.coupons USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: subscription_plans Admins can manage plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage plans" ON public.subscription_plans USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: products Admins can manage products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage products" ON public.products USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: product_variants Admins can manage variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage variants" ON public.product_variants USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: orders Admins can update orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update orders" ON public.orders FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: subscriptions Admins can update subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update subscriptions" ON public.subscriptions FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: order_items Admins can view all order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all order items" ON public.order_items FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: orders Admins can view all orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all orders" ON public.orders FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: subscriptions Admins can view all subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: categories Anyone can view active categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active categories" ON public.categories FOR SELECT USING ((is_active = true));


--
-- Name: coupons Anyone can view active coupons by code; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active coupons by code" ON public.coupons FOR SELECT USING ((is_active = true));


--
-- Name: subscription_plans Anyone can view active plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active plans" ON public.subscription_plans FOR SELECT USING ((is_active = true));


--
-- Name: products Anyone can view active products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active products" ON public.products FOR SELECT USING ((is_active = true));


--
-- Name: product_variants Anyone can view active variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active variants" ON public.product_variants FOR SELECT USING ((is_active = true));


--
-- Name: order_items Users can create order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create order items" ON public.order_items FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid())))));


--
-- Name: orders Users can create orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create orders" ON public.orders FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: shipping_addresses Users can create own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own addresses" ON public.shipping_addresses FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: subscriptions Users can create subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create subscriptions" ON public.subscriptions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: shipping_addresses Users can delete own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own addresses" ON public.shipping_addresses FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: shipping_addresses Users can update own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own addresses" ON public.shipping_addresses FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: subscriptions Users can update own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own subscriptions" ON public.subscriptions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: shipping_addresses Users can view own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own addresses" ON public.shipping_addresses FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: order_items Users can view own order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own order items" ON public.order_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid())))));


--
-- Name: orders Users can view own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: subscriptions Users can view own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: coupons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: product_variants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: shipping_addresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipping_addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict ELGN8dq2tD2iZ6atEcD3QNfqPTnQWvk7I3axY0LHlY0uw27sITIFNdPeT77fXJq

