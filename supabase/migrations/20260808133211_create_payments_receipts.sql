create sequence public.receipt_no_seq;

create or replace function public.next_receipt_no()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_num bigint;
begin
  select receipt_no_prefix into v_prefix from public.settings limit 1;
  v_num := nextval('public.receipt_no_seq');
  return coalesce(v_prefix, 'RC') || '-' || lpad(v_num::text, 6, '0');
end;
$$;

grant execute on function public.next_receipt_no() to authenticated;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method text not null default 'transfer'
    check (method in ('transfer','promptpay','cash','cod','other')),
  paid_at timestamptz not null default now(),
  slip_path text,
  note text,
  created_at timestamptz not null default now()
);

create index payments_order_id_idx on public.payments (order_id);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  receipt_no text not null unique,
  issued_at timestamptz not null default now(),
  status text not null default 'issued' check (status in ('issued','cancelled')),
  cancelled_at timestamptz,
  cancel_reason text,
  replaced_by_receipt_id uuid references public.receipts(id) on delete set null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index receipts_order_id_idx on public.receipts (order_id);

alter table public.payments enable row level security;
alter table public.receipts enable row level security;

create policy payments_all on public.payments
  for all to authenticated using (true) with check (true);

-- ใบเสร็จเพิ่มและอ่านได้ แต่แก้เนื้อหาไม่ได้ และลบไม่ได้เลย
create policy receipts_select on public.receipts
  for select to authenticated using (true);
create policy receipts_insert on public.receipts
  for insert to authenticated with check (true);
create policy receipts_cancel on public.receipts
  for update to authenticated using (status = 'issued') with check (true);

create or replace function public.receipts_freeze()
returns trigger
language plpgsql
as $$
begin
  if new.snapshot is distinct from old.snapshot
     or new.receipt_no is distinct from old.receipt_no
     or new.order_id is distinct from old.order_id
     or new.issued_at is distinct from old.issued_at then
    raise exception 'ใบเสร็จที่ออกแล้วแก้ไม่ได้ ให้ยกเลิกแล้วออกใบใหม่แทน';
  end if;
  return new;
end;
$$;

create trigger receipts_freeze_trg
  before update on public.receipts
  for each row execute function public.receipts_freeze();
