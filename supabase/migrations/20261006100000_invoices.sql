-- ประวัติเอกสาร Invoice ของหลังบ้าน: เก็บ "ภาพถ่ายข้อมูล" (snapshot) ตอนออกเอกสาร เก็บไว้ 30 วันแล้วลบอัตโนมัติ
-- ผูกกับออเดอร์แบบ on delete set null — ออเดอร์ที่ส่งมอบแล้วถูกลบเพื่อประหยัดพื้นที่ (ดูระบบจัดการพื้นที่จัดเก็บ) Invoice ยังเปิดดูย้อนหลังได้
-- ครบ 30 วันนับจากวันที่ออกเอกสาร: (1) ซ่อนจากทุกคำสั่งอ่านทันทีผ่านนโยบาย RLS (2) ลบจริงด้วย purge_expired_invoices()
-- ซึ่งหน้า Invoice เรียกทุกครั้งที่เปิด และตั้งเวลาลบรายวันด้วย pg_cron ให้ด้วยถ้าฐานข้อมูลนี้เปิดใช้ส่วนขยายนั้นได้
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique references public.orders(id) on delete set null,
  order_no text not null,
  invoice_no text not null,
  customer_name text,
  grand_total numeric(12,2) not null default 0,
  payment_status text,
  issued_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  snapshot jsonb not null
);

create index invoices_issued_at_idx on public.invoices (issued_at desc);
create index invoices_order_no_idx on public.invoices (order_no);

alter table public.invoices enable row level security;

create policy invoices_select on public.invoices
  for select to authenticated
  using (public.is_active_member() and issued_at > now() - interval '30 days');
create policy invoices_insert on public.invoices
  for insert to authenticated with check (public.is_active_member());
create policy invoices_update on public.invoices
  for update to authenticated
  using (public.is_active_member() and issued_at > now() - interval '30 days')
  with check (public.is_active_member());
create policy invoices_delete on public.invoices
  for delete to authenticated using (public.is_active_member());

create or replace function public.purge_expired_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.invoices where issued_at <= now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.purge_expired_invoices() from public, anon;
grant execute on function public.purge_expired_invoices() to authenticated;

-- ตั้งเวลาลบรายวัน (03:10 น. UTC) — ใช้ได้เฉพาะเมื่อเปิด pg_cron ไว้ ถ้าไม่ได้ก็ข้ามไปเงียบๆ (ยังมีการซ่อนด้วย RLS + ลบตอนเปิดหน้าอยู่)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('purge-expired-invoices', '10 3 * * *', 'select public.purge_expired_invoices()');
exception when others then
  raise notice 'pg_cron ไม่พร้อมใช้งาน ข้ามการตั้งเวลาลบอัตโนมัติ: %', sqlerrm;
end;
$$;
