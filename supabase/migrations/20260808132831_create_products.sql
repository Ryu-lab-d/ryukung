create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  category_id uuid references public.categories(id) on delete set null,
  price numeric(10,2) not null default 0 check (price >= 0),
  cost numeric(10,2) not null default 0 check (cost >= 0),
  unit text not null default 'ชิ้น',
  image_path text,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_id_idx on public.products (category_id);
create index products_is_active_idx on public.products (is_active);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.categories enable row level security;
alter table public.products enable row level security;

create policy categories_all on public.categories
  for all to authenticated using (true) with check (true);
create policy products_all on public.products
  for all to authenticated using (true) with check (true);
