-- (1) เลขที่ Invoice รันต่อเนื่อง INV-00001, INV-00002 ... (เดิมใช้ INV-<เลขออเดอร์>) ออกเลขตอนออก Invoice ครั้งแรกของแต่ละออเดอร์
create sequence if not exists public.invoice_no_seq;

create or replace function public.next_invoice_no()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return 'INV-' || lpad(nextval('public.invoice_no_seq')::text, 5, '0');
end;
$$;

revoke execute on function public.next_invoice_no() from public, anon;
grant execute on function public.next_invoice_no() to authenticated;

-- (2) ตั้งค่าร้านเพิ่ม: เลขประจำตัวผู้เสียภาษี (โชว์บน Invoice ถ้ากรอก) + สวิตช์แจ้งลูกค้าทางอีเมลอัตโนมัติ (เปลี่ยนสถานะ/รับเงิน)
alter table public.settings add column if not exists tax_id text;
alter table public.settings add column if not exists auto_notify_customer boolean not null default true;

-- (3) ลิงก์ Invoice สาธารณะสำหรับลูกค้า: ใครมีโทเคนของออเดอร์ (ยาวและเดาไม่ได้ เหมือนลิงก์ติดตามออเดอร์) เปิดดู Invoice ใบนั้นได้
-- เฉพาะที่ยังไม่ครบ 30 วัน ไม่คืนอะไรนอกจากตัวเอกสารที่ลูกค้าคนนั้นควรได้เห็นอยู่แล้ว
create or replace function public.get_public_invoice(p_token text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object('invoice_no', i.invoice_no, 'issued_at', i.issued_at, 'snapshot', i.snapshot)
  from public.invoices i
  where length(coalesce(p_token, '')) >= 20
    and i.snapshot -> 'order' ->> 'public_token' = p_token
    and i.issued_at > now() - interval '30 days'
  order by i.issued_at desc
  limit 1;
$$;

revoke execute on function public.get_public_invoice(text) from public;
grant execute on function public.get_public_invoice(text) to anon, authenticated;
