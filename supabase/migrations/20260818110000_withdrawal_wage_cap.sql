-- ค่าจ้างเงินสดต้องอยู่ระหว่าง 1-30 บาทเท่านั้น (ห้ามเกิน 30 บาทตามที่ตกลงกับเจ้าของร้าน)
alter table public.stock_withdrawals
  drop constraint stock_withdrawals_wage_cash_amount_check,
  add constraint stock_withdrawals_wage_cash_amount_check
    check (wage_cash_amount is null or (wage_cash_amount >= 1 and wage_cash_amount <= 30));
