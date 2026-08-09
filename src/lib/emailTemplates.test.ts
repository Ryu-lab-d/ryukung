import { describe, it, expect } from 'vitest'
import { orderConfirmedEmail, paymentReceivedEmail, paymentReminderEmail, newOrderNotificationEmail } from './emailTemplates'

describe('เทมเพลตอีเมลแจ้งลูกค้า', () => {
  it('อีเมลยืนยันรับออเดอร์ มีเลขที่ออเดอร์ ยอดรวม และลิงก์ออเดอร์', () => {
    const { subject, html } = orderConfirmedEmail({
      shopName: 'RYUKUNG BAKERY',
      orderNo: 'RYB-000123',
      customerName: 'สมชาย',
      itemsSummary: 'คุกกี้ x2',
      grandTotal: 250,
      neededDate: '2026-08-20',
      publicUrl: 'https://ryukung-pos.pages.dev/o/abc123',
    })
    expect(subject).toContain('RYB-000123')
    expect(html).toContain('RYB-000123')
    expect(html).toContain('250.00')
    expect(html).toContain('https://ryukung-pos.pages.dev/o/abc123')
    expect(html).toContain('สมชาย')
  })

  it('อีเมลแจ้งได้รับชำระเงิน โชว์ยอดคงเหลือถ้ายังไม่ครบ', () => {
    const { html } = paymentReceivedEmail({
      shopName: 'RYUKUNG BAKERY',
      orderNo: 'RYB-000123',
      customerName: 'สมชาย',
      amount: 100,
      balanceDue: 150,
      publicUrl: 'https://ryukung-pos.pages.dev/o/abc123',
    })
    expect(html).toContain('100.00')
    expect(html).toContain('150.00')
  })

  it('อีเมลแจ้งได้รับชำระเงิน โชว์ "ชำระครบแล้ว" ถ้ายอดคงเหลือเป็นศูนย์', () => {
    const { html } = paymentReceivedEmail({
      shopName: 'RYUKUNG BAKERY',
      orderNo: 'RYB-000123',
      customerName: 'สมชาย',
      amount: 250,
      balanceDue: 0,
      publicUrl: 'https://ryukung-pos.pages.dev/o/abc123',
    })
    expect(html).toContain('ชำระครบแล้ว')
  })

  it('อีเมลเตือนชำระเงิน แนบวิธีชำระเงินของร้านไว้ด้วยถ้ามี', () => {
    const { subject, html } = paymentReminderEmail({
      shopName: 'RYUKUNG BAKERY',
      orderNo: 'RYB-000123',
      customerName: 'สมชาย',
      grandTotal: 250,
      paymentInstructions: 'โอนเข้าพร้อมเพย์ 08x-xxx-xxxx',
      publicUrl: 'https://ryukung-pos.pages.dev/o/abc123',
    })
    expect(subject).toContain('RYB-000123')
    expect(html).toContain('โอนเข้าพร้อมเพย์')
    expect(html).toContain('250.00')
  })

  it('อีเมลแจ้งเจ้าของร้านว่ามีออเดอร์ใหม่ มีชื่อลูกค้าและลิงก์เข้าระบบ', () => {
    const { subject, html } = newOrderNotificationEmail({
      shopName: 'RYUKUNG BAKERY',
      orderNo: 'RYB-000123',
      customerName: 'สมชาย',
      itemsSummary: 'คุกกี้ x2',
      grandTotal: 250,
      neededDate: '2026-08-20',
      fulfillmentLabel: 'นัดรับเอง',
      orderDetailUrl: 'https://ryukung-pos.pages.dev/orders/xyz789',
    })
    expect(subject).toContain('มีออเดอร์ใหม่เข้ามา')
    expect(subject).toContain('RYB-000123')
    expect(html).toContain('สมชาย')
    expect(html).toContain('นัดรับเอง')
    expect(html).toContain('https://ryukung-pos.pages.dev/orders/xyz789')
  })
})
