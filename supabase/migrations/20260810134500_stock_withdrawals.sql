-- เบิกของ: บันทึกตอนเจ้าของร้านเอาสินค้าที่ทำไว้ไปขายนอกร้าน (เช่น ที่โรงเรียน/ตลาดนัด) โดยลูกค้ายังไม่ได้สั่งมาก่อน
-- แยกเป็น "เบิกไป" (qty_out) ก่อน แล้วค่อยกลับมาปิดรอบใส่ "ขายได้กี่ชิ้น/ได้เงินเท่าไหร่" (qty_sold, amount_collected)
-- ทีหลัง ต้นทุนคิดจาก qty_out เสมอ (ของที่ทำไปแล้วมีต้นทุนเกิดขึ้นแล้วไม่ว่าจะขายหมดหรือไม่)
create table public.stock_withdrawals (
  id uuid primary key default gen_random_uuid(),
  withdrawn_at date not null default current_date,
  location text,
  note text,
  status text not null default 'open' check (status in ('open', 'settled')),
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.stock_withdrawal_items (
  id uuid primary key default gen_random_uuid(),
  withdrawal_id uuid not null references public.stock_withdrawals(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10,2) not null default 0,
  unit_cost numeric(10,2) not null default 0,
  qty_out numeric(10,2) not null check (qty_out > 0),
  qty_sold numeric(10,2),
  amount_collected numeric(10,2),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index stock_withdrawal_items_withdrawal_id_idx on public.stock_withdrawal_items (withdrawal_id);

alter table public.stock_withdrawals enable row level security;
alter table public.stock_withdrawal_items enable row level security;

create policy stock_withdrawals_all on public.stock_withdrawals
  for all to authenticated using (public.is_active_member()) with check (public.is_active_member());
create policy stock_withdrawal_items_all on public.stock_withdrawal_items
  for all to authenticated using (public.is_active_member()) with check (public.is_active_member());
