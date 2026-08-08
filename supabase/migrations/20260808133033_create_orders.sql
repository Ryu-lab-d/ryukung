create sequence public.order_no_seq;

create or replace function public.next_order_no()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_num bigint;
begin
  select order_no_prefix into v_prefix from public.settings limit 1;
  v_num := nextval('public.order_no_seq');
  return coalesce(v_prefix, 'RYB') || '-' || lpad(v_num::text, 6, '0');
end;
$$;

grant execute on function public.next_order_no() to authenticated;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique,
  public_token text not null unique
    default replace(replace(encode(extensions.gen_random_bytes(24), 'base64'), '/', '_'), '+', '-'),
  customer_id uuid references public.customers(id) on delete set null,
  is_draft boolean not null default true,
  work_status text not null default 'to_bake'
    check (work_status in ('to_bake','baking','ready','delivered','cancelled')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','partial','paid')),
  fulfillment_type text not null default 'shipping'
    check (fulfillment_type in ('pickup','shipping','rider','self_deliver')),
  needed_date date,
  bake_date date,
  pickup_place text,
  pickup_time text,
  ship_recipient_name text,
  ship_recipient_phone text,
  ship_address_text text,
  carrier text,
  tracking_no text,
  shipped_at timestamptz,
  shipping_fee numeric(10,2) not null default 0 check (shipping_fee >= 0),
  discount_type text not null default 'none'
    check (discount_type in ('none','amount','percent')),
  discount_value numeric(10,2) not null default 0 check (discount_value >= 0),
  items_total numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null default 0,
  items_cost_total numeric(12,2) not null default 0,
  note text,
  cancelled_reason text,
  refund_status text not null default 'none'
    check (refund_status in ('none','pending','refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- ออเดอร์ที่ยืนยันแล้วต้องมีเลขที่เสมอ ออเดอร์ร่างต้องไม่มี
  constraint orders_confirmed_has_no check (is_draft or order_no is not null)
);

create index orders_bake_date_idx on public.orders (bake_date);
create index orders_work_status_idx on public.orders (work_status);
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_customer_id_idx on public.orders (customer_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  unit_cost numeric(10,2) not null default 0 check (unit_cost >= 0),
  qty numeric(10,2) not null check (qty > 0),
  line_total numeric(12,2) not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items (order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy orders_all on public.orders
  for all to authenticated using (true) with check (true);
create policy order_items_all on public.order_items
  for all to authenticated using (true) with check (true);
