-- ผลจากการจำลองแฮ็ก: คนที่สมัครบัญชีเองแต่ไม่ใช่พนักงานเรียกสองฟังก์ชันนี้ได้ (ไม่มีการเช็คสิทธิ์ในตัวฟังก์ชัน)
--  - next_invoice_no: เผาเลข Invoice ทิ้งจนเลขขาดช่วง/เปลืองเลข
--  - purge_expired_invoices: สั่งลบ Invoice ที่เกิน 30 วันได้ตามใจ
-- เพิ่มการเช็คเป็นพนักงานที่ใช้งานได้ (งานที่รันโดยระบบ/cron ไม่มี auth.uid จึงผ่านได้ตามเดิม)
create or replace function public.next_invoice_no()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_member() then
    raise exception 'ไม่มีสิทธิ์เข้าถึง';
  end if;
  return 'INV-' || lpad(nextval('public.invoice_no_seq')::text, 5, '0');
end;
$$;

create or replace function public.purge_expired_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is not null and not public.is_active_member() then
    raise exception 'ไม่มีสิทธิ์เข้าถึง';
  end if;
  delete from public.invoices where issued_at <= now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
