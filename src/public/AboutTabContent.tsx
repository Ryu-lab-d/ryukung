import { Reveal } from './PublicSiteChrome'

type TimelineStep = { icon: string; title: string; text: string }

const QUICK_FACTS = ['🎂 อายุ 13 ปี', '👐 ทำเองทุกขั้นตอน', '🍬 หวานน้อย อร่อยแน่']

const TIMELINE: TimelineStep[] = [
  {
    icon: '💡',
    title: 'จุดเริ่มต้น',
    text: 'เริ่มจากความอยากลองทำขนมสนุกๆ ของเด็กคนหนึ่ง ลองผิดลองถูกเอง ลงทุนด้วยเงินตัวเองทุกบาททุกสตางค์',
  },
  {
    icon: '🍳',
    title: 'หม้อทอดไร้น้ำมัน',
    text: 'ตอนเริ่มยังไม่มีเตาอบเลยด้วยซ้ำ ใช้หม้อทอดไร้น้ำมันที่บ้านทำขนมล็อตแรกออกมา',
  },
  {
    icon: '🔥',
    title: 'พัฒนาเป็นเตาปิ้ง',
    text: 'พอทำบ่อยขึ้น ก็อัปเกรดมาใช้เตาปิ้งที่คุมความร้อนได้ดีขึ้น',
  },
  {
    icon: '🎂',
    title: 'เตาอบ Convection เครื่องแรก',
    text: 'เก็บเงินขายขนมเอง จนซื้อเตาอบ Convection ได้ด้วยตัวเอง จุดเปลี่ยนที่ทำให้ขนมสม่ำเสมอและทำได้มากขึ้น',
  },
  {
    icon: '🚀',
    title: 'วันนี้ของร้าน',
    text: 'ร้านขยายใหญ่ขึ้นเรื่อยๆ มีลูกค้าสั่งซ้ำประจำ แต่ทุกขั้นตอนยังทำเองโดยริวเหมือนวันแรก',
  },
]

const HIGHLIGHTS = [
  { icon: '🍬', title: 'หวานน้อย อร่อยแน่ ไม่เหมือนใคร', text: 'สูตรที่ริวคิดเอง ปรับเอง ไม่ใช่สูตรสำเร็จรูป' },
  { icon: '🧑‍🍳', title: 'เด็กอายุ 13 ปีทำเองทั้งหมด', text: 'ตั้งแต่เตรียมของจนถึงแพ็กส่งทุกออเดอร์' },
  { icon: '📦', title: 'Pre-order ทุกออเดอร์', text: 'ผลิตสดใหม่พอดีกับจำนวนที่สั่งจริง' },
]

export function AboutTabContent({ onGoToMenu }: { onGoToMenu: () => void }) {
  return (
    <div className="max-w-3xl mx-auto px-4 space-y-6">
      {/* เจ้าของร้าน + quick facts — สแกนอ่านได้ในไม่กี่วินาที ไม่ต้องอ่านย่อหน้ายาวๆ ก่อนถึงจะรู้ว่าร้านนี้คือใคร */}
      <Reveal
        as="section"
        className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_16px_-6px_rgb(51_32_14_/_0.18)] p-6 space-y-4"
      >
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full grid place-items-center text-3xl shrink-0 border-2 border-white shadow-sm"
            style={{ background: 'linear-gradient(160deg, #3d2b1f, #6b4a35)' }}
          >
            🧑‍🍳
          </div>
          <div>
            <p className="font-display font-semibold text-stone-900 text-lg">ริว</p>
            <p className="text-sm text-stone-500">เจ้าของร้าน · ลงมือทำขนมทุกชิ้นเอง</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_FACTS.map((f) => (
            <span key={f} className="rounded-full bg-stone-50 border border-stone-200 px-3 py-1 text-xs font-medium text-stone-600">
              {f}
            </span>
          ))}
        </div>
      </Reveal>

      {/* เส้นทางการเติบโต */}
      <Reveal
        as="section"
        delay={0.08}
        className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_16px_-6px_rgb(51_32_14_/_0.18)] p-6"
      >
        <h2 className="text-lg font-display font-semibold text-stone-900 mb-4">เส้นทางการเติบโต</h2>
        <div className="space-y-5">
          {TIMELINE.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center shrink-0">
                <div className="w-9 h-9 rounded-full bg-stone-100 border border-stone-200 grid place-items-center text-lg">{step.icon}</div>
                {i < TIMELINE.length - 1 && <div className="w-px flex-1 bg-stone-200 mt-1" />}
              </div>
              <div className="pb-1">
                <p className="font-semibold text-stone-900 text-sm">{step.title}</p>
                <p className="text-sm text-stone-600 leading-relaxed mt-0.5">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* สิ่งที่ทำให้ร้านเราต่าง */}
      <Reveal
        as="section"
        delay={0.08}
        className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_16px_-6px_rgb(51_32_14_/_0.18)] p-6 space-y-4"
      >
        <h2 className="text-lg font-display font-semibold text-stone-900">สิ่งที่ทำให้ร้านเราต่าง</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {HIGHLIGHTS.map((h, i) => (
            <div key={i} className="rounded-xl bg-stone-50 border border-stone-200/60 p-4 text-center space-y-1.5">
              <p className="text-2xl">{h.icon}</p>
              <p className="text-sm font-semibold text-stone-900">{h.title}</p>
              <p className="text-xs text-stone-500 leading-relaxed">{h.text}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* CTA — สลับกลับไปแท็บเมนูในหน้าเดียวกันเลย ไม่ใช่ลิงก์เปลี่ยนหน้า */}
      <Reveal
        as="section"
        delay={0.08}
        className="rounded-2xl p-6 text-center space-y-3 bg-brand-shader"
      >
        <p className="text-white font-display font-semibold">อยากลองชิมฝีมือริวไหม?</p>
        <button type="button" onClick={onGoToMenu} className="rounded-full bg-white text-stone-900 font-semibold px-6 py-2.5 text-sm shadow-sm">
          ดูเมนู สั่งเลย
        </button>
      </Reveal>
    </div>
  )
}
