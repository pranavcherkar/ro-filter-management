import { useEffect, useState } from "react";
import api from "../api/apiClient";
import Loading from "../components/Loading";
import ErrorState from "../components/ErrorState";
import "../styles/dash.css";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        // apiClient already returns response.data
        const res = await api.get("/api/dashboard/summary");

        // ✅ normalize once
        const summary = res.summary || {};

        setData({
          month: summary.month || "",

          money: {
            totalCollected: summary.money?.totalCollected ?? 0,
            pendingAmount: summary.money?.pendingAmount ?? 0,
            filterSales: summary.money?.filterSales ?? 0,
            serviceIncome: summary.money?.serviceIncome ?? 0,
          },

          services: {
            servicesDoneThisMonth: summary.services?.servicesDoneThisMonth ?? 0,
            upcomingServices: summary.services?.upcomingServices ?? 0,
            overdueServices: summary.services?.overdueServices ?? 0,
          },

          customers: {
            totalActive: summary.customers?.totalActive ?? 0,
          },
        });
      } catch (err) {
        setError(err?.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h1>RO Service Dashboard</h1>
        <p>{data.month}</p>
      </div>

      <div className="dashboard-content">
        {/* Quick Actions */}
        <section className="card">
          <h2>Quick Actions</h2>
          <div className="actions">
            <button
              className="primary-btn"
              onClick={() => navigate("/customers/new")}
            >
              + Add Customer 👤
            </button>

            <button className="btn-2" onClick={() => navigate("/customers")}>
              All Customers 👥
            </button>

            <button
              onClick={() => navigate("/services")}
              className="primary-btn"
            >
              Services 🔧
            </button>
            <button
              onClick={() => navigate("/invoices")}
              className="primary-btn"
            >
              Invoices 🧾
            </button>
          </div>
        </section>

        {/* Financial Overview */}
        <section className="card">
          <h2>Financial Overview</h2>
          <div className="grid">
            <Stat
              label="Total Collected"
              value={data.money.totalCollected}
              isMoney
            />
            <Stat
              label="Pending Amount"
              value={data.money.pendingAmount}
              isMoney
              type="warning"
            />
            <Stat label="Filter Sales" value={data.money.filterSales} isMoney />
            <Stat
              label="Service Income"
              value={data.money.serviceIncome}
              isMoney
            />
          </div>
        </section>

        {/* Services */}
        <section className="card">
          <h2>Services This Month</h2>
          <div className="grid">
            <Stat
              label="Services Done"
              value={data.services.servicesDoneThisMonth}
            />
            <Stat
              label="Upcoming"
              value={data.services.upcomingServices}
              type="warning"
            />
            <Stat
              label="Overdue"
              value={data.services.overdueServices}
              type="danger"
            />
          </div>
        </section>

        {/* Customers */}
        <section className="card">
          <h2>Customers</h2>
          <div className="grid">
            <Stat label="Active Customers" value={data.customers.totalActive} />
          </div>
        </section>
      </div>
    </div>
  );
};

/* Reusable Stat component */
const Stat = ({ label, value, type, isMoney = false }) => {
  return (
    <div className={`stat-box ${type || ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {isMoney ? `₹${Number(value).toLocaleString()}` : value}
      </div>
    </div>
  );
};

export default Dashboard;
