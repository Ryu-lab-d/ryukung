-- รายจ่ายอื่นๆ นอกเหนือต้นทุนวัตถุดิบ (ค่าเช่า ค่าไฟ บรรจุภัณฑ์ การตลาด ฯลฯ) ใช้คำนวณกำไรสุทธิที่หน้าสรุปยอด
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null check (category in (
    'rent_utilities', 'packaging', 'marketing', 'transport', 'equipment', 'ingredients_other', 'other'
  )),
  amount numeric(10,2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_expense_date_idx on public.expenses (expense_date);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

alter table public.expenses enable row level security;

create policy expenses_all on public.expenses
  for all to authenticated using (public.is_active_member()) with check (public.is_active_member());
