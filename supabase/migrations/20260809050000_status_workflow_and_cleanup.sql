-- เพิ่มสถานะย่อยสำหรับงานที่ต้องผ่านขนส่งบริษัท/ไรเดอร์ (รอเข้ารับ/รับแล้ว/ระหว่างทาง)
-- และบังคับกฎการเปลี่ยนสถานะที่ระดับฐานข้อมูล: ห้ามข้ามขั้น + ห้ามเริ่มทำถ้ายังไม่ได้รับเงินเลย
alter table public.orders drop constraint orders_work_status_check;
alter table public.orders add constraint orders_work_status_check
  check (work_status in (
    'to_bake', 'baking', 'ready',
    'waiting_courier', 'picked_up', 'in_transit',
    'delivered', 'cancelled'
  ));

-- เวลาที่ออเดอร์เข้าสถานะ "จัดส่ง/ส่งมอบสำเร็จ" ครั้งแรก ใช้คำนวณว่าครบ 1 วันหรือยังสำหรับหน้าจัดการพื้นที่จัดเก็บ
alter table public.orders add column delivered_at timestamptz;

create or replace function public.orders_status_guard()
returns trigger
language plpgsql
as $$
declare
  -- ลำดับขั้นงานสำหรับออเดอร์แบบ "นัดรับเอง" หรือ "ร้านไปส่งเอง" ไม่ต้องมีสถานะย่อยของขนส่งบริษัท
  v_simple text[] := array['to_bake', 'baking', 'ready', 'delivered'];
  -- ลำดับขั้นงานสำหรับออเดอร์ที่ต้องผ่านขนส่งบริษัทหรือไรเดอร์ มีสถานะย่อยระหว่างทางเพิ่ม
  v_courier text[] := array['to_bake', 'baking', 'ready', 'waiting_courier', 'picked_up', 'in_transit', 'delivered'];
  v_seq text[];
  v_old_idx int;
  v_new_idx int;
begin
  if new.work_status = old.work_status or new.work_status = 'cancelled' then
    return new;
  end if;

  v_seq := case when new.fulfillment_type in ('shipping', 'rider') then v_courier else v_simple end;
  v_old_idx := array_position(v_seq, old.work_status);
  v_new_idx := array_position(v_seq, new.work_status);

  -- old_idx เป็น null ได้กรณีเดียวคือออเดอร์เคยถูกยกเลิกมาก่อน (สถานะ 'cancelled' ไม่อยู่ใน sequence) — ปล่อยผ่าน ไม่บังคับลำดับ
  if v_old_idx is not null then
    if v_new_idx is null or abs(v_new_idx - v_old_idx) <> 1 then
      raise exception 'เปลี่ยนสถานะข้ามขั้นไม่ได้ ต้องเปลี่ยนทีละขั้นตามลำดับเท่านั้น';
    end if;

    if v_new_idx > v_old_idx and old.payment_status = 'unpaid' then
      raise exception 'ลูกค้ายังไม่ชำระเงินเลย ต้องได้รับเงินอย่างน้อยมัดจำก่อนถึงจะเริ่มขั้นตอนถัดไปได้';
    end if;
  end if;

  if new.work_status = 'delivered' and old.work_status <> 'delivered' then
    new.delivered_at := now();
  elsif old.work_status = 'delivered' and new.work_status <> 'delivered' then
    new.delivered_at := null;
  end if;

  return new;
end;
$$;

create trigger orders_status_guard_trg
  before update on public.orders
  for each row
  when (new.work_status is distinct from old.work_status)
  execute function public.orders_status_guard();

-- อนุญาตให้ลบออเดอร์ที่เคยออกใบเสร็จไปแล้วได้ (ใบเสร็จจะถูกลบไปพร้อมกัน) เพื่อให้ลบออเดอร์เก่าประหยัดพื้นที่ได้จริง
alter table public.receipts drop constraint receipts_order_id_fkey;
alter table public.receipts add constraint receipts_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete cascade;
