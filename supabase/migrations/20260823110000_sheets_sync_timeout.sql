-- แก้บั๊กที่เจอตอนทดสอบจริง: net.http_post ค่าเริ่มต้นรอ response แค่ 5 วินาที แต่ edge function
-- sync-sheets-tab บางตาราง (เช่น customers) ต้อง sync พร้อมกันหลายแท็บ รวมเวลาง่ายๆ ก็เกิน 5 วินาทีแล้ว
-- ทำให้ pg_net เห็นว่า timeout ทั้งที่ edge function อาจจะยังทำงานอยู่จริง — ยืดเวลารอเป็น 15 วินาที
-- (ไม่กระทบธุรกรรมเดิมเลย เพราะ net.http_post คืนค่าทันทีอยู่แล้ว ตัวที่รอคือ background worker ของ pg_net
-- เอง ไม่ใช่ธุรกรรมที่ trigger นี้ผูกอยู่)
create or replace function public.notify_sheets_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://blvjphxlhvtbaqejzsru.supabase.co/functions/v1/sync-sheets-tab',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('table', TG_TABLE_NAME),
    timeout_milliseconds := 15000
  );
  return null;
end;
$$;
