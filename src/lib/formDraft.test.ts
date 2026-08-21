import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { loadFormDraft, saveFormDraft, clearFormDraft, useFormDraft } from './formDraft'

beforeEach(() => {
  localStorage.clear()
})

describe('loadFormDraft / useFormDraft / clearFormDraft', () => {
  it('ยังไม่เคยบันทึกอะไรไว้เลย โหลดแล้วได้ null', () => {
    expect(loadFormDraft('some-key')).toBeNull()
  })

  it('บันทึกด้วย useFormDraft แล้วอ่านคืนด้วย loadFormDraft ได้ค่าเดิม', () => {
    renderHook(() => useFormDraft('product-form:new', { name: 'คุกกี้', qty: 3 }))
    expect(loadFormDraft('product-form:new')).toEqual({ name: 'คุกกี้', qty: 3 })
  })

  it('เปลี่ยนค่าแล้ว re-render ใหม่ บันทึกค่าล่าสุดทับของเดิม', () => {
    const { rerender } = renderHook(({ value }) => useFormDraft('k', value), { initialProps: { value: 'v1' } })
    expect(loadFormDraft('k')).toBe('v1')
    rerender({ value: 'v2' })
    expect(loadFormDraft('k')).toBe('v2')
  })

  it('key เป็น null ไม่บันทึกอะไรเลย', () => {
    renderHook(() => useFormDraft(null, { name: 'ไม่ควรถูกบันทึก' }))
    expect(loadFormDraft('null')).toBeNull()
  })

  it('clearFormDraft ลบร่างที่บันทึกไว้ทิ้ง', () => {
    renderHook(() => useFormDraft('to-clear', { a: 1 }))
    expect(loadFormDraft('to-clear')).toEqual({ a: 1 })
    clearFormDraft('to-clear')
    expect(loadFormDraft('to-clear')).toBeNull()
  })

  it('clearFormDraft รับ null ได้เฉยๆ ไม่พัง', () => {
    expect(() => clearFormDraft(null)).not.toThrow()
  })

  it('ข้อมูลที่เก็บไว้เสีย (JSON parse ไม่ได้) โหลดแล้วได้ null ไม่ throw', () => {
    localStorage.setItem('ryukung-draft:broken', '{not valid json')
    expect(loadFormDraft('broken')).toBeNull()
  })

  it('saveFormDraft บันทึกทันทีโดยไม่ต้องผ่าน hook/render', () => {
    saveFormDraft('imperative-key', { qty: 5 })
    expect(loadFormDraft('imperative-key')).toEqual({ qty: 5 })
  })
})
