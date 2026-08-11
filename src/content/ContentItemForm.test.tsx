import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ContentItemForm } from './ContentItemForm'
import type { ContentItem } from './useContentItems'

let itemOverride: ContentItem | null = null
let loadingOverride = false
vi.mock('./useContentItems', () => ({
  useContentItem: () => ({ item: itemOverride, loading: loadingOverride }),
}))

const saveContentItem = vi.fn()
const deleteContentItem = vi.fn()
vi.mock('./api', () => ({
  saveContentItem: (...args: unknown[]) => saveContentItem(...args),
  deleteContentItem: (...args: unknown[]) => deleteContentItem(...args),
}))

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function renderNew() {
  render(
    <MemoryRouter initialEntries={['/content/new']}>
      <Routes>
        <Route path="/content/new" element={<ContentItemForm />} />
        <Route path="/content/:id/edit" element={<ContentItemForm />} />
      </Routes>
    </MemoryRouter>
  )
}

function renderEdit(id = 'c1') {
  render(
    <MemoryRouter initialEntries={[`/content/${id}/edit`]}>
      <Routes>
        <Route path="/content/new" element={<ContentItemForm />} />
        <Route path="/content/:id/edit" element={<ContentItemForm />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  itemOverride = null
  loadingOverride = false
  saveContentItem.mockReset()
  deleteContentItem.mockReset()
  navigate.mockReset()
})

describe('ContentItemForm — สร้างใหม่', () => {
  it('ไม่กรอกชื่อคอนเทนต์ กดบันทึกแล้วขึ้น error ไม่ยิง saveContentItem', async () => {
    renderNew()
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText('กรุณาใส่ชื่อคอนเทนต์')).toBeInTheDocument()
    expect(saveContentItem).not.toHaveBeenCalled()
  })

  it('กรอกครบแล้วบันทึก ส่งค่าที่เลือกไปยัง saveContentItem ครบถ้วน', async () => {
    saveContentItem.mockResolvedValue({ id: 'new-id', error: null })
    renderNew()

    await userEvent.type(screen.getByLabelText('ชื่อคอนเทนต์'), 'ขนมปังใหม่ประจำเดือน')
    await userEvent.click(screen.getByRole('button', { name: '📸 Instagram' }))
    await userEvent.click(screen.getByRole('button', { name: '🎵 TikTok' }))
    await userEvent.click(screen.getByRole('button', { name: '✍️ เขียนบท/แคปชั่น' }))
    await userEvent.type(screen.getByLabelText('ไอเดีย/คอนเซปต์'), 'เปิดเตาอบตอนเช้า')
    await userEvent.type(screen.getByLabelText('แฮชแท็ก'), '#ryukungbakery')

    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))

    expect(saveContentItem).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        title: 'ขนมปังใหม่ประจำเดือน',
        platforms: ['instagram', 'tiktok'],
        status: 'script',
        idea: 'เปิดเตาอบตอนเช้า',
        hashtags: '#ryukungbakery',
      })
    )
    expect(navigate).toHaveBeenCalledWith('/content')
  })

  it('กดแพลตฟอร์มเดิมซ้ำ ถอดออกจากรายการที่เลือกไว้', async () => {
    saveContentItem.mockResolvedValue({ id: 'new-id', error: null })
    renderNew()
    await userEvent.type(screen.getByLabelText('ชื่อคอนเทนต์'), 'ทดสอบ')
    await userEvent.click(screen.getByRole('button', { name: '📸 Instagram' }))
    await userEvent.click(screen.getByRole('button', { name: '📸 Instagram' })) // กดซ้ำ = ถอดออก
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(saveContentItem).toHaveBeenCalledWith(null, expect.objectContaining({ platforms: [] }))
  })
})

describe('ContentItemForm — แก้ไขของเดิม', () => {
  it('โหลดข้อมูลเดิมมาเติมในฟอร์มให้ครบ', async () => {
    itemOverride = {
      id: 'c1',
      title: 'ขนมปังใหม่',
      platforms: ['facebook'],
      status: 'editing',
      idea: 'ไอเดียเดิม',
      caption: 'แคปชั่นเดิม',
      hashtags: '#เดิม',
      editing_style: 'ตลก',
      reference_url: null,
      note: null,
      post_date: '2026-08-20',
      created_at: '2026-08-11T00:00:00Z',
      updated_at: '2026-08-11T00:00:00Z',
    }
    renderEdit()
    expect(await screen.findByDisplayValue('ขนมปังใหม่')).toBeInTheDocument()
    expect(screen.getByDisplayValue('ไอเดียเดิม')).toBeInTheDocument()
    expect(screen.getByDisplayValue('แคปชั่นเดิม')).toBeInTheDocument()
    expect(screen.getByDisplayValue('#เดิม')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '🗑️ ลบคอนเทนต์นี้' })).toBeInTheDocument()
  })

  it('มีปุ่มลบ กดแล้วยืนยันแล้วเรียก deleteContentItem', async () => {
    itemOverride = {
      id: 'c1',
      title: 'ขนมปังใหม่',
      platforms: [],
      status: 'idea',
      idea: null,
      caption: null,
      hashtags: null,
      editing_style: null,
      reference_url: null,
      note: null,
      post_date: null,
      created_at: '2026-08-11T00:00:00Z',
      updated_at: '2026-08-11T00:00:00Z',
    }
    deleteContentItem.mockResolvedValue({ error: null })
    renderEdit()

    await screen.findByDisplayValue('ขนมปังใหม่')
    await userEvent.click(screen.getByRole('button', { name: '🗑️ ลบคอนเทนต์นี้' }))
    await userEvent.click(screen.getByRole('button', { name: 'ลบถาวร' }))

    expect(deleteContentItem).toHaveBeenCalledWith('c1')
    expect(navigate).toHaveBeenCalledWith('/content')
  })

  it('มีแฮชแท็กอยู่แล้ว กดปุ่มคัดลอกเรียก navigator.clipboard.writeText ด้วยข้อความแฮชแท็ก', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    itemOverride = {
      id: 'c1',
      title: 'ขนมปังใหม่',
      platforms: [],
      status: 'idea',
      idea: null,
      caption: null,
      hashtags: '#ryukungbakery #ขนมปังโฮมเมด',
      editing_style: null,
      reference_url: null,
      note: null,
      post_date: null,
      created_at: '2026-08-11T00:00:00Z',
      updated_at: '2026-08-11T00:00:00Z',
    }
    renderEdit()
    await screen.findByDisplayValue('#ryukungbakery #ขนมปังโฮมเมด')
    await userEvent.click(screen.getByRole('button', { name: 'คัดลอก' }))
    expect(writeText).toHaveBeenCalledWith('#ryukungbakery #ขนมปังโฮมเมด')
    expect(await screen.findByText('คัดลอกแล้ว ✓')).toBeInTheDocument()
  })
})
