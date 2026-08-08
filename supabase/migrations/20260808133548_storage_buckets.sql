insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('slips', 'slips', false)
on conflict (id) do nothing;

-- รูปสินค้าและโลโก้: ใครก็ดูได้ แต่เฉพาะคนล็อกอินที่แก้ได้
create policy product_images_read on storage.objects
  for select to public using (bucket_id = 'product-images');
create policy product_images_write on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');
create policy product_images_update on storage.objects
  for update to authenticated using (bucket_id = 'product-images');
create policy product_images_delete on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');

-- สลิปโอนเงิน: เฉพาะคนล็อกอินเท่านั้น เพราะมีข้อมูลส่วนตัวลูกค้า
create policy slips_read on storage.objects
  for select to authenticated using (bucket_id = 'slips');
create policy slips_write on storage.objects
  for insert to authenticated with check (bucket_id = 'slips');
create policy slips_delete on storage.objects
  for delete to authenticated using (bucket_id = 'slips');
