create or replace view public.customer_order_stats
with (security_invoker = true) as
select
  c.id as customer_id,
  count(o.id) filter (
    where o.is_draft = false and o.work_status <> 'cancelled'
  ) as order_count,
  coalesce(sum(o.grand_total) filter (
    where o.is_draft = false and o.work_status <> 'cancelled'
  ), 0) as total_spend
from public.customers c
left join public.orders o on o.customer_id = c.id
group by c.id;

grant select on public.customer_order_stats to authenticated;
