-- เก็บเฉพาะ "คำถามที่บอทตอบไม่ได้" แบบไม่ผูกกับลูกค้าคนไหนหรือออเดอร์ไหนเลย (ไม่ใช่การบันทึกบทสนทนาทั้งหมด
-- ตามที่เคยตกลงไว้ว่าไม่บันทึกแชท) เอาไว้ให้เจ้าของร้านดูว่าควรเพิ่มคำถามอะไรเข้า FAQ บ้าง
create table public.chat_unanswered_questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  asked_count int not null default 1,
  last_asked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.chat_unanswered_questions enable row level security;

-- มีแค่พนักงาน/เจ้าของร้านที่ดูได้ ลูกค้า/บุคคลทั่วไปเข้าไม่ได้เลยแม้แต่จะอ่าน (เข้าได้ทางฟังก์ชันด้านล่างเท่านั้น)
create policy chat_unanswered_questions_staff on public.chat_unanswered_questions
  for all to authenticated using (public.is_active_member()) with check (public.is_active_member());

-- ลูกค้า (anon) เรียกได้ทางเดียวคือฟังก์ชันนี้ ไม่มีสิทธิ์เข้าตารางตรงๆ เลย เก็บแค่ข้อความคำถาม
-- ไม่เก็บ IP/token/ตัวตนใดๆ ทั้งสิ้น คำถามเดิมที่เคยมีอยู่แล้วแค่บวกตัวนับและอัปเดตเวลาแทนการเพิ่มแถวใหม่
create or replace function public.log_unanswered_chat_question(p_question text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question text := trim(coalesce(p_question, ''));
begin
  if length(v_question) = 0 or length(v_question) > 300 then
    return;
  end if;

  update public.chat_unanswered_questions
     set asked_count = asked_count + 1, last_asked_at = now()
   where question_text = v_question;

  if not found then
    insert into public.chat_unanswered_questions (question_text) values (v_question);
  end if;
end;
$$;

grant execute on function public.log_unanswered_chat_question(text) to anon, authenticated;
