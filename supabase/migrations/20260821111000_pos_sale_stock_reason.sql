-- ตอนสร้าง create_pos_sale ลืมเพิ่ม reason 'pos_sale' เข้า check constraint เดิมของ ingredient_stock_movements
-- ทำให้ตัดสต็อกวัตถุดิบไม่ได้เลย (insert ประวัติสต็อกชนกับ constraint เก่าที่มีแค่ 7 ค่าเดิม) — เพิ่มเข้าไปเป็นค่าที่ 8
alter table public.ingredient_stock_movements drop constraint ingredient_stock_movements_reason_check;
alter table public.ingredient_stock_movements add constraint ingredient_stock_movements_reason_check
  check (reason in (
    'order_confirm', 'order_edit_reverse', 'order_cancel_restore',
    'withdrawal_deduct', 'withdrawal_restore', 'purchase_in', 'manual_adjustment', 'pos_sale'
  ));
