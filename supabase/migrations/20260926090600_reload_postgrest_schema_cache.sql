-- บังคับให้ PostgREST รีโหลด schema/permission cache ทันที — migration ก่อนหน้า (revoke execute จาก
-- anon/authenticated บน submit_customer_order) เทสต์ผ่าน supabase-js ตอนรัน migration ใหม่ๆ แต่พอเรียกซ้ำ
-- ผ่าน HTTP ตรงๆ อีกทีกลับยังผ่านสิทธิ์เดิมได้อยู่ เพราะ PostgREST cache สิทธิ์ไว้ ไม่รู้ทันทีว่า
-- GRANT/REVOKE เปลี่ยนไปแล้วจนกว่าจะได้รับสัญญาณนี้
notify pgrst, 'reload schema';
