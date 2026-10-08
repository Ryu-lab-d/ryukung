-- ผลจากการจำลองแฮ็กเอง (red team) รอบที่ 1 — อุดช่องที่เจอ
--  1) เดาโค้ดส่วนลด/รหัสเข้าเรียนรัวๆ ได้ไม่จำกัด → จำกัดความพยายามที่ "ผิด" ทั้งระบบนาทีละ 30 ครั้ง (ถูกไม่นับ)
--  2) log_unanswered_chat_question ยัดคำถามแปลกๆ ไม่จำกัด → ตารางบวมได้ → จำกัดจำนวนแถวรวม
--  3) update_public_order_address ไม่จำกัดความยาว → จำกัด
--  4) claim_staff_invite: สมัครบัญชีได้เปิดกว้าง → ไม่สร้างคำขอ pending เพิ่มเมื่อเต็ม 25 และต้องยืนยันอีเมลแล้วถึงจะจับคู่คำเชิญได้
--  5) ลิงก์ (line_url/video_url) ต้องเป็น http(s) เท่านั้น กัน javascript:/data:

-- ตัวช่วยจำกัดอัตรา (ภายในเท่านั้น): ใช้ตาราง chat_usage ที่มีอยู่ แยกคีย์ต่อนาที
create or replace function public.throttle_ok(p_key text, p_limit integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select message_count from public.chat_usage where usage_key = p_key and usage_date = (now() at time zone 'Asia/Bangkok')::date), 0) < p_limit
$$;

create or replace function public.throttle_hit(p_key text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.chat_usage as u (usage_key, usage_date, message_count)
  values (p_key, (now() at time zone 'Asia/Bangkok')::date, 1)
  on conflict (usage_key, usage_date) do update set message_count = u.message_count + 1
$$;
revoke execute on function public.throttle_ok(text, integer) from public, anon, authenticated;
revoke execute on function public.throttle_hit(text) from public, anon, authenticated;

-- (1a) ตรวจโค้ดส่วนลด
create or replace function public.check_promo_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.promotions;
  v_key text := 'promo-fail:' || to_char(now() at time zone 'Asia/Bangkok', 'YYYYMMDDHH24MI');
begin
  if not public.throttle_ok(v_key, 30) then
    return jsonb_build_object('valid', false, 'message', 'ลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่');
  end if;
  select * into p from public.promotions where code is not null and upper(code) = upper(trim(coalesce(p_code, '')));
  if not found or not public.promo_is_live(p) then
    perform public.throttle_hit(v_key);
    return jsonb_build_object('valid', false, 'message', 'โค้ดส่วนลดไม่ถูกต้อง หมดอายุ หรือถูกใช้ครบแล้ว');
  end if;
  return jsonb_build_object('valid', true, 'promotion', jsonb_build_object(
    'id', p.id, 'name', p.name, 'description', p.description, 'code', upper(p.code), 'kind', p.kind, 'value', p.value,
    'min_subtotal', p.min_subtotal, 'max_discount', p.max_discount, 'ends_at', p.ends_at
  ));
end;
$$;

-- (1b) เข้าเรียนด้วยรหัส
create or replace function public.learn_open(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.course_access_codes;
  result jsonb;
  v_key text := 'learn-fail:' || to_char(now() at time zone 'Asia/Bangkok', 'YYYYMMDDHH24MI');
begin
  if not public.throttle_ok(v_key, 30) then
    return null;
  end if;
  select * into c from public.course_access_codes
  where code = upper(trim(coalesce(p_code, '')))
    and not revoked
    and (expires_at is null or expires_at > now());
  if not found then
    perform public.throttle_hit(v_key);
    return null;
  end if;

  update public.course_access_codes set use_count = use_count + 1, last_used_at = now() where id = c.id;

  select jsonb_build_object(
    'student_name', c.student_name,
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', co.id, 'title', co.title, 'emoji', co.emoji, 'description', co.description,
        'lessons', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', l.id, 'title', l.title, 'ingredients', l.ingredients, 'steps', l.steps, 'tips', l.tips, 'video_url', l.video_url
          ) order by l.sort_order, l.created_at)
          from public.course_lessons l where l.course_id = co.id
        ), '[]'::jsonb)
      ) order by co.sort_order, co.created_at)
      from public.courses co
      where co.is_published and (cardinality(c.course_ids) = 0 or co.id = any (c.course_ids))
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- (2) คำถามที่แชทบอทตอบไม่ได้: คำถามละไม่เกิน 300 ตัวอักษร และเก็บรวมไม่เกิน 500 แถว (ตัดที่เก่าสุดทิ้ง)
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
    delete from public.chat_unanswered_questions
     where id in (select id from public.chat_unanswered_questions order by last_asked_at desc offset 500);
  end if;
