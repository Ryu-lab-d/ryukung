-- ปิดช่องโหว่ที่ Supabase Security Advisor ชี้ + ที่ทดสอบยิงจริงแล้วเจอ

-- 1) adjust_stock_for_order เป็น security definer ที่ไม่มีการตรวจสิทธิ์ในตัว (ต่างจากฟังก์ชันอื่นของพนักงานที่เช็ก
--    is_active_member ภายในเอง) แต่ anon เรียกผ่าน /rest/v1/rpc ได้ (ทดสอบแล้วได้ HTTP 204 = ทำงานสำเร็จ) ฟังก์ชันนี้
--    ถูกเรียกจากฟังก์ชัน security definer อื่นภายในฐานข้อมูลเท่านั้น (confirm_order, create_pos_sale, trigger ยกเลิก
--    ออเดอร์) หน้าเว็บไม่เคยเรียกตรง จึงปิดสิทธิ์ทุก role ภายนอกได้โดยไม่กระทบ — ต้อง revoke จาก public ด้วย ไม่ใช่แค่
--    anon/authenticated (Postgres ให้ EXECUTE กับ PUBLIC อัตโนมัติตอนสร้างฟังก์ชัน ดู CLAUDE.md)
revoke execute on function public.adjust_stock_for_order(uuid, text, text) from public, anon, authenticated;

-- 2) trigger functions ที่ search_path ไม่ถูกตรึง (function_search_path_mutable) — ตรึงเป็น public เหมือนฟังก์ชันอื่น
alter function public.set_updated_at() set search_path = public;
alter function public.receipts_freeze() set search_path = public;
alter function public.order_items_compute() set search_path = public;
alter function public.orders_status_guard() set search_path = public;
alter function public.track_needed_date_change() set search_path = public;

notify pgrst, 'reload schema';
