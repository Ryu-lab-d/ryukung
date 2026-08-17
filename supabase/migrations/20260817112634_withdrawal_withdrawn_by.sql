-- เพิ่มผู้เบิกของไปขายนอกร้าน (ใครเป็นคนรับผิดชอบรอบเบิกนี้) ผูกกับพนักงานที่มีอยู่แล้ว ไม่บังคับกรอกเผื่อกรณีไม่ได้ผูกกับพนักงานคนไหนโดยตรง
alter table public.stock_withdrawals
  add column withdrawn_by uuid references public.staff_members(id) on delete set null;
