-- คำนวณ line_total ของแต่ละรายการให้เอง
create or replace function public.order_items_compute()
returns trigger
language plpgsql
as $$
begin
  new.line_total := round(new.unit_price * new.qty, 2);
  return new;
end;
$$;

create trigger order_items_compute_trg
  before insert or update on public.order_items
  for each row execute function public.order_items_compute();

-- คำนวณยอดรวมและสถานะเงินของออเดอร์
create or replace function public.orders_compute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items numeric(12,2) := 0;
  v_cost  numeric(12,2) := 0;
  v_paid  numeric(12,2) := 0;
  v_disc  numeric(12,2) := 0;
begin
  select coalesce(sum(line_total), 0), coalesce(sum(round(unit_cost * qty, 2)), 0)
    into v_items, v_cost
    from public.order_items where order_id = new.id;

  select coalesce(sum(amount), 0) into v_paid
    from public.payments where order_id = new.id;

  if new.discount_type = 'percent' then
    v_disc := round(v_items * new.discount_value / 100, 2);
  elsif new.discount_type = 'amount' then
    v_disc := new.discount_value;
  else
    v_disc := 0;
  end if;
  if v_disc > v_items then v_disc := v_items; end if;

  new.items_total      := v_items;
  new.items_cost_total := v_cost;
  new.discount_amount  := v_disc;
  new.grand_total      := v_items - v_disc + coalesce(new.shipping_fee, 0);

  if new.grand_total <= 0 then
    new.payment_status := 'paid';
  elsif v_paid <= 0 then
    new.payment_status := 'unpaid';
  elsif v_paid < new.grand_total then
    new.payment_status := 'partial';
  else
    new.payment_status := 'paid';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger orders_compute_trg
  before insert or update on public.orders
  for each row execute function public.orders_compute();

-- เมื่อรายการสินค้าหรือการชำระเงินเปลี่ยน ให้ไปสะกิดออเดอร์ให้คำนวณใหม่
create or replace function public.touch_parent_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
     set updated_at = now()
   where id = coalesce(new.order_id, old.order_id);
  return null;
end;
$$;

create trigger order_items_touch_trg
  after insert or update or delete on public.order_items
  for each row execute function public.touch_parent_order();

create trigger payments_touch_trg
  after insert or update or delete on public.payments
  for each row execute function public.touch_parent_order();
