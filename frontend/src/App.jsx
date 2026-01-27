import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import RequireAuth from "./auth/RequireAuth";
import CustomersList from "./pages/Customers/CustomersList";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CustomerDetail from "./pages/Customers/CustomerDetail";
import CustomerForm from "./pages/CustomerForm";
import UpdatePayment from "./pages/Customers/UpdatePayment";
import AddService from "./pages/Customers/AddService";
import ServicesList from "./pages/Services/ServicesList";
import InvoicesList from "./pages/Invoices/InvoicesList";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/customers"
            element={
              <RequireAuth>
                <CustomersList />
              </RequireAuth>
            }
          />
          <Route
            path="/customers/:id"
            element={
              <RequireAuth>
                <CustomerDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/customers/new"
            element={
              <RequireAuth>
                <CustomerForm />
              </RequireAuth>
            }
          />
          <Route
            path="/customers/:id/edit"
            element={
              <RequireAuth>
                <CustomerForm />
              </RequireAuth>
            }
          />
          <Route
            path="/customers/:id/payment"
            element={
              <RequireAuth>
                <UpdatePayment />
              </RequireAuth>
            }
          />
          <Route
            path="/customers/:id/services/new"
            element={
              <RequireAuth>
                <AddService />
              </RequireAuth>
            }
          />
          <Route
            path="/services"
            element={
              <RequireAuth>
                <ServicesList />
              </RequireAuth>
            }
          />
          <Route
            path="/invoices"
            element={
              <RequireAuth>
                <InvoicesList />
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
