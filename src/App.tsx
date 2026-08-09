import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
import { StaffJoinPage } from './auth/StaffJoinPage'
import { AppLayout } from './layout/AppLayout'
import { SettingsPage } from './settings/SettingsPage'
import { ProductsPage } from './products/ProductsPage'
import { ProductForm } from './products/ProductForm'
import { CategoriesPage } from './products/CategoriesPage'
import { CustomersPage } from './customers/CustomersPage'
import { CustomerDetailPage } from './customers/CustomerDetailPage'
import { CustomerForm } from './customers/CustomerForm'
import { AddressForm } from './customers/AddressForm'
import { OrderBoardPage } from './board/OrderBoardPage'
import { OrderFormPage } from './orders/OrderFormPage'
import { OrderDetailPage } from './orders/OrderDetailPage'
import { ReceiptPage } from './receipts/ReceiptPage'
import { SalesSummaryPage } from './reports/SalesSummaryPage'
import { PublicOrderPage } from './public/PublicOrderPage'
import { StorageManagementPage } from './storage/StorageManagementPage'
import { CalendarPage } from './calendar/CalendarPage'

/** ตั้งค่าร้าน (รวมจัดการสิทธิ์พนักงาน) เจ้าของร้านเท่านั้นที่เข้าได้ พนักงานเข้ามาจะเด้งกลับหน้าออเดอร์ */
function OwnerOnlyRoute({ children }: { children: ReactNode }) {
  const { staffStatus } = useAuth()
  if (staffStatus?.role !== 'owner') return <Navigate to="/" replace />
  return <>{children}</>
}

function AuthenticatedApp() {
  const location = useLocation()
  return (
    <RequireAuth>
      <AppLayout>
        {/* key={pathname} บังคับให้ React ถอด-สร้างใหม่ทุกครั้งที่เปลี่ยนหน้า ทำให้ CSS animation เล่นซ้ำทุกครั้ง */}
        <div key={location.pathname} className="animate-page-in">
          <Routes>
            <Route path="/" element={<OrderBoardPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/orders/new" element={<OrderFormPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/orders/:id/edit" element={<OrderFormPage />} />
            <Route path="/orders/:id/receipt" element={<ReceiptPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/new" element={<ProductForm />} />
            <Route path="/products/:id" element={<ProductForm />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/new" element={<CustomerForm />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/customers/:id/edit" element={<CustomerForm />} />
            <Route path="/customers/:id/addresses/new" element={<AddressForm />} />
            <Route path="/customers/:id/addresses/:addressId/edit" element={<AddressForm />} />
            <Route path="/summary" element={<SalesSummaryPage />} />
            <Route path="/settings" element={<OwnerOnlyRoute><SettingsPage /></OwnerOnlyRoute>} />
            <Route path="/storage" element={<StorageManagementPage />} />
          </Routes>
        </div>
      </AppLayout>
    </RequireAuth>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/o/:token" element={<PublicOrderPage />} />
          <Route path="/staff/join" element={<StaffJoinPage />} />
          <Route path="/*" element={<AuthenticatedApp />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
