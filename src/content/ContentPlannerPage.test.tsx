import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ContentPlannerPage } from './ContentPlannerPage'
import type { ContentItem } from './useContentItems'

let itemsOverride: ContentItem[] = []
let loadingOverride = false
const reload = vi.fn()
vi.mock('./useContentItems', () => ({
  useContentItems: () => ({ items: itemsOverride, loading: loadingOverride, reload }),
}))

const updateContentStatus = vi.fn()
vi.mock('./api', () => ({ updateContentStatus: (...args: unknown[]) => updateContentStatus(...args) }))

vi.mock('./QuickAddContentModal', () => ({
  QuickAddContentModal: ({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) => (
    <div>
      <p>Quick Add Modal</p>
      <button type="button" onClick={onClose}>ปิด (mock)</button>
      <button type="button" onClick={onSaved}>บันทึกแล้ว (mock)</button>
    </div>
  ),
}))

function makeItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'c1',
    title: 'ขนมปังใหม่ประจำเดือน',
    platforms: ['instagram', 'tiktok'],
    status: 'idea',
    idea: 'ทำคลิปเปิดเตาอบตอนเช้า',
    hook: null,
    goal: null,
    caption: null,
    hashtags: null,
    editing_style: null,
    reference_url: null,
    note: null,
    post_date: '2026-08-20',
    created_at: '2026-08-11T00:00:00Z',
    updated_at: '2026-08-11T00:00:00Z',
    ...overrides,
  }
}

function renderPage() {
  render(
    <MemoryRouter>
      <ContentPlannerPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  itemsOverride = []
  loadingOverride = false
  reload.mockReset()
  updateContentStatus.mockReset()
  updateContentStatus.mockResolvedValue({ error: null })
})

describe('ContentPlannerPage', () => {
  it('ยังไม่มีคอนเทนต์เลย แสดงข้อความชวนเพิ่มไอเดียใหม่', () => {
    renderPage()
    expect(screen.getByText(/ยังไม่มีคอนเทนต์ที่ตรงเงื่อนไข/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ เพิ่มไอเดียใหม่' })).toBeInTheDocument()
  })

  it('กดปุ่ม "+ เพิ่มไอเดียใหม่" เปิดป็อปอัพเพิ่มไอเดียแบบเร็ว', async () => {
    renderPage()
    expect(screen.queryByText('Quick Add Modal')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '+ เพิ่มไอเดียใหม่' }))
    expect(screen.getByText('Quick Add Modal')).toBeInTheDocument()
  })

  it('บันทึกจากป็อปอัพเพิ่มไอเดียแบบเร็วสำเร็จ ปิดป็อปอัพและโหลดรายการใหม่', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: '+ เพิ่มไอเดียใหม่' }))
    await userEvent.click(screen.getByRole('button', { name: 'บันทึกแล้ว (mock)' }))
    expect(screen.queryByText('Quick Add Modal')).not.toBeInTheDocument()
    expect(reload).toHaveBeenCalled()
  })

  it('กด "ปิด" ป็อปอัพเพิ่มไอเดียแบบเร็ว โดยไม่โหลดรายการใหม่', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: '+ เพิ่มไอเดียใหม่' }))
    await userEvent.click(screen.getByRole('button', { name: 'ปิด (mock)' }))
    expect(screen.queryByText('Quick Add Modal')).not.toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
  })

  it('แสดงรายการคอนเทนต์พร้อมแพลตฟอร์ม สถานะ และวันที่โพสต์', () => {
    itemsOverride = [makeItem()]
    renderPage()
    expect(screen.getByText('ขนมปังใหม่ประจำเดือน')).toBeInTheDocument()
    expect(screen.getAllByText(/💡 ไอเดีย/).length).toBeGreaterThan(0) // ทั้งตัวกรองสถานะและป้ายบนการ์ดใช้ข้อความเดียวกัน
    expect(screen.getByText('ทำคลิปเปิดเตาอบตอนเช้า')).toBeInTheDocument()
  })

  it('ค้นหาจากชื่อคอนเทนต์ กรองรายการที่ไม่ตรงออกไป', async () => {
    itemsOverride = [makeItem({ id: 'c1', title: 'ขนมปังใหม่' }), makeItem({ id: 'c2', title: 'คุกกี้ลดราคา' })]
    renderPage()
    await userEvent.type(screen.getByPlaceholderText('ค้นหาชื่อคอนเทนต์หรือไอเดีย'), 'คุกกี้')
    expect(screen.queryByText('ขนมปังใหม่')).not.toBeInTheDocument()
    expect(screen.getByText('คุกกี้ลดราคา')).toBeInTheDocument()
  })

  it('กรองตามแพลตฟอร์ม แสดงเฉพาะคอนเทนต์ที่ลงแพลตฟอร์มนั้น', async () => {
    itemsOverride = [
      makeItem({ id: 'c1', title: 'ลง IG อย่างเดียว', platforms: ['instagram'] }),
      makeItem({ id: 'c2', title: 'ลง Facebook อย่างเดียว', platforms: ['facebook'] }),
    ]
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: '📸 Instagram' }))
    expect(screen.getByText('ลง IG อย่างเดียว')).toBeInTheDocument()
    expect(screen.queryByText('ลง Facebook อย่างเดียว')).not.toBeInTheDocument()
  })

  it('กรองตามสถานะ แสดงเฉพาะคอนเทนต์ที่อยู่ในสถานะนั้น', async () => {
    itemsOverride = [
      makeItem({ id: 'c1', title: 'ยังเป็นไอเดีย', status: 'idea' }),
      makeItem({ id: 'c2', title: 'โพสต์แล้ว', status: 'posted' }),
    ]
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: '📤 โพสต์แล้ว' }))
    expect(screen.getByText('โพสต์แล้ว')).toBeInTheDocument()
    expect(screen.queryByText('ยังเป็นไอเดีย')).not.toBeInTheDocument()
  })

  it('กดปุ่ม "ขั้นต่อไป" เรียก updateContentStatus ด้วยสถานะถัดไปตามลำดับ แล้วโหลดใหม่', async () => {
    itemsOverride = [makeItem({ status: 'idea' })]
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /ขั้นต่อไป: ✍️ เขียนบท\/แคปชั่น/ }))
    expect(updateContentStatus).toHaveBeenCalledWith('c1', 'script')
    expect(reload).toHaveBeenCalled()
  })

  it('คอนเทนต์ที่โพสต์แล้ว (ขั้นสุดท้าย) ไม่มีปุ่ม "ขั้นต่อไป"', () => {
    itemsOverride = [makeItem({ status: 'posted' })]
    renderPage()
    expect(screen.queryByText(/ขั้นต่อไป/)).not.toBeInTheDocument()
  })
})
