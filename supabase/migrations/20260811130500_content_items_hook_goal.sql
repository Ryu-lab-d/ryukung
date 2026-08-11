-- เพิ่มช่อง "Hook" (ประโยคเปิดดึงความสนใจ) และ "เป้าหมายการโพสต์" ให้คอนเทนต์แต่ละชิ้น แยกจากบท/แคปชั่นเต็มเพราะเป็นคนละส่วนของการวางแผน
alter table public.content_items
  add column hook text,
  add column goal text;
