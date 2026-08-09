-- วันหยุดร้าน ใช้แสดงในปฏิทิน (ไม่รับออเดอร์/ไม่อบวันนั้น) — สมาชิก active ทุกคนดู/ตั้งได้ เหมือนงานปฏิบัติการอื่นๆ
create table public.shop_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  note text,
  created_at timestamptz not null default now()
);

alter table public.shop_holidays enable row level security;

create policy shop_holidays_all on public.shop_holidays
  for all to authenticated using (public.is_active_member()) with check (public.is_active_member());
