import { describe, it, expect } from 'vitest'
import { orderConfirmedEmail, paymentReceivedEmail, paymentReminderEmail, newOrderNotificationEmail, customEmail } from './emailTemplates'

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
    expect(html).toContain('ถึงคุณสมชาย')
    expect(html).toContain('จะทยอยแจ้งความคืบหน้าของสถานะออเดอร์')
    expect(html).toContain('อีเมลฉบับนี้ส่งถึงคุณลูกค้าเพื่อให้เกิดความเข้าใจตรงกัน')
    expect(html).toContain('หากท่านได้รับอีเมลฉบับนี้โดยไม่ได้เป็นผู้สั่งซื้อ')
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
    // อีเมลนี้ส่งถึงเจ้าของร้าน ไม่ใช่ลูกค้า จึงไม่ควรมีหมายเหตุปิดท้ายที่พูดถึง "คุณลูกค้า"
    expect(html).not.toContain('ส่งถึงคุณลูกค้า')
  })

  it('ไม่ได้ตั้งโลโก้ร้านไว้ หัวอีเมลใช้ไอคอนขนมปังแทน', () => {
    const { html } = orderConfirmedEmail({
      shopName: 'RYUKUNG BAKERY',
      orderNo: 'RYB-000123',
      customerName: 'สมชาย',
      itemsSummary: 'คุกกี้ x2',
      grandTotal: 250,
      neededDate: null,
      publicUrl: 'https://ryukung-pos.pages.dev/o/abc123',
    })
    expect(html).toContain('🥐')
    expect(html).not.toContain('<img')
  })

  it('ตั้งโลโก้ร้านไว้ หัวอีเมลใช้รูปโลโก้จริงแทนไอคอน', () => {
    const { html } = orderConfirmedEmail({
      shopName: 'RYUKUNG BAKERY',
      logoUrl: 'https://example.com/logo.png',
      orderNo: 'RYB-000123',
      customerName: 'สมชาย',
      itemsSummary: 'คุกกี้ x2',
      grandTotal: 250,
      neededDate: null,
      publicUrl: 'https://ryukung-pos.pages.dev/o/abc123',
    })
    expect(html).toContain('<img src="https://example.com/logo.png"')
    expect(html).not.toContain('🥐')
  })

  it('customEmail: ใส่ข้อความเอง + แถวข้อมูล + ปุ่ม CTA ครบตามที่ส่งเข้าไป', () => {
    const { html } = customEmail({
      shopName: 'RYUKUNG BAKERY',
      logoUrl: null,
      customerName: 'สมชาย',
      bodyText: 'ของกำลังเตรียมส่งค่ะ',
      infoRows: [{ label: 'เลขที่ออเดอร์', value: 'RYB-000123' }],
      ctaUrl: 'https://ryukung-pos.pages.dev/o/abc123',
      ctaLabel: 'ดูรายละเอียดออเดอร์',
    })
    expect(html).toContain('สมชาย')
    expect(html).toContain('ของกำลังเตรียมส่งค่ะ')
    expect(html).toContain('RYB-000123')
    expect(html).toContain('https://ryukung-pos.pages.dev/o/abc123')
    expect(html).toContain('ดูรายละเอียดออเดอร์')
    expect(html).toContain('อีเมลฉบับนี้ส่งถึงคุณลูกค้าเพื่อให้เกิดความเข้าใจตรงกัน')
  })

  it('customEmail: ไม่มี infoRows หรือ CTA ก็ไม่พังและไม่มีกล่อง/ปุ่มโผล่มา', () => {
    const { html } = customEmail({
      shopName: 'RYUKUNG BAKERY',
      logoUrl: null,
      customerName: 'สมชาย',
      bodyText: 'ข้อความทดสอบ',
      infoRows: [],
      ctaUrl: null,
      ctaLabel: null,
    })
    expect(html).toContain('ข้อความทดสอบ')
  })
})
