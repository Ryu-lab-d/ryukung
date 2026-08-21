import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type StaffRole = 'owner' | 'staff' | 'manager' | 'executive'
export type StaffState = 'pending' | 'active' | 'revoked'
export type StaffStatus = { role: StaffRole; state: StaffState; allowedPages: string[]; displayName: string | null } | null

/** เจ้าของร้าน/ผู้บริหาร/ผู้จัดการ — ระดับ "ผู้จัดการขึ้นไป": เห็นทุกหน้า + จัดการพนักงานคนอื่นได้ทั้งหมด */
export function isManagerOrAbove(role: StaffRole | null | undefined): boolean {
  return role === 'owner' || role === 'executive' || role === 'manager'
}

/** เจ้าของร้าน/ผู้บริหาร — สิทธิ์แก้ข้อมูลร้านครบทุกช่องในหน้าตั้งค่า */
export function isOwnerOrExecutive(role: StaffRole | null | undefined): boolean {
  return role === 'owner' || role === 'executive'
}

type AuthValue = {
  session: Session | null
  loading: boolean
  staffStatus: StaffStatus
  staffLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [staffStatus, setStaffStatus] = useState<StaffStatus>(null)
  const [staffLoading, setStaffLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setStaffStatus(null)
      setStaffLoading(false)
      return
    }
    let cancelled = false
    setStaffLoading(true)
    ;(async () => {
      const { data } = await supabase
        .from('staff_members')
        .select('role, status, allowed_pages, display_name')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (cancelled) return

      if (data) {
        setStaffStatus({ role: data.role, state: data.status, allowedPages: data.allowed_pages ?? [], displayName: data.display_name })
      } else {
        // ล็อกอินสำเร็จ (ยืนยันอีเมลแล้ว) แต่ยังไม่มีแถวสิทธิ์เลย — เพิ่งสมัครพนักงานครั้งแรก ผูกสิทธิ์อัตโนมัติ
        const displayName = (session.user.user_metadata?.display_name as string | undefined) ?? null
        const { data: claimed } = await supabase.rpc('claim_staff_invite', { p_display_name: displayName })
        if (claimed) {
          // re-select แถวสดหลัง claim เพื่อได้ allowed_pages ที่ backfill มาจาก DB default ถูกต้อง (RPC คืนแค่ status)
          const { data: fresh } = await supabase
            .from('staff_members')
            .select('role, status, allowed_pages, display_name')
            .eq('user_id', session.user.id)
            .maybeSingle()
          if (!cancelled) {
            setStaffStatus(
              fresh ? { role: fresh.role, state: fresh.status, allowedPages: fresh.allowed_pages ?? [], displayName: fresh.display_name } : null
            )
          }
        } else if (!cancelled) {
          setStaffStatus(null)
        }
      }
      if (!cancelled) setStaffLoading(false)
    })()
    return () => { cancelled = true }
  }, [session])

  const value: AuthValue = {
    session,
    loading,
    staffStatus,
    staffLoading,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error: error ? { message: error.message } : null }
    },
    signOut: async () => {
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth ต้องอยู่ภายใน AuthProvider')
  return ctx
}
