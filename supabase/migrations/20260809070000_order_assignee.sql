-- มอบหมายออเดอร์ให้พนักงานคนใดคนหนึ่งดูแล — ลบพนักงานทีหลังไม่ทำให้ออเดอร์เก่าพัง แค่กลายเป็นไม่มีผู้ดูแล
alter table public.orders add column assigned_to uuid references public.staff_members(id) on delete set null;
create index orders_assigned_to_idx on public.orders (assigned_to);

-- เดิม staff_members เห็นได้แค่แถวตัวเอง (หรือเจ้าของร้านเห็นทุกแถว) ทำให้พนักงานคนหนึ่งมอบหมายงาน
-- ให้อีกคนไม่ได้เพราะมองไม่เห็นรายชื่อเพื่อนร่วมงานเลย เปิดให้สมาชิก active เห็นรายชื่อสมาชิก active
-- ด้วยกันได้ (แค่ชื่อ/บทบาท ไม่ใช่ข้อมูลอ่อนไหว และกลุ่มนี้เข้าถึงออเดอร์/ลูกค้า/ยอดขายกันอยู่แล้ว)
drop policy staff_members_select on public.staff_members;
create policy staff_members_select on public.staff_members
  for select to authenticated using (
    user_id = auth.uid() or public.is_owner() or (status = 'active' and public.is_active_member())
  );
