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
              <Route path="/summary" element={<Placeholder title="สรุปยอด" />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </AppLayout>
        </RequireAuth>
      </BrowserRouter>
    </AuthProvider>
  )
}
