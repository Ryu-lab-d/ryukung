import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageHero } from '../layout/PageHero'
import { generateAccessCode, type AccessCodeRow, type CourseRow, type LessonRow } from './learnApi'

const CARD = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm space-y-3'
const INPUT = 'w-full rounded-xl border border-stone-300 px-3 py-2 text-sm'
const BTN = 'rounded-full bg-white border border-stone-300 text-stone-700 px-4 py-1.5 text-sm font-semibold'

/** หน้าจัดการคอร์สเรียนและรหัสเข้าเรียน (เฉพาะเจ้าของ/ผู้จัดการ) — นักเรียนเข้าที่ /learn */
export function CoursesAdminPage() {
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [lessons, setLessons] = useState<LessonRow[]>([])
  const [codes, setCodes] = useState<AccessCodeRow[]>([])
  const [openCourse, setOpenCourse] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [c, l, k] = await Promise.all([
      supabase.from('courses').select('*').order('sort_order').order('created_at'),
      supabase.from('course_lessons').select('*').order('sort_order').order('created_at'),
      supabase.from('course_access_codes').select('*').order('created_at', { ascending: false }),
    ])
    const err = c.error ?? l.error ?? k.error
    if (err) setError(err.message)
    setCourses((c.data ?? []) as CourseRow[])
    setLessons((l.data ?? []) as LessonRow[])
    setCodes((k.data ?? []) as AccessCodeRow[])
  }, [])
  useEffect(() => { void load() }, [load])

  async function run(p: PromiseLike<{ error: { message: string } | null }>) {
    const { error: e } = await p
    setError(e ? e.message : null)
    await load()
  }

  const learnUrl = `${window.location.origin}/learn`

  return (
    <div className="p-4 space-y-5 max-w-3xl mx-auto pb-24">
      <PageHero icon="🎓" title="คอร์สเรียนทำเบเกอรี่" subtitle="สร้างคอร์ส + บทเรียน แล้วออกรหัสให้นักเรียนเข้าที่หน้า /learn">
        <a href="/learn" target="_blank" rel="noreferrer">เปิดหน้านักเรียน</a>
        <Link to="/settings">← ตั้งค่า</Link>
      </PageHero>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">{notice}</p>}

      <section className="space-y-3">
        <h2 className="font-bold text-stone-900">🔑 รหัสเข้าเรียน</h2>
        <NewCode courses={courses} onCreate={(row) => run(supabase.from('course_access_codes').insert(row))} />
        {codes.length === 0 && <p className="text-sm text-stone-500">ยังไม่มีรหัส</p>}
        {codes.map((k) => {
          const expired = !!k.expires_at && new Date(k.expires_at) < new Date()
          const names = k.course_ids.length === 0 ? 'ทุกคอร์ส' : k.course_ids.map((id) => courses.find((c) => c.id === id)?.title ?? '?').join(', ')
          return (
            <div key={k.id} className={CARD + (k.revoked || expired ? ' opacity-60' : '')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono font-bold tracking-widest text-lg">{k.code}</p>
                  <p className="text-sm text-stone-700">{k.student_name} · {names}</p>
                  <p className="text-xs text-stone-500">
                    ใช้แล้ว {k.use_count} ครั้ง{k.expires_at ? ` · หมดอายุ ${new Date(k.expires_at).toLocaleDateString('th-TH')}` : ' · ไม่หมดอายุ'}
                    {k.revoked ? ' · ยกเลิกแล้ว' : expired ? ' · หมดอายุแล้ว' : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={BTN}
                    onClick={async () => {
                      await navigator.clipboard?.writeText(`รหัสเข้าเรียน RYUKUNG BAKERY: ${k.code}\nเข้าที่ ${learnUrl}`)
                      setNotice(`คัดลอกข้อความพร้อมรหัสของ ${k.student_name} แล้ว`)
                    }}
                  >
                    📋 คัดลอก
                  </button>
                  <button type="button" className={BTN} onClick={() => void run(supabase.from('course_access_codes').update({ revoked: !k.revoked }).eq('id', k.id))}>
                    {k.revoked ? 'เปิดใช้อีกครั้ง' : 'ยกเลิกรหัส'}
                  </button>
                  <button
                    type="button"
                    className={BTN + ' !text-red-600 !border-red-300'}
                    onClick={() => window.confirm(`ลบรหัสของ ${k.student_name}?`) && void run(supabase.from('course_access_codes').delete().eq('id', k.id))}
                  >
                    ลบ
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </section>

      <section className="space-y-3">
        <h2 className="font-bold text-stone-900">📚 คอร์สทั้งหมด</h2>
        <button
          type="button"
          className="rounded-full bg-stone-900 text-white px-4 py-2 text-sm font-semibold"
          onClick={() => void run(supabase.from('courses').insert({ title: 'คอร์สใหม่', sort_order: courses.length }))}
        >
          ＋ เพิ่มคอร์ส
        </button>
        {courses.map((c) => (
          <CourseEditor
            key={c.id}
            course={c}
            lessons={lessons.filter((l) => l.course_id === c.id)}
            open={openCourse === c.id}
            onToggle={() => setOpenCourse(openCourse === c.id ? null : c.id)}
            run={run}
          />
        ))}
      </section>
    </div>
  )
}

function NewCode({ courses, onCreate }: { courses: CourseRow[]; onCreate: (row: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [days, setDays] = useState('')
  return (
    <form
      className={CARD}
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        await onCreate({
          code: generateAccessCode(),
          student_name: name.trim(),
          course_ids: picked,
          expires_at: Number(days) > 0 ? new Date(Date.now() + Number(days) * 86400000).toISOString() : null,
        })
        setName('')
        setPicked([])
        setDays('')
      }}
    >
      <p className="text-sm font-semibold">สร้างรหัสใหม่ให้นักเรียน</p>
      <input className={INPUT} placeholder="ชื่อนักเรียน" value={name} onChange={(e) => setName(e.target.value)} aria-label="ชื่อนักเรียน" />
      <div className="flex flex-wrap gap-2">
        {courses.map((c) => (
          <label key={c.id} className="flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1 text-sm">
            <input type="checkbox" checked={picked.includes(c.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, c.id] : picked.filter((x) => x !== c.id))} />
            {c.emoji} {c.title}
          </label>
        ))}
        {courses.length === 0 && <span className="text-xs text-stone-500">สร้างคอร์สก่อน</span>}
      </div>
      <p className="text-xs text-stone-500">ไม่ติ๊กคอร์สเลย = เข้าได้ทุกคอร์สที่เปิดสอน</p>
      <input className={INPUT} type="number" min="0" placeholder="หมดอายุใน (วัน) — เว้นว่าง = ไม่หมดอายุ" value={days} onChange={(e) => setDays(e.target.value)} aria-label="หมดอายุในกี่วัน" />
      <button type="submit" disabled={!name.trim()} className="rounded-full bg-stone-900 text-white px-5 py-2 text-sm font-semibold disabled:opacity-50">
        🔑 สร้างรหัส
      </button>
    </form>
  )
}

type Run = (p: PromiseLike<{ error: { message: string } | null }>) => Promise<void>

function CourseEditor({ course, lessons, open, onToggle, run }: { course: CourseRow; lessons: LessonRow[]; open: boolean; onToggle: () => void; run: Run }) {
  const [title, setTitle] = useState(course.title)
  const [emoji, setEmoji] = useState(course.emoji)
  const [desc, setDesc] = useState(course.description ?? '')
  const save = () => run(supabase.from('courses').update({ title, emoji, description: desc || null }).eq('id', course.id))
  return (
    <div className={CARD}>
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between text-left">
        <span className="font-display font-bold text-lg">{course.emoji} {course.title}</span>
        <span className="text-xs text-stone-500">{course.is_published ? '🟢 เปิดสอน' : '⚪ ฉบับร่าง'} · {lessons.length} บท {open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input className={INPUT + ' !w-16 text-center'} value={emoji} onChange={(e) => setEmoji(e.target.value)} aria-label="ไอคอนคอร์ส" />
            <input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="ชื่อคอร์ส" />
          </div>
          <textarea className={INPUT} rows={2} placeholder="คำอธิบายคอร์ส" value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="คำอธิบายคอร์ส" />
          <div className="flex flex-wrap gap-2">
            <Link to={`/courses/${course.id}/present`} className="rounded-full bg-gradient-to-r from-amber-500 to-amber-700 text-white px-4 py-1.5 text-sm font-semibold shadow">
              ▶ โหมดสอน (Present)
            </Link>
            <button type="button" className={BTN} onClick={() => void save()}>💾 บันทึกคอร์ส</button>
            <button type="button" className={BTN} onClick={() => void run(supabase.from('courses').update({ is_published: !course.is_published }).eq('id', course.id))}>
              {course.is_published ? 'ปิดการสอน (ซ่อน)' : 'เปิดสอน'}
            </button>
            <button
              type="button"
              className={BTN + ' !text-red-600 !border-red-300'}
              onClick={() => window.confirm(`ลบคอร์ส "${course.title}" และบทเรียนทั้งหมด?`) && void run(supabase.from('courses').delete().eq('id', course.id))}
            >
              ลบคอร์ส
            </button>
          </div>
          <h3 className="font-semibold pt-2">บทเรียน</h3>
          {lessons.map((l, i) => <LessonEditor key={l.id} lesson={l} index={i} run={run} />)}
          <button
            type="button"
            className="rounded-full bg-stone-900 text-white px-4 py-2 text-sm font-semibold"
            onClick={() => void run(supabase.from('course_lessons').insert({ course_id: course.id, title: 'บทใหม่', sort_order: lessons.length }))}
          >
            ＋ เพิ่มบทเรียน (สูตร/วิธีทำ)
          </button>
        </div>
      )}
    </div>
  )
}

function LessonEditor({ lesson, index, run }: { lesson: LessonRow; index: number; run: Run }) {
  const [f, setF] = useState({
    title: lesson.title,
    ingredients: lesson.ingredients ?? '',
    steps: lesson.steps ?? '',
    tips: lesson.tips ?? '',
    video_url: lesson.video_url ?? '',
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-2">
      <input className={INPUT} value={f.title} onChange={set('title')} aria-label={`ชื่อบทที่ ${index + 1}`} />
      <textarea className={INPUT} rows={4} value={f.ingredients} onChange={set('ingredients')} placeholder={'ส่วนผสม บรรทัดละอย่าง เช่น\nแป้งสาลี | 200 กรัม\nเนยสด | 100 กรัม'} aria-label="ส่วนผสม" />
      <textarea className={INPUT} rows={5} value={f.steps} onChange={set('steps')} placeholder={'วิธีทำ บรรทัดละขั้นตอน เช่น\nตีเนยกับน้ำตาลให้ขึ้นฟู\nใส่ไข่ ตีให้เข้ากัน'} aria-label="วิธีทำ" />
      <textarea className={INPUT} rows={2} value={f.tips} onChange={set('tips')} placeholder="เคล็ดลับ (ถ้ามี)" aria-label="เคล็ดลับ" />
      <input className={INPUT} value={f.video_url} onChange={set('video_url')} placeholder="ลิงก์วิดีโอ (ถ้ามี)" aria-label="ลิงก์วิดีโอ" />
      <div className="flex gap-2">
        <button
          type="button"
          className={BTN}
          onClick={() =>
            void run(
              supabase.from('course_lessons').update({ title: f.title, ingredients: f.ingredients || null, steps: f.steps || null, tips: f.tips || null, video_url: f.video_url || null }).eq('id', lesson.id)
            )
          }
        >
          💾 บันทึกบท
        </button>
        <button
          type="button"
          className={BTN + ' !text-red-600 !border-red-300'}
          onClick={() => window.confirm(`ลบบท "${lesson.title}"?`) && void run(supabase.from('course_lessons').delete().eq('id', lesson.id))}
        >
          ลบบท
        </button>
      </div>
    </div>
  )
}
