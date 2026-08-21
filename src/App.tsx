import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
import { StaffJoinPage } from './auth/StaffJoinPage'
import { AppLayout } from './layout/AppLayout'
import { NAV_ITEMS } from './layout/navItems'
import { SettingsPage } from './settings/SettingsPage'
import { PromoCardPage } from './settings/PromoCardPage'
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
import { ChatbotManagementPage } from './chatbot/ChatbotManagementPage'
import { CostRecipesPage } from './costing/CostRecipesPage'
import { CostRecipeForm } from './costing/CostRecipeForm'
import { WithdrawalsPage } from './withdrawals/WithdrawalsPage'
import { NewWithdrawalPage } from './withdrawals/NewWithdrawalPage'
import { WithdrawalDetailPage } from './withdrawals/WithdrawalDetailPage'
import { ContentPlannerPage } from './content/ContentPlannerPage'
import { ContentItemForm } from './content/ContentItemForm'
import { ContentStatsPage } from './content/ContentStatsPage'
import { IngredientsPage } from './ingredients/IngredientsPage'
import { IngredientDetailPage } from './ingredients/IngredientDetailPage'
import { ExpensesPage } from './reports/ExpensesPage'
import type { PageKey } from './staff/pages'

/** ตั้งค่าร้าน (รวมจัดการสิทธิ์พนักงาน) เจ้าของร้านเท่านั้นที่เข้าได้ พนักงานเข้ามาจะเด้งกลับหน้าออเดอร์ */
export function OwnerOnlyRoute({ children }: { children: ReactNode }) {
  const { staffStatus } = useAuth()
  if (staffStatus?.role !== 'owner') return <Navigate to="/" replace />
  return <>{children}</>
}

/** หน้าตั้งค่า — เจ้าของร้านกับผู้จัดการเข้าได้ (ผู้จัดการเห็นแค่บางส่วนตามที่ SettingsPage.tsx จัดการเอง) */
export function OwnerOrManagerRoute({ children }: { children: ReactNode }) {
  const { staffStatus } = useAuth()
  if (staffStatus?.role !== 'owner' && staffStatus?.role !== 'manager') return <Navigate to="/" replace />
  return <>{children}</>
}

/** กันหน้าตามสิทธิ์ที่เจ้าของร้านตั้งไว้ต่อพนักงานแต่ละคน — เด้งไป /no-access ไม่ใช่ / เพราะ / (orders)
    เองก็เป็นหน้าที่ถูกจำกัดสิทธิ์ได้เหมือนกัน เด้งกลับ / จะวนลูปถ้าคนนั้นไม่มีสิทธิ์เข้า / ด้วย
    ผู้จัดการเห็นทุกหน้าอัตโนมัติเหมือนเจ้าของร้าน ไม่ต้องตั้งสิทธิ์รายหน้าเอง */
export function RequirePage({ page, children }: { page: PageKey; children: ReactNode }) {
  const { staffStatus } = useAuth()
  const allowed =
    staffStatus?.role === 'owner' || staffStatus?.role === 'manager' || (staffStatus?.allowedPages?.includes(page) ?? false)
  if (!allowed) return <Navigate to="/no-access" replace />
  return <>{children}</>
}

export function NoAccessPage() {
  const { staffStatus } = useAuth()
  // หาเมนูแรกที่คนนี้เข้าได้จริง เผื่อ "/" (orders) เองก็ถูกจำกัดสิทธิ์ไว้ด้วย จะได้ไม่ลิงก์กลับไปที่วนลูป
  const firstAllowed = NAV_ITEMS.find((item) => {
    if ('ownerOnly' in item && item.ownerOnly) return staffStatus?.role === 'owner' || staffStatus?.role === 'manager'
    if ('page' in item && item.page) {
      return staffStatus?.role === 'owner' || staffStatus?.role === 'manager' || staffStatus?.allowedPages?.includes(item.page)
    }
    return true
  })

  return (
    <div className="min-h-screen bg-stone-50 grid place-items-center p-4 text-center">
      <div className="max-w-sm space-y-2">
        <p className="text-4xl mb-2">🔒</p>
        <p className="text-stone-700 font-medium">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        <p className="text-sm text-stone-500">กรุณาติดต่อเจ้าของร้านถ้าคิดว่าควรเข้าได้</p>
        {firstAllowed && (
          <Link to={firstAllowed.path} className="inline-block mt-2 rounded-lg bg-stone-900 text-white text-sm font-medium px-4 py-2">
            กลับหน้าแรก
          </Link>
        )}
      </div>
    </div>
  )
}

