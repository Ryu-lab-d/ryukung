-- กระดานออเดอร์หลังบ้านอัปเดตเองทันทีเมื่อมีออเดอร์ใหม่/เปลี่ยนสถานะ (Supabase Realtime) — เดิมโหลดครั้งเดียวต้องกดรีเฟรชเอง
-- เปิดเฉพาะตาราง orders; ผู้ใช้ที่ไม่มีสิทธิ์อ่านแถวนั้นตาม RLS จะไม่ได้รับเหตุการณ์
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end
$$;
