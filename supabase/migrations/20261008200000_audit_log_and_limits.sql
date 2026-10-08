-- ล็อกความปลอดภัยรอบ 2: บันทึกกิจกรรมสำคัญ (audit log) + เพดานขนาดข้อมูลกันบอทยัดข้อมูลมหาศาล

-- 1) Audit log: ใครทำอะไรกับข้อมูลสำคัญ เมื่อไหร่ — เขียนได้เฉพาะ trigger (ไม่มีใครแก้/ลบย้อนหลังได้) อ่านได้เฉพาะเจ้าของร้าน
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  table_name text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  row_id text,
  detail jsonb
);
create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_table_idx on public.audit_log (table_name, at desc);

alter table public.audit_log enable row level security;
create policy audit_log_owner_read on public.audit_log for select to authenticated using (public.is_owner());
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

-- ตัดค่าที่เป็นความลับ/ยาวเกินออกจากรายละเอียด (เก็บแค่ว่าคอลัมน์ไหนเปลี่ยน)
create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_detail jsonb;
  v_key text;
  v_email text;
  v_row jsonb := coalesce(v_new, v_old);
begin
  if tg_op = 'UPDATE' then
    v_detail := '{}'::jsonb;
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key in ('updated_at') then continue; end if;
      if v_old -> v_key is distinct from v_new -> v_key then
        v_detail := v_detail || jsonb_build_object(
          v_key,
          case when v_key ~* 'key|secret|token|pass|webhook' then jsonb_build_object('changed', true)
               else jsonb_build_object('from', left(coalesce(v_old ->> v_key, ''), 200), 'to', left(coalesce(v_new ->> v_key, ''), 200)) end
        );
      end if;
    end loop;
    if v_detail = '{}'::jsonb then
      return null;
    end if;
  else
    v_detail := jsonb_build_object('row', (
      select coalesce(jsonb_object_agg(k, case when k ~* 'key|secret|token|pass|webhook' then null else left(v, 200) end), '{}'::jsonb)
      from jsonb_each_text(v_row) as e(k, v)
    ));
  end if;

  select email into v_email from public.staff_members where user_id = auth.uid() limit 1;

  insert into public.audit_log (actor_id, actor_email, table_name, action, row_id, detail)
  values (auth.uid(), v_email, tg_table_name, tg_op, v_row ->> 'id', v_detail);

  -- เก็บ 180 วัน (ล้างเป็นครั้งคราวตอนมีการเขียน)
  if random() < 0.02 then
    delete from public.audit_log where at < now() - interval '180 days';
  end if;
  return null;
end;
$$;
revoke execute on function public.audit_row() from public, anon, authenticated;

create trigger audit_staff_members after insert or update or delete on public.staff_members for each row execute function public.audit_row();
create trigger audit_settings after update on public.settings for each row execute function public.audit_row();
create trigger audit_promotions after insert or update or delete on public.promotions for each row execute function public.audit_row();
create trigger audit_course_codes after insert or update or delete on public.course_access_codes for each row execute function public.audit_row();
create trigger audit_payments after insert or update or delete on public.payments for each row execute function public.audit_row();
create trigger audit_expenses after update or delete on public.expenses for each row execute function public.audit_row();
create trigger audit_orders_delete after delete on public.orders for each row execute function public.audit_row();
create trigger audit_invoices_delete after delete on public.invoices for each row execute function public.audit_row();
create trigger audit_withdrawals_delete after delete on public.stock_withdrawals for each row execute function public.audit_row();

-- 2) เพดานขนาดข้อมูล (ใช้กับแถวใหม่/ที่ถูกแก้ — ไม่ย้อนตรวจแถวเดิม)
alter table public.orders
  add constraint orders_note_len check (note is null or length(note) <= 2000) not valid,
  add constraint orders_ship_address_len check (ship_address_text is null or length(ship_address_text) <= 1000) not valid,
  add constraint orders_pickup_place_len check (pickup_place is null or length(pickup_place) <= 300) not valid;
alter table public.order_items
  add constraint order_items_qty_max check (qty <= 10000) not valid;
alter table public.customers
  add constraint customers_name_len check (length(name) <= 200) not valid;
