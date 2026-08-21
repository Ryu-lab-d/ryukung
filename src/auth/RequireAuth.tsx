import type { ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import { LoginPage } from './LoginPage'

/** หน้าจอตอนกำลังเช็คสิทธิ์เข้าใช้งาน — โผล่สั้นๆ ทุกครั้งที่เปิดเว็บใหม่หรือสลับแท็บกลับมา (เบราว์เซอร์มือถือ
 * มักรีโหลดแท็บที่ค้างอยู่เบื้องหลังเงียบๆ) แทนที่ตัวหนังสือเทาเรียบๆ เดิมด้วยหน้าจอที่มีแบรนด์ร้านและแอนิเมชันเบาๆ */
function LoadingScreen() {
  return (
    <div className="min-h-screen grid place-items-center bg-stone-50 px-4">
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-white shadow-sm grid place-items-center text-3xl animate-loading-bounce">
          🧁
        </div>
        <p className="font-semibold text-stone-700">RYUKUNG BAKERY</p>
        <div className="flex items-center justify-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-stone-400 animate-loading-dot [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-stone-400 animate-loading-dot [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-stone-400 animate-loading-dot [animation-delay:300ms]" />
        </div>
        <p className="text-sm text-stone-400">กำลังโหลด...</p>
      </div>
    </div>
  )
}

function BlockedScreen({ title, message }: { title: string; message: string }) {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen grid place-items-center bg-stone-50 px-4">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm p-6 text-center space-y-3">
        <p className="text-3xl">🔒</p>
        <p className="font-semibold text-stone-900">{title}</p>
        <p className="text-sm text-stone-500">{message}</p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full rounded-lg bg-stone-100 text-stone-700 py-2.5 font-medium"
        >
          ออกจากระบบ
        </button>
      </div>
    </div>
  )
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, staffStatus, staffLoading } = useAuth()

  if (loading || (session && staffLoading)) {
    return <LoadingScreen />
  }
  if (!session) return <LoginPage />

  if (!staffStatus || staffStatus.state === 'pending') {
    return (
      <BlockedScreen
        title="รอเจ้าของร้านอนุมัติ"
        message="บัญชีของคุณยืนยันอีเมลเรียบร้อยแล้ว แต่ยังรอเจ้าของร้านอนุมัติสิทธิ์การเข้าใช้งานอยู่ กรุณาแจ้งเจ้าของร้านให้เข้ามาอนุมัติที่หน้าตั้งค่า"
      />
    )
  }
  if (staffStatus.state === 'revoked') {
    return (
      <BlockedScreen
        title="บัญชีนี้ถูกระงับสิทธิ์แล้ว"
        message="เจ้าของร้านได้ระงับสิทธิ์การเข้าใช้งานของบัญชีนี้ ติดต่อเจ้าของร้านหากคิดว่าเป็นความผิดพลาด"
      />
    )
  }

  return <>{children}</>
}