function AuthenticatedApp() {
  const location = useLocation()
  return (
    <RequireAuth>
      <AppLayout>
        {/* key={pathname} บังคับให้ React ถอด-สร้างใหม่ทุกครั้งที่เปลี่ยนหน้า ทำให้ CSS animation เล่นซ้ำทุกครั้ง */}
        <div key={location.pathname} className="animate-page-in">
          <Routes>
            <Route path="/no-access" element={<NoAccessPage />} />
            <Route path="/" element={<RequirePage page="orders"><OrderBoardPage /></RequirePage>} />
            <Route path="/calendar" element={<RequirePage page="orders"><CalendarPage /></RequirePage>} />
            <Route path="/orders/new" element={<RequirePage page="orders"><OrderFormPage /></RequirePage>} />
            <Route path="/orders/:id" element={<RequirePage page="orders"><OrderDetailPage /></RequirePage>} />
            <Route path="/orders/:id/edit" element={<RequirePage page="orders"><OrderFormPage /></RequirePage>} />
            <Route path="/orders/:id/receipt" element={<RequirePage page="orders"><ReceiptPage /></RequirePage>} />
            <Route path="/products" element={<RequirePage page="products"><ProductsPage /></RequirePage>} />
            <Route path="/products/new" element={<RequirePage page="products"><ProductForm /></RequirePage>} />
            <Route path="/products/:id" element={<RequirePage page="products"><ProductForm /></RequirePage>} />
            <Route path="/categories" element={<RequirePage page="products"><CategoriesPage /></RequirePage>} />
            <Route path="/customers" element={<RequirePage page="customers"><CustomersPage /></RequirePage>} />
            <Route path="/customers/new" element={<RequirePage page="customers"><CustomerForm /></RequirePage>} />
            <Route path="/customers/:id" element={<RequirePage page="customers"><CustomerDetailPage /></RequirePage>} />
            <Route path="/customers/:id/edit" element={<RequirePage page="customers"><CustomerForm /></RequirePage>} />
            <Route path="/customers/:id/addresses/new" element={<RequirePage page="customers"><AddressForm /></RequirePage>} />
            <Route path="/customers/:id/addresses/:addressId/edit" element={<RequirePage page="customers"><AddressForm /></RequirePage>} />
            <Route path="/summary" element={<RequirePage page="summary"><SalesSummaryPage /></RequirePage>} />
            <Route path="/expenses" element={<RequirePage page="expenses"><ExpensesPage /></RequirePage>} />
            <Route path="/costing" element={<RequirePage page="costing"><CostRecipesPage /></RequirePage>} />
            <Route path="/costing/new" element={<RequirePage page="costing"><CostRecipeForm /></RequirePage>} />
            <Route path="/costing/:id/edit" element={<RequirePage page="costing"><CostRecipeForm /></RequirePage>} />
            <Route path="/withdrawals" element={<RequirePage page="withdrawals"><WithdrawalsPage /></RequirePage>} />
            <Route path="/withdrawals/new" element={<RequirePage page="withdrawals"><NewWithdrawalPage /></RequirePage>} />
            <Route path="/withdrawals/:id" element={<RequirePage page="withdrawals"><WithdrawalDetailPage /></RequirePage>} />
            <Route path="/content" element={<RequirePage page="content"><ContentPlannerPage /></RequirePage>} />
            <Route path="/content/new" element={<RequirePage page="content"><ContentItemForm /></RequirePage>} />
            <Route path="/content/:id/edit" element={<RequirePage page="content"><ContentItemForm /></RequirePage>} />
            <Route path="/content/stats" element={<RequirePage page="content"><ContentStatsPage /></RequirePage>} />
            <Route path="/ingredients" element={<RequirePage page="ingredients"><IngredientsPage /></RequirePage>} />
            <Route path="/ingredients/:id" element={<RequirePage page="ingredients"><IngredientDetailPage /></RequirePage>} />
            <Route path="/settings" element={<OwnerOrManagerRoute><SettingsPage /></OwnerOrManagerRoute>} />
            <Route path="/promo" element={<RequirePage page="promo"><PromoCardPage /></RequirePage>} />
            <Route path="/chatbot" element={<OwnerOnlyRoute><ChatbotManagementPage /></OwnerOnlyRoute>} />
            <Route path="/storage" element={<RequirePage page="storage"><StorageManagementPage /></RequirePage>} />
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
