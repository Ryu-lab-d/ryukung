-- ผลจากการจำลองแฮ็ก: ผู้ไม่ล็อกอินสมัครฟัง realtime ของตาราง orders แล้ว "รู้ได้ว่ามีออเดอร์เข้า/แก้/ลบเมื่อไหร่" (แม้ไม่เห็นเนื้อหา)
-- ซึ่งเป็นข้อมูลธุรกิจที่รั่ว (ปริมาณ/จังหวะออเดอร์) — ถอนตารางออกจาก realtime กระดานออเดอร์ใช้การดึงซ้ำทุกไม่กี่วินาทีแทน
do $$
begin
  if exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime drop table public.orders;
  end if;
end
$$;
