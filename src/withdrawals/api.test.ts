import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWithdrawal, settleWithdrawal } from './api'

const logWithdrawalToSheets = vi.fn()
vi.mock('../lib/sheetsArchive', () => ({
  logWithdrawalToSheets: (...args: unknown[]) => logWithdrawalToSheets(...args),
}))

const from = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: { from: (...args: unknown[]) => from(...args) } }))

beforeEach(() => {
  from.mockReset()
  logWithdrawalToSheets.mockReset()
  logWithdrawalToSheets.mockResolvedValue({ error: null })
})

describe('createWithdrawal — บันทึกลง Google Sheets ตอนเริ่มเบิก', () => {
  function mockTables() {
    from.mockImplementation((table: string) => {
      if (table === 'stock_withdrawals') {
        return {
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'w1' }, error: null }) }) }),
        }
      }
      if (table === 'stock_withdrawal_items') {
        return { insert: () => Promise.resolve({ error: null }) }
      }
      if (table === 'staff_members') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: { display_name: 'น้องริว', email: 'ryu@example.com' } }) }),
          }),
        }
      }
      throw new Error('unexpected table ' + table)
    })
  }

  it('เบิกของสำเร็จ บันทึก event created ลง Sheets พร้อมชื่อผู้เบิกและสรุปรายการ', async () => {
    mockTables()
    const { id, error } = await createWithdrawal({
      withdrawnAt: '2026-08-18',
      location: 'โรงเรียน',
      note: null,
      withdrawnBy: 's2',
      wage: { type: 'cash', amount: 30 },
      items: [{ product_id: 'p1', product_name: 'คุกกี้', unit_price: 40, unit_cost: 15, qty_out: 20 }],
    })
    expect(error).toBeNull()
    expect(id).toBe('w1')
    expect(logWithdrawalToSheets).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'created',
        withdrawal_id: 'w1',
        withdrawn_by: 'น้องริว',
        items_summary: 'คุกกี้ x20',
        qty_out_total: 20,
        cost: 300,
        qty_sold_total: null,
        revenue: null,
        wage_summary: 'เงินสด 30 บาท',
        status: 'open',
      })
    )
  })

  it('ไม่ได้เลือกผู้เบิก ส่ง withdrawn_by เป็น null ไม่ยิงคิวรี staff_members', async () => {
    mockTables()
    await createWithdrawal({
      withdrawnAt: '2026-08-18',
      location: null,
      note: null,
      withdrawnBy: null,
      wage: null,
      items: [{ product_id: 'p1', product_name: 'คุกกี้', unit_price: 40, unit_cost: 15, qty_out: 5 }],
    })
    expect(logWithdrawalToSheets).toHaveBeenCalledWith(expect.objectContaining({ withdrawn_by: null, wage_summary: null }))
  })

  it('บันทึกลง Sheets ไม่สำเร็จ ไม่กระทบผลลัพธ์การเบิก (ไม่บล็อก)', async () => {
    mockTables()
    logWithdrawalToSheets.mockResolvedValue({ error: 'บันทึกลง Google Sheets ไม่สำเร็จ' })
    const { id, error } = await createWithdrawal({
      withdrawnAt: '2026-08-18',
      location: null,
      note: null,
      withdrawnBy: null,
      wage: null,
      items: [{ product_id: 'p1', product_name: 'คุกกี้', unit_price: 40, unit_cost: 15, qty_out: 5 }],
    })
    expect(error).toBeNull()
    expect(id).toBe('w1')
  })
})

describe('settleWithdrawal — บันทึกลง Google Sheets ตอนปิดรอบ', () => {
  function mockTables(opts: { wageType?: string | null; wageCashAmount?: number | null } = {}) {
    from.mockImplementation((table: string) => {
      if (table === 'stock_withdrawal_items') {
        return {
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [
                  { id: 'i1', product_id: 'p1', product_name: 'คุกกี้', unit_price: 40, unit_cost: 15, qty_out: 20, qty_sold: 18, amount_collected: 720, is_wage: false },
                ],
                error: null,
              }),
          }),
        }
      }
      if (table === 'stock_withdrawals') {
        return {
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: 'w1',
                    withdrawn_at: '2026-08-18',
                    location: 'โรงเรียน',
                    wage_type: opts.wageType ?? null,
                    wage_cash_amount: opts.wageCashAmount ?? null,
                    wage_paid: false,
                    staff_members: { display_name: 'น้องริว', email: 'ryu@example.com' },
                  },
                  error: null,
                }),
            }),
          }),
        }
      }
      throw new Error('unexpected table ' + table)
    })
  }

  it('ปิดรอบสำเร็จ บันทึก event settled ลง Sheets พร้อมยอดขาย/กำไรที่คำนวณจริง', async () => {
    mockTables({ wageType: 'cash', wageCashAmount: 30 })
    const { error } = await settleWithdrawal('w1', [{ id: 'i1', qty_sold: 18, amount_collected: 720 }])
    expect(error).toBeNull()
    expect(logWithdrawalToSheets).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'settled',
        withdrawal_id: 'w1',
        withdrawn_by: 'น้องริว',
        qty_out_total: 20,
        qty_sold_total: 18,
        revenue: 720,
        cost: 300, // 20*15
        profit: 420,
        wage_summary: 'เงินสด 30 บาท',
        status: 'settled',
      })
    )
  })

  it('ไม่มีค่าจ้าง wage_summary เป็น null', async () => {
    mockTables({ wageType: null })
    await settleWithdrawal('w1', [{ id: 'i1', qty_sold: 18, amount_collected: 720 }])
    expect(logWithdrawalToSheets).toHaveBeenCalledWith(expect.objectContaining({ wage_summary: null }))
  })

  it('บันทึกลง Sheets ไม่สำเร็จ ไม่กระทบผลลัพธ์การปิดรอบ (ไม่บล็อก)', async () => {
    mockTables()
    logWithdrawalToSheets.mockResolvedValue({ error: 'บันทึกลง Google Sheets ไม่สำเร็จ' })
    const { error } = await settleWithdrawal('w1', [{ id: 'i1', qty_sold: 18, amount_collected: 720 }])
    expect(error).toBeNull()
  })
})
