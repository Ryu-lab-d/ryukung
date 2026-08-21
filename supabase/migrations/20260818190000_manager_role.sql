-- ขยายระดับตำแหน่งให้มี "manager" (ผู้จัดการ) อยู่ระหว่างพนักงานทั่วไปกับเจ้าของร้าน
alter table public.staff_members drop constraint staff_members_role_check;
alter table public.staff_members add constraint staff_members_role_check check (role in ('owner', 'staff', 'manager'));

-- เจ้าของร้าน+ผู้จัดการ จัดการพนักงานคนอื่นได้เท่ากัน (เชิญ/อนุมัติ/ตั้งสิทธิ์หน้า/ดูรายชื่อทั้งหมด)
-- แยกจาก is_owner() เดิมไว้เจตนา ไม่แก้ความหมายของ is_owner() เพื่อไม่ให้จุดอื่นที่ใช้อยู่แล้วเปลี่ยนพฤติกรรมโดยไม่ตั้งใจ
create or replace function public.is_manager_or_owner() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_members
    where user_id = auth.uid() and status = 'active' and role in ('owner', 'manager')
  )
$$;
grant execute on function public.is_manager_or_owner() to authenticated;

drop policy staff_members_select on public.staff_members;
create policy staff_members_select on public.staff_members
  for select to authenticated using (user_id = auth.uid() or public.is_manager_or_owner());

drop policy staff_members_owner_invite on public.staff_members;
create policy staff_members_owner_invite on public.staff_members
  for insert to authenticated with check (public.is_manager_or_owner());

drop policy staff_members_owner_manage on public.staff_members;
create policy staff_members_owner_manage on public.staff_members
  for update to authenticated using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());

-- staff_members_owner_delete ไม่แตะ — ลบพนักงานยังเป็นสิทธิ์เจ้าของร้านคนเดียวเท่านั้น

-- กันผู้จัดการ (หรือใครก็ตามที่ไม่ใช่เจ้าของร้านจริง) เปลี่ยน role ของแถวไหนก็ตาม — กันเลื่อนขั้นตัวเอง/พวกพ้องเป็นเจ้าของร้าน
-- policy ด้านบนให้สิทธิ์ update ทั้งแถวได้ก็จริง แต่คอลัมน์ role ต้องเช็คแยกผ่าน trigger เพราะ RLS ทำได้แค่ระดับแถว ไม่ใช่ระดับคอลัมน์
create or replace function public.guard_staff_role_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_owner() then
    raise exception 'เปลี่ยนระดับตำแหน่งพนักงานได้เฉพาะเจ้าของร้านเท่านั้น';
  end if;
  return new;
end;
$$;

create trigger staff_members_role_change_guard
  before update on public.staff_members
  for each row execute function public.guard_staff_role_change();

-- ผู้จัดการแก้ข้อมูลร้านได้ด้วย (ฝั่ง UI โชว์แค่ชื่อร้าน/โลโก้/วิธีชำระเงินตามที่ตกลงไว้ — กันที่ฝั่งแอปเหมือน
-- ระบบสิทธิ์รายหน้าที่ทำไปก่อนหน้านี้ ไม่ใช่ RLS ระดับคอลัมน์ เพราะ Postgres RLS ไม่รองรับแบบนั้นตรงๆ)
drop policy settings_update on public.settings;
create policy settings_update on public.settings
  for update to authenticated using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());
