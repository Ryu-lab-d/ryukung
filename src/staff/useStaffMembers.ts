import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type StaffMember = {
  id: string
  user_id: string | null
  email: string
  display_name: string | null
  role: 'owner' | 'staff' | 'manager'
  status: 'pending' | 'active' | 'revoked'
  allowed_pages: string[]
  created_at: string
}

export function useStaffMembers() {
  const [members, setMembers] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('staff_members').select('*').order('created_at', { ascending: true })
    setMembers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function invite(email: string, displayName: string) {
    const { error } = await supabase
      .from('staff_members')
      .insert({ email: email.trim().toLowerCase(), display_name: displayName.trim() || null, role: 'staff', status: 'pending' })
    if (!error) await load()
    return { error: error ? { message: error.message } : null }
  }

  async function setStatus(id: string, status: 'pending' | 'active' | 'revoked') {
    const { error } = await supabase.from('staff_members').update({ status }).eq('id', id)
    if (!error) await load()
    return { error: error ? { message: error.message } : null }
  }

  async function remove(id: string) {
    const { error } = await supabase.from('staff_members').delete().eq('id', id)
    if (!error) await load()
    return { error: error ? { message: error.message } : null }
  }

  async function setAllowedPages(id: string, pages: string[]) {
    const { error } = await supabase.from('staff_members').update({ allowed_pages: pages }).eq('id', id)
    if (!error) await load()
    return { error: error ? { message: error.message } : null }
  }

  /** เปลี่ยนระดับตำแหน่ง (พนักงาน/ผู้จัดการ) — DB บังคับว่าเปลี่ยน role ได้เฉพาะเจ้าของร้านเท่านั้น (ดู migration) */
  async function setRole(id: string, role: 'staff' | 'manager') {
    const { error } = await supabase.from('staff_members').update({ role }).eq('id', id)
    if (!error) await load()
    return { error: error ? { message: error.message } : null }
  }

  return { members, loading, invite, setStatus, remove, setAllowedPages, setRole, reload: load }
}
