import type { ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import { LoginPage } from './LoginPage'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-stone-500">
        กำลังโหลด...
      </div>
    )
  }
  if (!session) return <LoginPage />
  return <>{children}</>
}
