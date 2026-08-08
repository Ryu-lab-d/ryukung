create extension if not exists pgcrypto;

-- ฟังก์ชันกลางสำหรับอัปเดต updated_at ใช้ซ้ำได้ทุกตาราง
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  shop_name text not null default 'RYUKUNG BAKERY',
  logo_path text,
  phone text,
  address text,
  promptpay text,
  receipt_footer text,
  receipt_show_logo boolean not null default true,
  receipt_show_address boolean not null default true,
  receipt_show_phone boolean not null default true,
  receipt_show_promptpay boolean not null default false,
  order_no_prefix text not null default 'RYB',
  receipt_no_prefix text not null default 'RC',
  shipping_lead_days integer not null default 1,
  require_full_customer_info boolean not null default true,
  updated_at timestamptz not null default now(),
  -- คอลัมน์นี้มีไว้บังคับให้ตารางมีได้แถวเดียวเท่านั้น
  singleton boolean not null default true,
  constraint settings_only_one_row unique (singleton),
  constraint settings_singleton_must_be_true check (singleton = true)
);

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

insert into public.settings (shop_name) values ('RYUKUNG BAKERY');

alter table public.settings enable row level security;

create policy settings_select on public.settings
  for select to authenticated using (true);
create policy settings_update on public.settings
  for update to authenticated using (true) with check (true);
