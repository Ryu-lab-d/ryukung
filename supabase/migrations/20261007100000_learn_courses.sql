-- คอร์สเรียนทำเบเกอรี่ (หน้า /learn): เจ้าของร้าน/ผู้จัดการสร้างคอร์ส+บทเรียน แล้วออก "รหัสเข้าเรียน" ให้นักเรียนแต่ละคน
-- นักเรียนไม่ต้องมีบัญชี — ใส่รหัสแล้วเห็นเฉพาะคอร์สที่รหัสนั้นได้สิทธิ์ ผ่านฟังก์ชัน learn_open เท่านั้น (ตารางปิด RLS ไม่ให้ anon อ่านตรง)
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  emoji text not null default '🍪',
  description text,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  -- ส่วนผสม: บรรทัดละรายการ (รูปแบบ "ชื่อ | ปริมาณ"), วิธีทำ: บรรทัดละขั้นตอน
  ingredients text,
  steps text,
  tips text,
  video_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index course_lessons_course_idx on public.course_lessons (course_id, sort_order);

create table public.course_access_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  student_name text not null,
  -- ว่าง = เข้าได้ทุกคอร์สที่เปิดสอน
  course_ids uuid[] not null default '{}',
  expires_at timestamptz,
  revoked boolean not null default false,
  use_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;
alter table public.course_lessons enable row level security;
alter table public.course_access_codes enable row level security;

create policy courses_manage on public.courses for all to authenticated
  using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());
create policy course_lessons_manage on public.course_lessons for all to authenticated
  using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());
create policy course_codes_manage on public.course_access_codes for all to authenticated
  using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());

-- นักเรียนใส่รหัส → ได้ชื่อ + คอร์สที่เปิดสอนและรหัสนี้มีสิทธิ์ พร้อมบทเรียนทั้งหมด (คืน null ถ้ารหัสผิด/ถูกยกเลิก/หมดอายุ)
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

revoke execute on function public.learn_open(text) from public;
grant execute on function public.learn_open(text) to anon, authenticated;
