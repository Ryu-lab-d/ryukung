-- อีเมลที่จะรับแจ้งเตือนเมื่อมีออเดอร์ใหม่เข้ามา (เจ้าของร้านตั้งเองได้ ไม่ต้องเป็นอีเมลล็อกอินก็ได้)
alter table public.settings add column owner_notification_email text;
