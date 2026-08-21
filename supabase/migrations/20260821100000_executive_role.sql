-- เพิ่มระดับตำแหน่ง "executive" (ผู้บริหาร) แทรกระหว่างเจ้าของร้านกับผู้จัดการ
-- ลำดับสิทธิ์: owner > executive > manager > staff
-- ผู้บริหารสืบทอดสิทธิ์ผู้จัดการทั้งหมด (ผ่าน is_manager_or_owner() ที่ขยายไว้ด้านล่าง)
-- ต่างจากผู้จัดการตรงที่: (1) แก้ settings ได้ครบทุกช่องเหมือนเจ้าของร้าน (2) เปลี่ยน role คนอื่นได้ แต่จำกัดแค่ staff<->manager
alter table public.staff_members drop constraint staff_members_role_check;
alter table public.staff_members add constraint staff_members_role_check check (role in ('owner', 'staff', 'manager', 'executive'));

-- ขยาย is_manager_or_owner() ให้รวม executive — เช็คแล้วว่าทั้ง repo เรียกฟังก์ชันนี้แค่ 4 จุด (ในไฟล์ migration
-- 20260818190000 เท่านั้น) ไม่มีจุดไหนคาดหวังให้กีดกัน role ที่สูงกว่า manager ออก จึงขยาย in-place ได้ปลอดภัย
-- ต่างจาก is_owner() ที่ตั้งใจไม่แตะ เพราะ staff_members_owner_delete ต้องการเจ้าของร้านจริงเท่านั้น
-- create or replace ไม่ต้อง drop/recreate 4 policy ที่ผูกอยู่ (staff_members_select, staff_members_owner_invite,
-- staff_members_owner_manage, settings_update) — Postgres ผูก policy กับฟังก์ชันด้วย OID ไม่ใช่ข้อความ
create or replace function public.is_manager_or_owner() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_members
    where user_id = auth.uid() and status = 'active' and role in ('owner', 'manager', 'executive')
  )
$$;

-- ฟังก์ชันใหม่ เช็คเฉพาะ "เป็นผู้บริหารจริงๆ" (ไม่รวม manager/owner) ใช้แยกใน trigger ด้านล่างเท่านั้น —
-- ห้ามใช้ is_manager_or_owner() ในเงื่อนไข trigger เพราะจะทำให้ผู้จัดการได้สิทธิ์เปลี่ยน role ไปด้วยโดยไม่ตั้งใจ
create or replace function public.is_executive() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_members
    where user_id = auth.uid() and status = 'active' and role = 'executive'
  )
$$;
grant execute on function public.is_executive() to authenticated;

-- ขยาย guard: เจ้าของร้านเปลี่ยน role อะไรก็ได้เหมือนเดิม (ไม่แตะ) เพิ่มผู้บริหารเปลี่ยนได้เฉพาะ staff<->manager
-- เงื่อนไข old.role/new.role in ('staff','manager') กันครบทุกกรณีต้องห้ามในตัวเองอยู่แล้ว:
--   เปลี่ยน role ตัวเอง -> แถวตัวเอง old.role='executive' ไม่อยู่ในเซ็ต -> ติด
--   เลื่อนใครเป็น executive -> new.role='executive' ไม่อยู่ในเซ็ต -> ติด
--   แตะแถว owner -> old.role='owner' ไม่อยู่ในเซ็ต -> ติด
--   แตะแถว executive คนอื่น -> old.role='executive' ไม่อยู่ในเซ็ต -> ติด
-- trigger staff_members_role_change_guard เดิมผูกกับฟังก์ชันนี้อยู่แล้ว ไม่ต้อง create trigger ใหม่
create or replace function public.guard_staff_role_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and not public.is_owner()
     and not (
       public.is_executive()
       and old.role in ('staff', 'manager')
       and new.role in ('staff', 'manager')
     )
  then
    raise exception 'เปลี่ยนระดับตำแหน่งพนักงานได้เฉพาะเจ้าของร้าน หรือผู้บริหาร (จำกัดแค่พนักงาน/ผู้จัดการ) เท่านั้น';
  end if;
  return new;
end;
$$;

-- staff_members_owner_delete ไม่แตะ — ลบพนักงานยังเป็นสิทธิ์เจ้าของร้านคนเดียว (เหมือน manager ที่ก็ไม่มีสิทธิ์นี้)
