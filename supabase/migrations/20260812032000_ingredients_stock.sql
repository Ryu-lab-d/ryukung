-- วัตถุดิบหลัก + สต็อกคงเหลือ ผูกกับสินค้าจริงผ่าน product_ingredients (ต่างจาก cost_recipes ที่เป็นเครื่องมือคำนวณราคาแบบอิสระ ไม่ผูกสต็อกจริง)
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'กรัม',
  stock_qty numeric(12,3) not null default 0,
  low_stock_threshold numeric(12,3) not null default 0,
  cost_per_unit numeric(12,4) not null default 0,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- สูตร: สินค้า 1 ชิ้นใช้วัตถุดิบอะไรบ้าง จำนวนเท่าไหร่ต่อ 1 หน่วยสินค้า
create table public.product_ingredients (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  qty_per_unit numeric(12,4) not null check (qty_per_unit > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, ingredient_id)
);

-- ประวัติเข้า-ออกสต็อก เป็น audit log อ่านอย่างเดียว (select+insert เท่านั้น ไม่มี update/delete policy)
create table public.ingredient_stock_movements (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  qty_delta numeric(12,3) not null,
  reason text not null check (reason in (
    'order_confirm', 'order_edit_reverse', 'order_cancel_restore',
    'withdrawal_deduct', 'withdrawal_restore', 'purchase_in', 'manual_adjustment'
  )),
  ref_order_id uuid references public.orders(id) on delete set null,
  ref_withdrawal_id uuid references public.stock_withdrawals(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index product_ingredients_product_id_idx on public.product_ingredients (product_id);
create index product_ingredients_ingredient_id_idx on public.product_ingredients (ingredient_id);
create index ingredient_stock_movements_ingredient_id_idx on public.ingredient_stock_movements (ingredient_id);

create trigger ingredients_set_updated_at
  before update on public.ingredients
  for each row execute function public.set_updated_at();

alter table public.ingredients enable row level security;
alter table public.product_ingredients enable row level security;
alter table public.ingredient_stock_movements enable row level security;

create policy ingredients_all on public.ingredients
  for all to authenticated using (public.is_active_member()) with check (public.is_active_member());
create policy product_ingredients_all on public.product_ingredients
  for all to authenticated using (public.is_active_member()) with check (public.is_active_member());
create policy ingredient_stock_movements_select on public.ingredient_stock_movements
  for select to authenticated using (public.is_active_member());
create policy ingredient_stock_movements_insert on public.ingredient_stock_movements
  for insert to authenticated with check (public.is_active_member());
