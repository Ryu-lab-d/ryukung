-- ระบบวางแผนคอนเทนต์โซเชียล (แยกจากระบบขายโดยสิ้นเชิง) เก็บไอเดีย/บท/แฮชแท็ก/แนวตัดต่อ พร้อมสถานะความคืบหน้าแบบละเอียด
-- ต่อ 1 คอนเทนต์ลงได้หลายแพลตฟอร์มพร้อมกัน (เช่น Reels เดียวกันลงทั้ง IG และ TikTok) จึงเก็บ platforms เป็น array
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  platforms text[] not null default '{}' check (platforms <@ array['instagram', 'tiktok', 'facebook']::text[]),
  status text not null default 'idea' check (status in ('idea', 'script', 'shooting', 'editing', 'ready', 'posted')),
  idea text,
  caption text,
  hashtags text,
  editing_style text,
  reference_url text,
  note text,
  post_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_items_status_idx on public.content_items (status);
create index content_items_post_date_idx on public.content_items (post_date);

create trigger content_items_set_updated_at
  before update on public.content_items
  for each row execute function public.set_updated_at();

alter table public.content_items enable row level security;

create policy content_items_all on public.content_items
  for all to authenticated using (public.is_active_member()) with check (public.is_active_member());
