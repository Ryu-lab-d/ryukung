-- red team รอบ 2: การจำกัดอัตราแบบทั้งระบบทำให้คนร้ายยิงรหัสผิด 31 ครั้ง/นาทีแล้วล็อกนักเรียนทุกคนออกจากหน้าเรียนได้ (DoS)
-- รหัสเข้าเรียนเป็นรหัสสุ่ม 8 ตัวอักษร (~8.5 แสนล้านแบบ) เดาไม่ได้จริงอยู่แล้ว จึงเอาตัวจำกัดออก
create or replace function public.learn_open(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.course_access_codes;
  result jsonb;
begin
  select * into c from public.course_access_codes
  where code = upper(trim(coalesce(p_code, '')))
    and not revoked
    and (expires_at is null or expires_at > now());
  if not found then
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
