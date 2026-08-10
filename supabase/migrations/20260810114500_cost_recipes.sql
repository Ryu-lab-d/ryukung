-- ระบบคำนวณต้นทุนสูตร/เมนู: เก็บวัตถุดิบไม่จำกัดจำนวนต่อสูตร + ค่าแรงหลายรายการ + % waste/overhead + จำนวนที่ทำได้
-- ต้นทุนต่อชิ้น/ราคาขายแนะนำคำนวณฝั่ง client จากตัวเลขดิบที่เก็บไว้ตรงนี้ (เหมือนหน้าสรุปยอดขาย) ไม่ใช้ trigger คำนวณ
-- เพราะเป็นเครื่องมือช่วยตั้งราคา ไม่ใช่ข้อมูลธุรกรรมหลักแบบออเดอร์ที่ต้องคำนวณถูกต้องแบบอะตอมมิก
create table public.cost_recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  waste_overhead_percent numeric(6,2) not null default 0 check (waste_overhead_percent >= 0),
  profit_percent numeric(6,2) not null default 0 check (profit_percent >= 0),
  yield_qty numeric(10,2) not null default 1 check (yield_qty > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cost_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.cost_recipes(id) on delete cascade,
  name text not null,
  purchase_qty numeric(12,3) not null check (purchase_qty > 0),
  purchase_unit text not null default 'กรัม',
  purchase_price numeric(10,2) not null default 0 check (purchase_price >= 0),
  qty_used numeric(12,3) not null default 0 check (qty_used >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.cost_recipe_labor (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.cost_recipes(id) on delete cascade,
  label text not null,
  amount numeric(10,2) not null default 0 check (amount >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index cost_recipe_ingredients_recipe_id_idx on public.cost_recipe_ingredients (recipe_id);
create index cost_recipe_labor_recipe_id_idx on public.cost_recipe_labor (recipe_id);

create trigger cost_recipes_set_updated_at
  before update on public.cost_recipes
  for each row execute function public.set_updated_at();

alter table public.cost_recipes enable row level security;
alter table public.cost_recipe_ingredients enable row level security;
alter table public.cost_recipe_labor enable row level security;

create policy cost_recipes_all on public.cost_recipes
  for all to authenticated using (public.is_active_member()) with check (public.is_active_member());
create policy cost_recipe_ingredients_all on public.cost_recipe_ingredients
  for all to authenticated using (public.is_active_member()) with check (public.is_active_member());
create policy cost_recipe_labor_all on public.cost_recipe_labor
  for all to authenticated using (public.is_active_member()) with check (public.is_active_member());
