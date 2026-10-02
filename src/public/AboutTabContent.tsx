import { AmbientGlow, Reveal, SquiggleUnderline } from './PublicSiteChrome'

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

const STATS = [
  { value: '13', unit: 'ปี', label: 'อายุเจ้าของร้าน' },
  { value: '100', unit: '%', label: 'ทำเองทุกชิ้น' },
  { value: '24', unit: 'ชม.', label: 'สั่งได้ตลอด' },
]

const SECTION_TITLE = 'text-lg font-display font-semibold text-stone-900'

const CARD = 'bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_16px_-6px_rgb(51_32_14_/_0.18)]'

export function AboutTabContent({ onGoToMenu }: { onGoToMenu: () => void }) {
  return (
    <div className="max-w-3xl mx-auto px-4 space-y-6">
      {/* เจ้าของร้าน + quick facts — สแกนอ่านได้ในไม่กี่วินาที ไม่ต้องอ่านย่อหน้ายาวๆ ก่อนถึงจะรู้ว่าร้านนี้คือใคร */}
      <Reveal as="section" className={CARD + ' relative overflow-hidden p-6 space-y-4'}>
        <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-400 to-amber-700" aria-hidden="true" />
        <div className="flex items-center gap-4 pl-1">
          <div className="relative shrink-0">
            <span className="absolute inset-0 rounded-full bg-amber-400/50 animate-fab-ring" aria-hidden="true" />
            <div
              className="relative w-16 h-16 rounded-full grid place-items-center text-3xl border-2 border-white shadow-md"
              style={{ background: 'linear-gradient(160deg, #3d2b1f, #6b4a35)' }}
            >
              🧑‍🍳
            </div>
          </div>
          <div>
            <p className="font-display font-semibold text-stone-900 text-lg">ริว</p>
            <p className="text-sm text-stone-500">เจ้าของร้าน · ลงมือทำขนมทุกชิ้นเอง</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pl-1">
          {QUICK_FACTS.map((f, i) => (
            <span
              key={f}
              className="animate-product-in rounded-full bg-stone-50 border border-stone-200 px-3 py-1 text-xs font-medium text-stone-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-amber-50 hover:border-amber-200"
              style={{ animationDelay: `${0.25 + i * 0.1}s` }}
            >
              {f}
            </span>
          ))}
        </div>
      </Reveal>

      {/* ตัวเลขเด่น — สรุปจุดขายของร้านเป็นตัวเลขใหญ่ๆ อ่านจบในพริบตา */}
      <Reveal as="section" delay={0.05} className="grid grid-cols-3 gap-3">
        {STATS.map((st, i) => (
          <Reveal
            key={st.label}
            delay={i * 0.1}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-stone-800 to-stone-900 text-white text-center py-4 px-2 shadow-[0_12px_24px_-12px_rgb(51_32_14_/_0.7)]"
          >
            <span className="absolute -top-6 -right-6 w-16 h-16 rounded-full bg-amber-400/20" aria-hidden="true" />
            <p className="relative font-display font-bold text-3xl leading-none text-amber-300">
              {st.value}<span className="text-base ml-0.5 text-amber-200">{st.unit}</span>
            </p>
            <p className="relative text-[11px] text-white/75 mt-1.5">{st.label}</p>
          </Reveal>
        ))}
      </Reveal>

      {/* เส้นทางการเติบโต — แต่ละขั้นโผล่ตามจังหวะตอนเลื่อนมาเห็น เส้นเชื่อมไหลลง ขั้นสุดท้าย (วันนี้) มีวงแสงเรือง */}
      <Reveal as="section" delay={0.08} className={CARD + ' p-6'}>
        <div className="mb-5">
          <h2 className={SECTION_TITLE}>🌱 เส้นทางการเติบโต</h2>
          <SquiggleUnderline className="w-16 h-2 mt-0.5 text-amber-700/50" />
        </div>
        <div className="space-y-5">
          {TIMELINE.map((step, i) => {
            const isLast = i === TIMELINE.length - 1
            return (
              <Reveal key={i} delay={i * 0.09} className="flex gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className={
                      'w-9 h-9 rounded-full grid place-items-center text-lg ' +
                      (isLast
                        ? 'bg-brand-shader ring-4 ring-amber-200 animate-node-ping'
                        : 'bg-stone-100 border border-stone-200')
                    }
                  >
                    {step.icon}
                  </div>
                  {!isLast && (
                    <div
                      className="w-0.5 flex-1 bg-gradient-to-b from-amber-300 to-stone-200 mt-1 animate-line-grow"
                      style={{ animationDelay: `${i * 0.09 + 0.2}s` }}
                    />
                  )}
                </div>
                <div className={'flex-1 rounded-xl px-3.5 py-2.5 mb-1 border ' + (isLast ? 'bg-amber-50 border-amber-200' : 'bg-stone-50/70 border-stone-200/60')}>
                  <p className="text-[10px] font-semibold tracking-wider text-amber-700/70">STEP {i + 1}</p>
                  <p className="font-semibold text-stone-900 text-sm">{step.title}</p>
                  <p className="text-sm text-stone-600 leading-relaxed mt-0.5">{step.text}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </Reveal>

      {/* สิ่งที่ทำให้ร้านเราต่าง */}
      <Reveal as="section" delay={0.08} className={CARD + ' p-6 space-y-4'}>
        <div>
          <h2 className={SECTION_TITLE}>✨ สิ่งที่ทำให้ร้านเราต่าง</h2>
          <SquiggleUnderline className="w-16 h-2 mt-0.5 text-amber-700/50" />
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {HIGHLIGHTS.map((h, i) => (
            <Reveal
              key={i}
              delay={i * 0.1}
              className="group flex sm:block items-center gap-3.5 text-left sm:text-center rounded-2xl bg-gradient-to-br from-amber-50/60 to-stone-50 border border-stone-200/60 p-4 sm:space-y-1.5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_14px_28px_-12px_rgb(51_32_14_/_0.35)] hover:border-amber-200"
            >
              <p className="shrink-0 w-14 h-14 sm:w-auto sm:h-auto grid place-items-center rounded-2xl bg-white shadow-sm sm:bg-transparent sm:shadow-none text-3xl transition-transform duration-300 group-hover:scale-125 group-hover:-rotate-6">{h.icon}</p>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-stone-900">{h.title}</p>
                <p className="text-xs text-stone-500 leading-relaxed">{h.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Reveal>

      {/* CTA — สลับกลับไปแท็บเมนูในหน้าเดียวกันเลย ไม่ใช่ลิงก์เปลี่ยนหน้า */}
      <Reveal as="section" delay={0.08} className="relative overflow-hidden rounded-2xl p-6 text-center space-y-3 bg-brand-shader">
        <AmbientGlow />
        <p className="relative z-10 text-white font-display font-semibold">อยากลองชิมฝีมือริวไหม?</p>
        <button
          type="button"
          onClick={onGoToMenu}
          className="btn-shimmer relative z-10 rounded-full bg-white text-stone-900 font-semibold px-6 py-2.5 text-sm shadow-md transition-transform duration-200 hover:-translate-y-0.5 active:scale-95"
        >
          ดูเมนู สั่งเลย
        </button>
      </Reveal>
    </div>
  )
}
