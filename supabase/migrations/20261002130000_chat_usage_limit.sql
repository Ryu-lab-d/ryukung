-- ตัวนับข้อความแชทบอท AI ต่อวัน — กันคนยิงรัวหรือใช้เป็น AI ฟรี (ค่าใช้จ่ายต่อข้อความตกที่ร้าน)
-- เก็บแค่คีย์ที่ hash แล้ว (ip:<hash> หรือ 'global') ไม่เก็บ IP จริง ไม่เก็บเนื้อหาแชท
create table if not exists public.chat_usage (
  usage_key text not null,
  usage_date date not null,
  message_count integer not null default 0,
  primary key (usage_key, usage_date)
);

-- เปิด RLS โดยไม่มี policy เลย = มีแต่ service_role (Edge Function) เท่านั้นที่เข้าถึงได้
alter table public.chat_usage enable row level security;

-- นับ +1 แล้วคืน true ถ้ายังไม่เกินโควตา (วันนับตามเวลากรุงเทพฯ) ลบแถวเก่าเกิน 7 วันทิ้งไปในตัว ตารางเล็กมาก
create or replace function public.bump_chat_usage(p_key text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.chat_usage where usage_date < (now() at time zone 'Asia/Bangkok')::date - 7;

  insert into public.chat_usage as u (usage_key, usage_date, message_count)
  values (p_key, (now() at time zone 'Asia/Bangkok')::date, 1)
  on conflict (usage_key, usage_date) do update set message_count = u.message_count + 1
  returning u.message_count into v_count;

  return v_count <= p_limit;
end;
$$;

-- ต้อง revoke จาก public ด้วย ไม่ใช่แค่ anon/authenticated (Postgres ให้ EXECUTE กับ PUBLIC อัตโนมัติ — ดู CLAUDE.md)
revoke execute on function public.bump_chat_usage(text, integer) from public, anon, authenticated;
grant execute on function public.bump_chat_usage(text, integer) to service_role;

notify pgrst, 'reload schema';