end;
$$;

-- (3) แก้ที่อยู่ผ่านลิงก์ติดตาม: จำกัดความยาว
create or replace function public.update_public_order_address(p_token text, p_recipient_name text, p_recipient_phone text, p_address_text text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_token is null or length(p_token) < 20 then
    return false;
  end if;

  if p_address_text is null or length(trim(p_address_text)) = 0 then
    raise exception 'กรุณากรอกที่อยู่';
  end if;
  if length(p_address_text) > 600 or length(coalesce(p_recipient_name, '')) > 200 or length(coalesce(p_recipient_phone, '')) > 30 then
    raise exception 'ข้อมูลยาวเกินไป';
  end if;

  select * into v_order
    from public.orders
   where public_token = p_token
     and is_draft = false
     and work_status <> 'cancelled';

  if not found then
    return false;
  end if;

  if v_order.fulfillment_type = 'pickup' then
    raise exception 'ออเดอร์นี้เป็นแบบนัดรับ ไม่มีที่อยู่จัดส่งให้แก้ไข';
  end if;

  if v_order.work_status not in ('to_bake', 'baking') then
    raise exception 'ออเดอร์นี้เลยขั้นตอนที่แก้ไขที่อยู่ได้แล้ว กรุณาติดต่อร้านโดยตรง';
  end if;

  update public.orders set
    ship_recipient_name  = p_recipient_name,
    ship_recipient_phone = p_recipient_phone,
    ship_address_text    = p_address_text,
    address_edited_at     = now()
  where id = v_order.id;

  return true;
end;
$$;

-- (4) สมัครสมาชิกเปิดกว้างได้ แต่ไม่ให้ใครยัดคำขอ pending ท่วมตาราง และต้องยืนยันอีเมลแล้วเท่านั้นถึงรับคำเชิญได้
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
  v_confirmed timestamptz;
begin
  if auth.uid() is null then
    raise exception 'ต้องล็อกอินก่อน';
  end if;
  if length(coalesce(p_display_name, '')) > 100 then
    raise exception 'ชื่อยาวเกินไป';
  end if;

  select status into v_status from public.staff_members where user_id = auth.uid();
  if v_status is not null then
    return v_status;
  end if;

  select email_confirmed_at into v_confirmed from auth.users where id = auth.uid();
  if v_confirmed is null then
    raise exception 'กรุณายืนยันอีเมลก่อน';
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

  if (select count(*) from public.staff_members where status = 'pending') >= 25 then
    raise exception 'ตอนนี้รับคำขอเข้าร่วมเต็มชั่วคราว กรุณาติดต่อเจ้าของร้านโดยตรง';
  end if;

  insert into public.staff_members (user_id, email, display_name, role, status)
  values (auth.uid(), v_email, p_display_name, 'staff', 'pending');
  return 'pending';
end;
$$;

-- (5) ลิงก์ต้องเป็น http(s)
alter table public.settings add constraint settings_line_url_http check (line_url is null or line_url = '' or line_url ~* '^https?://') not valid;
alter table public.course_lessons add constraint course_lessons_video_http check (video_url is null or video_url ~* '^https?://') not valid;
