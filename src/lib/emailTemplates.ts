import { formatBaht } from './money'

/** กัน HTML injection: ข้อความที่ลูกค้า/พนักงานพิมพ์เองต้องผ่านตัวนี้ก่อนใส่ในอีเมลเสมอ (ชื่อลูกค้าเป็นข้อมูลที่คนนอกกรอกได้) */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** ลิงก์ในอีเมลรับเฉพาะ http(s) — กัน javascript:/data: */
export function safeUrl(url: string | null | undefined): string {
  return /^https?:\/\//i.test(url ?? '') ? esc(url) : '#'
}

function shell(shopName: string, bodyHtml: string, logoUrl?: string | null): string {
  const header = logoUrl
    ? `<img src="${safeUrl(logoUrl)}" alt="${esc(shopName)}" width="64" height="64" style="border-radius:50%;display:block;margin:0 auto 8px;object-fit:cover;" />
       <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;">${esc(shopName)}</p>`
    : `<p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">🥐 ${esc(shopName)}</p>`
  return `<div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; background:#fbf1e4; padding:32px 16px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#3d2b1f;padding:24px;text-align:center;">
      ${header}
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
    <a href="${safeUrl(url)}" style="display:inline-block;background:#3d2b1f;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:999px;">${esc(label)}</a>
  </div>`
}

function infoBox(rows: { label: string; value: string }[]): string {
  const inner = rows.map((r) => `<p style="margin:0 0 6px;"><strong>${esc(r.label)}:</strong> ${esc(r.value)}</p>`).join('')
  return `<div style="background:#f7ede0;border-radius:12px;padding:14px 16px;margin:16px 0;">${inner}</div>`
}

/** หมายเหตุปิดท้ายสำหรับอีเมลที่ส่งถึงลูกค้าโดยตรงเท่านั้น (ไม่ใช้กับอีเมลแจ้งเจ้าของร้าน) อธิบายที่มาของระบบและวิธีจัดการถ้าได้อีเมลผิดคน */
function customerFooterNote(): string {
  return `<div style="margin-top:20px;padding-top:14px;border-top:1px solid #ece1d2;font-size:12px;line-height:1.6;color:#a1927d;">
    <p style="margin:0 0 8px;">อีเมลฉบับนี้ส่งถึงคุณลูกค้าเพื่อให้เกิดความเข้าใจตรงกันระหว่างร้านและลูกค้า และเพื่อลดปัญหาที่อาจเกิดขึ้นจากการสื่อสารคลาดเคลื่อน ทางร้านจึงได้จัดทำระบบแจ้งเตือนอัตโนมัตินี้ขึ้นมาค่ะ</p>
    <p style="margin:0;">หากท่านได้รับอีเมลฉบับนี้โดยไม่ได้เป็นผู้สั่งซื้อ หรือได้รับโดยผิดพลาด (ไม่ใช่ชื่อของท่าน) รบกวนกรุณาลบอีเมลฉบับนี้ทิ้ง และแจ้งให้ทางร้านทราบ เพื่อป้องกันไม่ให้เกิดการรบกวนท่านในครั้งต่อไปค่ะ</p>
  </div>`
}

export function orderConfirmedEmail(params: {
  shopName: string
  logoUrl?: string | null
  orderNo: string
  customerName: string
  itemsSummary: string
  grandTotal: number
  neededDate: string | null
  publicUrl: string
}) {
  const { shopName, logoUrl, orderNo, customerName, itemsSummary, grandTotal, neededDate, publicUrl } = params
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
      `<p>ถึงคุณ${esc(customerName)}</p>
       <p>ขอบคุณที่ไว้วางใจสั่งซื้อกับ ${esc(shopName)} นะคะ ตอนนี้ทางร้านได้รับออเดอร์ของท่านเรียบร้อยแล้วค่ะ โดยในลำดับถัดไป ทางร้านจะทยอยแจ้งความคืบหน้าของสถานะออเดอร์ให้ท่านทราบเป็นระยะๆ ผ่านทางอีเมลฉบับนี้ค่ะ</p>
       <p>รบกวนกรุณาชำระเงินตามยอดด้านล่างนี้ ผ่านลิงก์ติดตามออเดอร์ที่แนบไว้ให้ด้านล่างได้เลยนะคะ</p>
       ${infoBox(rows)}
       ${ctaButton(publicUrl, 'ดูรายละเอียด & ชำระเงิน')}
       ${customerFooterNote()}`,
      logoUrl
    ),
  }
}

