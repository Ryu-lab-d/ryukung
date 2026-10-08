-- ข้อมูลลูกค้าคือสิ่งที่ต้องปกป้องที่สุด: บันทึกกิจกรรมทุกครั้งที่มีการแก้/ลบข้อมูลลูกค้า (ชื่อ เบอร์ อีเมล ที่อยู่) ว่าใครทำเมื่อไหร่
create trigger audit_customers after update or delete on public.customers for each row execute function public.audit_row();
create trigger audit_customer_addresses after update or delete on public.customer_addresses for each row execute function public.audit_row();
