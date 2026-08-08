create or replace function public.issue_receipt(p_order_id uuid, p_snapshot jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt_no text;
  v_receipt_id uuid;
begin
  v_receipt_no := public.next_receipt_no();
  insert into public.receipts (order_id, receipt_no, snapshot)
  values (p_order_id, v_receipt_no, p_snapshot)
  returning id into v_receipt_id;
  return v_receipt_id;
end;
$$;

grant execute on function public.issue_receipt(uuid, jsonb) to authenticated;

create or replace function public.reissue_receipt(p_old_receipt_id uuid, p_snapshot jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_receipt_no text;
  v_new_id uuid;
begin
  select order_id into v_order_id
    from public.receipts
   where id = p_old_receipt_id and status = 'issued';

  if v_order_id is null then
    raise exception 'ไม่พบใบเสร็จที่ยกเลิกได้ หรือใบนี้ถูกยกเลิกไปแล้ว';
  end if;

  v_receipt_no := public.next_receipt_no();
  insert into public.receipts (order_id, receipt_no, snapshot)
  values (v_order_id, v_receipt_no, p_snapshot)
  returning id into v_new_id;

  update public.receipts
     set status = 'cancelled', cancelled_at = now(), replaced_by_receipt_id = v_new_id
   where id = p_old_receipt_id;

  return v_new_id;
end;
$$;

grant execute on function public.reissue_receipt(uuid, jsonb) to authenticated;