export function paymentReceivedEmail(params: {
  shopName: string
  logoUrl?: string | null
  orderNo: string
  customerName: string
  amount: number
  balanceDue: number
  publicUrl: string
}) {
  const { shopName, logoUrl, orderNo, customerName, amount, balanceDue, publicUrl } = params
  const rows = [
    { label: 'เลขที่ออเดอร์', value: orderNo },
    { label: 'ยอดที่ได้รับ', value: `${formatBaht(amount)} บาท` },
    { label: 'ยอดคงเหลือ', value: balanceDue > 0 ? `${formatBaht(balanceDue)} บาท` : 'ชำระครบแล้ว 🎉' },
  ]
  return {
    subject: `💰 ได้รับชำระเงินแล้ว ออเดอร์ ${orderNo} — ${shopName}`,
    html: shell(
      shopName,
      `<p>ถึงคุณ${esc(customerName)}</p>
       <p>ร้านได้รับการชำระเงินของคุณเรียบร้อยแล้วค่ะ ขอบคุณมากนะคะ</p>
       ${infoBox(rows)}
       ${ctaButton(publicUrl, 'ดูรายละเอียดออเดอร์')}
       ${customerFooterNote()}`,
      logoUrl
    ),
  }
}

export function newOrderNotificationEmail(params: {
  shopName: string
  logoUrl?: string | null
  orderNo: string
  customerName: string
  itemsSummary: string
  grandTotal: number
  neededDate: string | null
  fulfillmentLabel: string
  orderDetailUrl: string
}) {
  const { shopName, logoUrl, orderNo, customerName, itemsSummary, grandTotal, neededDate, fulfillmentLabel, orderDetailUrl } = params
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
       ${ctaButton(orderDetailUrl, 'ดูออเดอร์ในระบบ')}`,
      logoUrl
    ),
  }
}

export function paymentReminderEmail(params: {
  shopName: string
  logoUrl?: string | null
  orderNo: string
  customerName: string
  grandTotal: number
  paymentInstructions: string | null
  publicUrl: string
}) {
  const { shopName, logoUrl, orderNo, customerName, grandTotal, paymentInstructions, publicUrl } = params
  return {
    subject: `⏰ แจ้งเตือนชำระเงิน ออเดอร์ ${orderNo} — ${shopName}`,
    html: shell(
      shopName,
      `<p>ถึงคุณ${esc(customerName)}</p>
       <p>ร้านยังไม่ได้รับการชำระเงินสำหรับออเดอร์นี้เลยค่ะ รบกวนโอนเงินตามยอดด้านล่าง แล้วแจ้งกลับมาที่ร้านได้เลยนะคะ</p>
       ${infoBox([
         { label: 'เลขที่ออเดอร์', value: orderNo },
         { label: 'ยอดที่ต้องชำระ', value: `${formatBaht(grandTotal)} บาท` },
       ])}
       ${paymentInstructions ? `<p style="white-space:pre-line;">${esc(paymentInstructions)}</p>` : ''}
       ${ctaButton(publicUrl, 'ดูรายละเอียดออเดอร์')}
       ${customerFooterNote()}`,
      logoUrl
    ),
  }
}

/**
 * เทมเพลตแบบยืดหยุ่นสำหรับหน้า "ส่งอีเมลลูกค้า" ที่พนักงานปรับแต่งข้อความเองได้ — ส่วนตกแต่ง (โลโก้/สี/ฟุตเตอร์)
 * ควบคุมโดย shell() เสมอ พนักงานแก้ได้แค่ bodyText เท่านั้น กันไม่ให้พังดีไซน์ที่ตั้งไว้
 */
export function customEmail(params: {
  shopName: string
  logoUrl?: string | null
  customerName: string
  bodyText: string
  infoRows: { label: string; value: string }[]
  ctaUrl?: string | null
  ctaLabel?: string | null
}) {
  const { shopName, logoUrl, customerName, bodyText, infoRows, ctaUrl, ctaLabel } = params
  return {
    html: shell(
      shopName,
      `<p>ถึงคุณ${esc(customerName)}</p>
       <p style="white-space:pre-line;">${esc(bodyText)}</p>
       ${infoRows.length > 0 ? infoBox(infoRows) : ''}
       ${ctaUrl && ctaLabel ? ctaButton(ctaUrl, ctaLabel) : ''}
       ${customerFooterNote()}`,
      logoUrl
    ),
  }
}


/** อีเมลแจ้งลูกค้าอัตโนมัติเมื่อสถานะงานเปลี่ยน (กำลังทำ/พร้อมรับ-ส่ง/กำลังจัดส่ง/ส่งมอบแล้ว) */
export function orderStatusEmail(params: {
  shopName: string
  logoUrl?: string | null
  orderNo: string
  customerName: string
  emoji: string
  headline: string
  message: string
  publicUrl: string
}) {
  const { shopName, logoUrl, orderNo, customerName, emoji, headline, message, publicUrl } = params
  return {
    subject: `${emoji} ${headline} ออเดอร์ ${orderNo} — ${shopName}`,
    html: shell(
      shopName,
      `<p>ถึงคุณ${esc(customerName)}</p>
       <p style="font-size:18px;font-weight:700;color:#3d2b1f;margin:8px 0;">${esc(emoji)} ${esc(headline)}</p>
       <p>${esc(message)}</p>
       ${infoBox([{ label: 'เลขที่ออเดอร์', value: orderNo }])}
       ${ctaButton(publicUrl, 'ติดตามสถานะออเดอร์')}
       ${customerFooterNote()}`,
      logoUrl
    ),
  }
}

/** อีเมลส่งลิงก์ Invoice (เอกสารทางการ) ให้ลูกค้าเปิดดู/พิมพ์เอง — ลิงก์ใช้ได้ 30 วันนับจากวันที่ออกเอกสาร */
export function invoiceLinkEmail(params: {
  shopName: string
  logoUrl?: string | null
  orderNo: string
  invoiceNo: string
  customerName: string
  grandTotal: number
  invoiceUrl: string
}) {
  const { shopName, logoUrl, orderNo, invoiceNo, customerName, grandTotal, invoiceUrl } = params
  return {
    subject: `📄 Invoice ${invoiceNo} ออเดอร์ ${orderNo} — ${shopName}`,
    html: shell(
      shopName,
      `<p>ถึงคุณ${esc(customerName)}</p>
       <p>ทางร้านส่ง Invoice ของออเดอร์นี้มาให้ค่ะ เปิดดู พิมพ์ หรือบันทึกเป็น PDF ได้จากปุ่มด้านล่าง (เพื่อปกป้องข้อมูลของคุณ ระบบจะให้กรอกชื่อหรือเบอร์โทรที่ใช้สั่งซื้อก่อนเปิดดู)</p>
       ${infoBox([
         { label: 'เลขที่ Invoice', value: invoiceNo },
         { label: 'เลขที่ออเดอร์', value: orderNo },
         { label: 'ยอดรวม', value: `${formatBaht(grandTotal)} บาท` },
       ])}
       ${ctaButton(invoiceUrl, 'เปิด Invoice')}
       <p style="font-size:12px;color:#a1927d;">ลิงก์นี้เปิดดูได้ 30 วันนับจากวันที่ออกเอกสาร</p>
       ${customerFooterNote()}`,
      logoUrl
    ),
  }
}
