create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  channel text check (channel in ('facebook','line','instagram','tiktok','other')),
  channel_handle text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text not null default 'บ้าน',
  recipient_name text,
  recipient_phone text,
  address_text text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index customer_addresses_customer_id_idx
  on public.customer_addresses (customer_id);

-- ลูกค้าหนึ่งคนมีที่อยู่หลักได้ที่อยู่เดียว
create unique index customer_addresses_one_default_idx
  on public.customer_addresses (customer_id)
  where is_default;

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;

create policy customers_all on public.customers
  for all to authenticated using (true) with check (true);
create policy customer_addresses_all on public.customer_addresses
  for all to authenticated using (true) with check (true);
