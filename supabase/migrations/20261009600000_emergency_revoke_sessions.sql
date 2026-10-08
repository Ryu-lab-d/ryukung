-- ปุ่มฉุกเฉิน "ออกจากระบบทุกอุปกรณ์": เจ้าของร้านสั่งจากอุปกรณ์ที่ปลอดภัย (เช่นมือถือ) เมื่อสงสัยว่าคอม/บัญชีถูกแฮ็ก
-- ลบเซสชันล็อกอินของทุกคน (รวมของตัวเองและของโจร) — ทุกคนต้องล็อกอินใหม่ด้วยรหัสผ่าน; โทเคนที่ออกไปแล้วใช้ต่อได้อีกไม่เกินอายุสั้นๆ (ปกติ 1 ชั่วโมง)
create or replace function public.emergency_revoke_sessions()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_count integer;
begin
  if not public.is_owner() then
    raise exception 'เฉพาะเจ้าของร้านเท่านั้น';
  end if;
  insert into public.audit_log (actor_id, actor_email, table_name, action, row_id, detail)
  values (auth.uid(), (select email from public.staff_members where user_id = auth.uid() limit 1), 'auth.sessions', 'DELETE', null,
          jsonb_build_object('emergency', 'ออกจากระบบทุกอุปกรณ์'));
  delete from auth.sessions;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.emergency_revoke_sessions() from public, anon;
grant execute on function public.emergency_revoke_sessions() to authenticated;
