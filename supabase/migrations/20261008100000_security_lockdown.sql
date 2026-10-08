-- ล็อกความปลอดภัยแบบ "ปิดทั้งหมดก่อน แล้วเปิดเฉพาะที่ตั้งใจ" (deny by default)
-- ก่อนหน้านี้ Postgres ให้ EXECUTE กับ PUBLIC เป็นค่าเริ่มต้นของทุกฟังก์ชัน และ Supabase ให้สิทธิ์ตารางเต็มกับ anon —
-- ปลอดภัยอยู่ด้วย RLS/การเช็คสิทธิ์ในตัวฟังก์ชัน แต่ไม่ควรพึ่งชั้นเดียว: ชั้นนี้ตัดไม่ให้ anon/คนล็อกอินที่ไม่ใช่พนักงาน
-- "เรียกได้" ตั้งแต่ต้น (ฟังก์ชันของพนักงาน ฟังก์ชัน trigger/ภายใน และตารางทั้งหมด)

-- 1) ฟังก์ชันทั้งหมดใน public: ถอนสิทธิ์เรียกทุกคน (service_role คงเดิม) และตั้งค่าเริ่มต้นให้ฟังก์ชันใหม่ปิดไว้ก่อน
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

do $$
declare
  r record;
begin
  -- หน้าสาธารณะ (ลูกค้า/นักเรียนที่ยังไม่ล็อกอิน) เรียกได้ — ทุกตัวตรวจ token/โค้ดเองในฟังก์ชัน และคืนเฉพาะข้อมูลที่ควรเห็น
  for r in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array[
      'get_public_menu', 'get_public_order', 'get_public_invoice', 'get_public_promotions', 'check_promo_code',
      'learn_open', 'get_disaster_mode', 'log_unanswered_chat_question', 'acknowledge_needed_date_change',
      'update_public_order_address'
    ])
  loop
    execute format('grant execute on function %s to anon, authenticated', r.sig);
  end loop;

  -- ฟังก์ชันหลังบ้าน: ต้องล็อกอินเท่านั้น (ในตัวฟังก์ชันยังเช็ค is_active_member() ซ้ำอีกชั้น)
  -- is_*/current_staff_id ต้องเปิดให้ authenticated ด้วย เพราะนโยบาย RLS เรียกใช้ด้วยสิทธิ์ของผู้ใช้
  for r in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array[
      'is_active_member', 'is_owner', 'is_manager_or_owner', 'is_executive', 'current_staff_id',
      'adjust_ingredient_stock', 'claim_staff_invite', 'confirm_order', 'convert_ingredient_unit', 'create_pos_sale',
      'issue_receipt', 'reissue_receipt', 'reject_customer_order', 'restock_ingredient',
      'next_invoice_no', 'next_order_no', 'next_receipt_no', 'purge_expired_invoices'
    ])
  loop
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end
$$;

-- 2) ตาราง: anon ไม่ต้องแตะตารางตรงๆ เลย (หน้าสาธารณะใช้ฟังก์ชันด้านบนทั้งหมด) / คนล็อกอินตัดสิทธิ์อันตรายที่แอปไม่เคยใช้
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke truncate, trigger, references on tables from authenticated;

-- 3) ที่เก็บความลับภายในฐานข้อมูล (อ่านได้เฉพาะฟังก์ชันของเจ้าของระบบ/service role — ไม่มี policy และไม่ให้สิทธิ์ใครเลย)
create table if not exists public.internal_secrets (
  name text primary key,
  value text not null
);
alter table public.internal_secrets enable row level security;
revoke all on public.internal_secrets from anon, authenticated;
insert into public.internal_secrets (name, value)
values ('sheets_sync', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (name) do nothing;

-- trigger sync Google Sheets แนบความลับไปกับทุกคำขอ — Edge Function sync-sheets-tab ปฏิเสธคำขอที่ไม่มีความลับนี้
-- (เดิมเปิดโล่ง ใครรู้ URL ก็สั่ง sync ซ้ำๆ ให้ระบบทำงานหนักได้)
create or replace function public.notify_sheets_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select value into v_secret from public.internal_secrets where name = 'sheets_sync';
  perform net.http_post(
    url := 'https://blvjphxlhvtbaqejzsru.supabase.co/functions/v1/sync-sheets-tab',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', coalesce(v_secret, '')),
    body := jsonb_build_object('table', TG_TABLE_NAME)
  );
  return null;
end;
$$;
revoke execute on function public.notify_sheets_sync() from public, anon, authenticated;

-- 4) กันยิงอีเมลแจ้งเจ้าของซ้ำๆ จาก notify-customer-order (ส่งได้ครั้งเดียวต่อออเดอร์)
alter table public.orders add column if not exists owner_notified_at timestamptz;

-- 5) ที่เก็บไฟล์: จำกัดขนาดและชนิดไฟล์ (ไม่รับ SVG เพราะฝังสคริปต์ได้เมื่อเปิดตรงจากลิงก์สาธารณะ)
update storage.buckets
  set file_size_limit = 8388608,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif']
  where id = 'product-images';
update storage.buckets
  set file_size_limit = 10485760,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'application/pdf']
  where id = 'slips';
