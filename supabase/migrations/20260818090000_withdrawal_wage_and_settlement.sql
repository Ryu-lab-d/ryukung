-- ค่าจ้างผู้เบิกของ (เลือกจ่ายเงินสดหรือสินค้า) + ติดตามว่าจ่ายค่าจ้างแล้วหรือยัง
-- และเงินที่เก็บได้จากการขายถูกนำมาคืนร้านแล้วหรือยัง (ของใหม่ทั้งคู่ เดิมไม่มี)
alter table public.stock_withdrawals
  add column wage_type text check (wage_type in ('cash', 'product')),
  add column wage_cash_amount numeric(10,2) check (wage_cash_amount is null or wage_cash_amount > 0),
  add column wage_paid boolean not null default false,
  add column wage_paid_at timestamptz,
  add column proceeds_received boolean not null default false,
  add column proceeds_received_at timestamptz;

-- แถวที่จ่ายให้พนักงานเป็นค่าจ้าง (ไม่ใช่ของที่เอาไปขาย) — insert เป็นแถวปกติเพื่อให้ trigger ตัดสต็อกเดิมทำงานอัตโนมัติ
-- แต่ถูกกันออกจากยอด "ขายได้กี่ชิ้น" ตอนปิดรอบ (ฝั่ง frontend, ดู withdrawalMath.ts)
alter table public.stock_withdrawal_items
  add column is_wage boolean not null default false;
