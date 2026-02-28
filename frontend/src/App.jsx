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
import UpcomingOverdueServices from "./pages/Customers/UpcomingOverdueServices";
import InventoryParts from "./pages/Customers/InventoryParts";
import Layout from "./components/Layout";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<CustomersList />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/customers/new" element={<CustomerForm />} />
            <Route path="/customers/:id/edit" element={<CustomerForm />} />
            <Route path="/customers/:id/payment" element={<UpdatePayment />} />
            <Route
              path="/customers/:id/services/new"
              element={<AddService />}
            />
            <Route path="/services" element={<ServicesList />} />
            <Route path="/invoices" element={<InvoicesList />} />
            <Route
              path="/services/upcoming-overdue"
              element={<UpcomingOverdueServices />}
            />
            <Route path="/inventory" element={<InventoryParts />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
