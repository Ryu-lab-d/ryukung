-- แก้บั๊ก: ถ้าเจ้าของร้านกดอนุมัติแถวคำเชิญที่ยังไม่มีใครมาสมัครจริง (user_id ยังเป็น null) ไปก่อน
-- status จะกลายเป็น 'active' ทั้งที่ยังไม่มีบัญชีจริงผูกอยู่เลย ทำให้ตอนพนักงานสมัครจริงด้วยอีเมลเดียวกัน
-- หาแถวไม่เจอ (เงื่อนไขเดิมบังคับ status = 'pending' เท่านั้น) กลายเป็นสร้างแถวใหม่ซ้ำ ค้างรออนุมัติอีกรอบไม่รู้จบ
-- เงื่อนไขที่ถูกต้องคือเช็คแค่ "ยังไม่มีบัญชีผูก" (user_id is null) เท่านั้น ไม่สนสถานะ ยกเว้นถูกระงับไปแล้วจริงๆ
-- (กันคนที่เจ้าของร้านตั้งใจระงับคำเชิญไปแล้ว ไม่ให้กลับมาผูกบัญชีเองได้อีก)
create or replace function public.claim_staff_invite(p_display_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := auth.email();
  v_matched uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'ต้องล็อกอินก่อน';
  end if;

  select status into v_status from public.staff_members where user_id = auth.uid();
  if v_status is not null then
    return v_status;
  end if;

  select id into v_matched
    from public.staff_members
   where lower(email) = lower(v_email) and user_id is null and status <> 'revoked'
   limit 1;

  if v_matched is not null then
    update public.staff_members
       set user_id = auth.uid(), status = 'active', display_name = coalesce(p_display_name, display_name)
     where id = v_matched;
    return 'active';
  end if;

  insert into public.staff_members (user_id, email, display_name, role, status)
  values (auth.uid(), v_email, p_display_name, 'staff', 'pending');
  return 'pending';
end;
$$;
