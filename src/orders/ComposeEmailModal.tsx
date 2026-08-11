import { useState } from 'react'
import { sendCustomerEmail } from '../lib/customerEmail'
import { customEmail } from '../lib/emailTemplates'
import { formatBaht } from '../lib/money'
import { stageLabel } from './workStatus'

type TemplateKey = 'unpaid' | 'paid' | 'status'

const TEMPLATES: { key: TemplateKey; label: string }[] = [
  { key: 'unpaid', label: 'ยังไม่ชำระเงิน' },
  { key: 'paid', label: 'ชำระเงินแล้ว' },
  { key: 'status', label: 'ของถึงไหนแล้ว' },
]

export type ComposeEmailModalProps = {
  shopName: string
  logoUrl: string | null
  orderNo: string
  customerName: string
  customerEmail: string
  grandTotal: number
  balanceDue: number
  fulfillmentType: string
  workStatus: string
  paymentInstructions: string | null
  publicUrl: string
  onClose: () => void
  onSent: (message: string) => void
}

function buildTemplate(key: TemplateKey, p: ComposeEmailModalProps): { subject: string; bodyText: string } {
  switch (key) {
    case 'unpaid':
      return {
        subject: `⏰ แจ้งเตือนชำระเงิน ออเดอร์ ${p.orderNo} — ${p.shopName}`,
        bodyText:
          `ร้านยังไม่ได้รับการชำระเงินสำหรับออเดอร์นี้เลยค่ะ รบกวนโอนเงินตามยอด ${formatBaht(p.balanceDue)} บาท แล้วแจ้งกลับมาที่ร้านได้เลยนะคะ` +
          (p.paymentInstructions ? `\n\n${p.paymentInstructions}` : ''),
      }
    case 'paid':
      return {
        subject: `💰 ได้รับชำระเงินแล้ว ออเดอร์ ${p.orderNo} — ${p.shopName}`,
        bodyText: 'ร้านได้รับการชำระเงินของคุณเรียบร้อยแล้วค่ะ ขอบคุณมากนะคะ',
      }
    case 'status':
      return {
        subject: `📦 อัปเดตสถานะออเดอร์ ${p.orderNo} — ${p.shopName}`,
        bodyText: `ตอนนี้ออเดอร์ของคุณอยู่ในขั้นตอน "${stageLabel(p.fulfillmentType, p.workStatus)}" ค่ะ`,
      }
  }
}

/** พนักงานเลือกเทมเพลตแล้วปรับแต่งข้อความเองได้ แต่ตกแต่ง/โลโก้/ฟุตเตอร์คุมโดย customEmail()+shell() เสมอ กันดีไซน์พัง */
export function ComposeEmailModal(props: ComposeEmailModalProps) {
  const [template, setTemplate] = useState<TemplateKey>('unpaid')
  const [subject, setSubject] = useState(() => buildTemplate('unpaid', props).subject)
  const [bodyText, setBodyText] = useState(() => buildTemplate('unpaid', props).bodyText)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function pickTemplate(key: TemplateKey) {
    setTemplate(key)
    const t = buildTemplate(key, props)
    setSubject(t.subject)
    setBodyText(t.bodyText)
  }

  async function handleSend() {
    setError(null)
    if (!subject.trim() || !bodyText.trim()) {
      setError('กรุณากรอกหัวข้อและข้อความ')
      return
    }
    setSending(true)
    const infoRows = [
      { label: 'เลขที่ออเดอร์', value: props.orderNo },
      { label: 'ยอดรวม', value: `${formatBaht(props.grandTotal)} บาท` },
      ...(props.balanceDue > 0 ? [{ label: 'ยอดคงเหลือ', value: `${formatBaht(props.balanceDue)} บาท` }] : []),
    ]
    const { html } = customEmail({
      shopName: props.shopName,
      logoUrl: props.logoUrl,
      customerName: props.customerName,
      bodyText,
      infoRows,
      ctaUrl: props.publicUrl,
      ctaLabel: 'ดูรายละเอียดออเดอร์',
    })
    const { error: sendError } = await sendCustomerEmail(props.customerEmail, subject, html)
    setSending(false)
    if (sendError) {
      setError('ส่งอีเมลไม่สำเร็จ: ' + sendError)
      return
    }
    props.onSent(`ส่งอีเมลไปที่ ${props.customerEmail} แล้ว`)
  }

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-50 animate-overlay-fade" onClick={props.onClose}>
      <div
        className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 animate-toast-pop max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">✉️ ส่งอีเมลลูกค้า</h2>
        <p className="text-sm text-stone-500">ถึง {props.customerName} ({props.customerEmail})</p>

        <div className="flex gap-1.5">
          {TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => pickTemplate(t.key)}
              className={
                'flex-1 rounded-lg text-xs font-medium py-2 border-2 ' +
                (template === t.key ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600')
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <label htmlFor="compose-email-subject" className="text-sm text-stone-600">หัวข้อ</label>
          <input
            id="compose-email-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="compose-email-body" className="text-sm text-stone-600">ข้อความ</label>
          <textarea
            id="compose-email-body"
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={props.onClose} className="flex-1 rounded-lg bg-stone-100 text-stone-700 py-2.5 font-medium">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending}
            className="flex-1 rounded-lg bg-stone-900 text-white py-2.5 font-medium disabled:opacity-50"
          >
            {sending ? 'กำลังส่ง...' : 'ส่งอีเมล'}
          </button>
        </div>
      </div>
    </div>
  )
}
