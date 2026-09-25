import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

// กัน draft ที่ useFormDraft เขียนลง localStorage ระหว่างเทสต์หนึ่งรั่วไปปนกับเทสต์ถัดไปในไฟล์เดียวกัน
// (jsdom ไม่ล้าง localStorage ให้อัตโนมัติระหว่าง it() บล็อกต่างๆ)
afterEach(() => {
  localStorage.clear()
})

// jsdom ไม่มี IntersectionObserver ให้เลย (ไม่ใช่ browser จริง) — ต้อง stub ไว้เสมอ ไม่งั้นหน้า public ที่ใช้
// <Reveal> (ดู src/public/PublicSiteChrome.tsx -> useInView) จะ throw ตอน mount ในเทสต์ทุกครั้ง สังเกตพฤติกรรม
// เหมือน element ไม่เคยเข้า viewport เลย (ไม่ trigger callback) เพราะเทสต์ไม่ได้ scroll จริง — พอสำหรับแค่กัน crash
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null
  readonly rootMargin: string = ''
  readonly scrollMargin: string = ''
  readonly thresholds: ReadonlyArray<number> = []
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
