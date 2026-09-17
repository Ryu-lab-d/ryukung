-- ยิง sync ไป Google Sheets แบบ real-time ทันทีที่ตารางหลักเปลี่ยน — เรียก edge function sync-sheets-tab
-- ผ่าน pg_net (async ในตัว ไม่รอ response ธุรกรรมเดิมจึงไม่ช้าลง) ติด trigger แค่ 8 ตารางที่จำเป็นจริงๆ
-- (order_items/payments ไม่ต้องแยก trigger เพิ่ม เพราะมี trigger เดิม order_items_touch_trg/
-- payments_touch_trg ใน 20260808133328_order_computed_fields.sql ที่ update orders อยู่แล้วทุกครั้งที่สอง
-- ตารางนี้เปลี่ยน ⇒ trigger บน orders ตัวเดียวครอบคลุมไปถึงด้วย)
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_sheets_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://blvjphxlhvtbaqejzsru.supabase.co/functions/v1/sync-sheets-tab',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('table', TG_TABLE_NAME)
  );
  return null;
end;
$$;

create trigger sync_sheets_orders_trg
  after insert or update or delete on public.orders
  for each statement execute function public.notify_sheets_sync();

create trigger sync_sheets_customers_trg
  after insert or update or delete on public.customers
  for each statement execute function public.notify_sheets_sync();

create trigger sync_sheets_staff_members_trg
  after insert or update or delete on public.staff_members
  for each statement execute function public.notify_sheets_sync();

create trigger sync_sheets_content_items_trg
  after insert or update or delete on public.content_items
  for each statement execute function public.notify_sheets_sync();

create trigger sync_sheets_cost_recipes_trg
  after insert or update or delete on public.cost_recipes
  for each statement execute function public.notify_sheets_sync();

create trigger sync_sheets_cost_recipe_ingredients_trg
  after insert or update or delete on public.cost_recipe_ingredients
  for each statement execute function public.notify_sheets_sync();

create trigger sync_sheets_cost_recipe_labor_trg
  after insert or update or delete on public.cost_recipe_labor
  for each statement execute function public.notify_sheets_sync();

create trigger sync_sheets_expenses_trg
  after insert or update or delete on public.expenses
  for each statement execute function public.notify_sheets_sync();
