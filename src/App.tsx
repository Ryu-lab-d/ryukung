import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
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

function AuthenticatedApp() {
  return (
    <RequireAuth>
      <AppLayout>
        <Routes>
          <Route path="/" element={<OrderBoardPage />} />
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
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
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
          <Route path="/*" element={<AuthenticatedApp />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
