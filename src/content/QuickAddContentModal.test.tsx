import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickAddContentModal } from './QuickAddContentModal'

const saveContentItem = vi.fn()
vi.mock('./api', () => ({ saveContentItem: (...args: unknown[]) => saveContentItem(...args) }))

const onClose = vi.fn()
const onSaved = vi.fn()

beforeEach(() => {
  saveContentItem.mockReset()
  onClose.mockReset()
  onSaved.mockReset()
})

function renderModal() {
  render(<QuickAddContentModal onClose={onClose} onSaved={onSaved} />)
}

describe('QuickAddContentModal', () => {
  it('ไม่กรอกชื่อคอนเทนต์ กดบันทึกแล้วขึ้น error ไม่ยิง saveContentItem', async () => {
    renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText('กรุณาใส่ชื่อคอนเทนต์')).toBeInTheDocument()
    expect(saveContentItem).not.toHaveBeenCalled()
  })

  it('กรอกแค่ชื่อ ไม่เลือกแพลตฟอร์ม ก็บันทึกได้ ค่าอื่นเป็นค่าเริ่มต้นให้หมด', async () => {
    saveContentItem.mockResolvedValue({ id: 'new-id', error: null })
    renderModal()
    await userEvent.type(screen.getByLabelText('ชื่อคอนเทนต์'), 'ขนมปังใหม่ประจำเดือน')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))

    expect(saveContentItem).toHaveBeenCalledWith(null, {
      title: 'ขนมปังใหม่ประจำเดือน',
      platforms: [],
      status: 'idea',
      idea: null,
      hook: null,
      goal: null,
      caption: null,
      hashtags: null,
      editing_style: null,
      reference_url: null,
      note: null,
      post_date: null,
    })
  })

  it('เลือกแพลตฟอร์มไว้ด้วย ส่งแพลตฟอร์มที่เลือกไปพร้อมกัน', async () => {
    saveContentItem.mockResolvedValue({ id: 'new-id', error: null })
    renderModal()
    await userEvent.type(screen.getByLabelText('ชื่อคอนเทนต์'), 'ทดสอบ')
    await userEvent.click(screen.getByRole('button', { name: '📸 Instagram' }))
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(saveContentItem).toHaveBeenCalledWith(null, expect.objectContaining({ platforms: ['instagram'] }))
  })

  it('บันทึกสำเร็จ ขึ้นป็อปอัพยืนยันก่อน แล้วค่อยเรียก onSaved หลังป็อปอัพปิดเอง', async () => {
    saveContentItem.mockResolvedValue({ id: 'new-id', error: null })
    renderModal()
    await userEvent.type(screen.getByLabelText('ชื่อคอนเทนต์'), 'ทดสอบ')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))

    expect(await screen.findByText('คอนเทนต์ถูกบันทึกแล้ว')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
    await new Promise((r) => setTimeout(r, 1300))
    expect(onSaved).toHaveBeenCalled()
  }, 10000)

  it('บันทึกไม่สำเร็จ แสดง error จาก saveContentItem ไม่เรียก onSaved', async () => {
    saveContentItem.mockResolvedValue({ id: null, error: { message: 'เชื่อมต่อไม่ได้' } })
    renderModal()
    await userEvent.type(screen.getByLabelText('ชื่อคอนเทนต์'), 'ทดสอบ')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText('เชื่อมต่อไม่ได้')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('กด "ยกเลิก" ปิดป็อปอัพโดยไม่บันทึกอะไร', async () => {
    renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }))
    expect(onClose).toHaveBeenCalled()
    expect(saveContentItem).not.toHaveBeenCalled()
  })
})
