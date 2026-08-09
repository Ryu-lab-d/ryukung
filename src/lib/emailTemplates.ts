import { formatBaht } from './money'

function shell(shopName: string, bodyHtml: string): string {
  return `<div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; background:#fbf1e4; padding:32px 16px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#3d2b1f;padding:24px;text-align:center;">
      <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">🥐 ${shopName}</p>
    </div>
    <div style="padding:28px 26px;font-size:15px;line-height:1.6;color:#514234;">
      ${bodyHtml}
    </div>
    <div style="padding:16px 26px;background:#f7ede0;text-align:center;">
      <p style="margin:0;font-size:12px;color:#a1927d;">อีเมลนี้ส่งอัตโนมัติจากระบบร้าน กรุณาอย่าตอบกลับอีเมลฉบับนี้โดยตรง</p>
    </div>
  </div>
</div>`
}

function ctaButton(url: string, label: string): string {
  return `<div style="text-align:center;margin:20px 0 4px;">
    <a href="${url}" style="display:inline-block;background:#3d2b1f;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:999px;">${label}</a>
  </div>`
}

function infoBox(rows: { label: string; value: string }[]): string {
  const inner = rows.map((r) => `<p style="margin:0 0 6px;"><strong>${r.label}:</strong> ${r.value}</p>`).join('')
  return `<div style="background:#f7ede0;border-radius:12px;padding:14px 16px;margin:16px 0;">${inner}</div>`
}

export function orderConfirmedEmail(params: {
  shopName: string
  orderNo: string
  customerName: string
  itemsSummary: string
  grandTotal: number
  neededDate: string | null
  publicUrl: string
}) {
  const { shopName, orderNo, customerName, itemsSummary, grandTotal, neededDate, publicUrl } = params
  const rows = [
    { label: 'เลขที่ออเดอร์', value: orderNo },
    { label: 'รายการ', value: itemsSummary },
    ...(neededDate ? [{ label: 'วันที่นัดรับ/ส่ง', value: neededDate }] : []),
    { label: 'ยอดรวม', value: `${formatBaht(grandTotal)} บาท` },
  ]
  return {
    subject: `✅ ยืนยันรับออเดอร์ ${orderNo} — ${shopName}`,
    html: shell(
      shopName,
      `<p>สวัสดีคุณ${customerName} 🙏</p>
       <p>ร้านได้รับออเดอร์ของคุณเรียบร้อยแล้วค่ะ รายละเอียดดังนี้:</p>
       ${infoBox(rows)}
       ${ctaButton(publicUrl, 'ดูรายละเอียดออเดอร์')}`
    ),
  }
}

export function paymentReceivedEmail(params: {
  shopName: string
  orderNo: string
  customerName: string
  amount: number
  balanceDue: number
  publicUrl: string
}) {
  const { shopName, orderNo, customerName, amount, balanceDue, publicUrl } = params
  const rows = [
    { label: 'เลขที่ออเดอร์', value: orderNo },
    { label: 'ยอดที่ได้รับ', value: `${formatBaht(amount)} บาท` },
    { label: 'ยอดคงเหลือ', value: balanceDue > 0 ? `${formatBaht(balanceDue)} บาท` : 'ชำระครบแล้ว 🎉' },
  ]
  return {
    subject: `💰 ได้รับชำระเงินแล้ว ออเดอร์ ${orderNo} — ${shopName}`,
    html: shell(
      shopName,
      `<p>สวัสดีคุณ${customerName} 🙏</p>
       <p>ร้านได้รับการชำระเงินของคุณเรียบร้อยแล้วค่ะ ขอบคุณมากนะคะ</p>
       ${infoBox(rows)}
       ${ctaButton(publicUrl, 'ดูรายละเอียดออเดอร์')}`
    ),
  }
}

export function newOrderNotificationEmail(params: {
  shopName: string
  orderNo: string
  customerName: string
  itemsSummary: string
  grandTotal: number
  neededDate: string | null
  fulfillmentLabel: string
  orderDetailUrl: string
}) {
  const { shopName, orderNo, customerName, itemsSummary, grandTotal, neededDate, fulfillmentLabel, orderDetailUrl } = params
  const rows = [
    { label: 'เลขที่ออเดอร์', value: orderNo },
    { label: 'ลูกค้า', value: customerName },
    { label: 'รายการ', value: itemsSummary },
    { label: 'วิธีรับของ', value: fulfillmentLabel },
    ...(neededDate ? [{ label: 'วันที่ต้องได้ของ', value: neededDate }] : []),
    { label: 'ยอดรวม', value: `${formatBaht(grandTotal)} บาท` },
  ]
  return {
    subject: `🔔 มีออเดอร์ใหม่เข้ามา! ${orderNo} — ${shopName}`,
    html: shell(
      shopName,
      `<p>มีออเดอร์ใหม่เข้ามาแล้วค่ะ 🎉</p>
       ${infoBox(rows)}
       ${ctaButton(orderDetailUrl, 'ดูออเดอร์ในระบบ')}`
    ),
  }
}

export function paymentReminderEmail(params: {
  shopName: string
  orderNo: string
  customerName: string
  grandTotal: number
  paymentInstructions: string | null
  publicUrl: string
}) {
  const { shopName, orderNo, customerName, grandTotal, paymentInstructions, publicUrl } = params
  return {
    subject: `⏰ แจ้งเตือนชำระเงิน ออเดอร์ ${orderNo} — ${shopName}`,
    html: shell(
      shopName,
      `<p>สวัสดีคุณ${customerName} 🙏</p>
       <p>ร้านยังไม่ได้รับการชำระเงินสำหรับออเดอร์นี้เลยค่ะ รบกวนโอนเงินตามยอดด้านล่าง แล้วแจ้งกลับมาที่ร้านได้เลยนะคะ</p>
       ${infoBox([
         { label: 'เลขที่ออเดอร์', value: orderNo },
         { label: 'ยอดที่ต้องชำระ', value: `${formatBaht(grandTotal)} บาท` },
       ])}
       ${paymentInstructions ? `<p style="white-space:pre-line;">${paymentInstructions}</p>` : ''}
       ${ctaButton(publicUrl, 'ดูรายละเอียดออเดอร์')}`
    ),
  }
}
