-- แก้บั๊กจริง: migration ก่อนหน้า (20260926090500) revoke execute จาก anon, authenticated เท่านั้น แต่ Postgres
-- ให้สิทธิ์ EXECUTE กับ PUBLIC โดยอัตโนมัติทุกครั้งที่สร้างฟังก์ชันใหม่ (ไม่ได้ revoke ไปด้วยเลยยังเรียกผ่าน
-- PUBLIC ได้อยู่ดี ทดสอบยิง HTTP ตรงๆ ด้วย anon key แล้วยังเรียกเข้าตัวฟังก์ชันได้จริง แม้ revoke จาก
-- anon/authenticated ไปแล้ว) ต้อง revoke จาก public ตรงๆ ด้วยเสมอถึงจะปิดสนิทจริง

revoke execute on function public.submit_customer_order(
  text, text, text, text, date, text, text, text, text, text, text, jsonb
) from public;

notify pgrst, 'reload schema';
