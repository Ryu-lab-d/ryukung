-- สิทธิ์เข้าถึงหน้าต่างๆ ต่อพนักงาน — เจ้าของร้าน (role='owner') เข้าได้ทุกหน้าเสมอไม่ขึ้นกับคอลัมน์นี้
-- ค่าเริ่มต้นเป็นสิทธิ์เต็มทุกหน้า กันพนักงานที่ใช้งานอยู่แล้ววันนี้ไม่ให้จู่ๆ เข้าอะไรไม่ได้
alter table public.staff_members
  add column allowed_pages text[] not null default array[
    'orders','products','customers','costing','summary','expenses','withdrawals','content','ingredients','promo','storage'
  ];
