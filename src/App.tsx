import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
import { AppLayout } from './layout/AppLayout'
import { SettingsPage } from './settings/SettingsPage'

function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-stone-500 mt-2">หน้านี้จะสร้างในแผนถัดไป</p>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RequireAuth>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Placeholder title="กระดานออเดอร์" />} />
              <Route path="/products" element={<Placeholder title="สินค้า" />} />
              <Route path="/customers" element={<Placeholder title="ลูกค้า" />} />
              <Route path="/summary" element={<Placeholder title="สรุปยอด" />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </AppLayout>
        </RequireAuth>
      </BrowserRouter>
    </AuthProvider>
  )
}
