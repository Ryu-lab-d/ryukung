-- ล็อก submit_customer_order ไม่ให้ anon เรียกตรงๆ ผ่าน PostgREST ได้อีกต่อไป — เดิม anon เรียกตรงได้เลย
-- (grant execute ... to anon) ทำให้บอท/สคริปต์อัตโนมัติยิง POST ตรงไปที่ /rest/v1/rpc/submit_customer_order
-- ข้าม frontend และการตรวจ Cloudflare Turnstile ทั้งหมดได้ทันที ต่อให้ frontend มี CAPTCHA ก็ไม่มีความหมาย
-- เลยถ้า RPC ยังเปิดให้เรียกตรงอยู่ ตอนนี้บังคับให้ต้องผ่าน Edge Function submit-customer-order เท่านั้น
-- (เรียกด้วย service role key ฝั่งเซิร์ฟเวอร์ ไม่ใช่ anon key ที่ฝังอยู่ใน frontend) ซึ่งจะตรวจ token จาก
-- Turnstile ก่อนเสมอถึงจะเรียกฟังก์ชันนี้ให้

revoke execute on function public.submit_customer_order(
  text, text, text, text, date, text, text, text, text, text, text, jsonb
) from anon, authenticated;

grant execute on function public.submit_customer_order(
  text, text, text, text, date, text, text, text, text, text, text, jsonb
) to service_role;
