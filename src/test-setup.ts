import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// กัน draft ที่ useFormDraft เขียนลง localStorage ระหว่างเทสต์หนึ่งรั่วไปปนกับเทสต์ถัดไปในไฟล์เดียวกัน
// (jsdom ไม่ล้าง localStorage ให้อัตโนมัติระหว่าง it() บล็อกต่างๆ)
afterEach(() => {
  localStorage.clear()
})
