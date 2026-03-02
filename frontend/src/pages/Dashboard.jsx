import { useEffect, useState } from "react";
import api from "../api/apiClient";
import Loading from "../components/Loading";
import ErrorState from "../components/ErrorState";
import { useNavigate } from "react-router-dom";
import "../styles/dash.css";

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [user, setUser] = useState(null); // New state for user info
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        // Fetch both Dashboard Summary and User Profile in parallel
        const [summaryRes, userRes] = await Promise.all([
          api.get("/api/dashboard/summary"),
          api.get("/api/auth/me"),
        ]);

        const summary = summaryRes.summary || {};

        // Set User Info
        if (userRes.success) {
          setUser(userRes.user);
        }

        // Set Stats Info
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

    loadDashboardData();
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="dashboard">
      {/* Personalized Header */}
      <div className="dashboard-header">
        <div className="biz-badge">
          {user?.businessName || "Service Manager"}
        </div>
        <h1>Welcome, {user?.firstname || "Owner"}!</h1>
        <p>Performance Overview for {data.month}</p>
      </div>

      <div className="dashboard-content">
        {/* Quick Actions */}
        {/* <section className="card card-full">
          <h2>Quick Actions</h2>
          <div className="actions">
            <button
              className="primary-btn"
              onClick={() => navigate("/customers/new")}
            >
              + Add Customer
            </button>
            <button className="btn-2" onClick={() => navigate("/customers")}>
              View Customers
            </button>
            <button
              className="primary-btn"
              onClick={() => navigate("/services")}
            >
              All Services
            </button>
            <button
              className="primary-btn"
              onClick={() => navigate("/invoices")}
            >
              Invoices
            </button>
            <button
              className="primary-btn"
              onClick={() => navigate("/inventory")}
            >
              Inventory
            </button>
          </div>
        </section> */}

        {/* Financial Overview */}
        <section className="card">
          <h2>Revenue Overview</h2>
          <div className="grid">
            <Stat
              label="Total Collected"
              value={data.money.totalCollected}
              isMoney
            />
            <Stat
              label="Pending"
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

        {/* Services Status */}
        <section className="card">
          <h2>Service Status</h2>
          <div className="grid">
            <Stat
              label="Completed"
              value={data.services.servicesDoneThisMonth}
            />
            <Stat label="Total Customers" value={data.customers.totalActive} />

            <div
              className="clickable-stat"
              onClick={() => navigate("/services/upcoming-overdue")}
            >
              <Stat
                label="Upcoming"
                value={data.services.upcomingServices}
                type="warning"
              />
            </div>

            <div
              className="clickable-stat"
              onClick={() => navigate("/services/upcoming-overdue")}
            >
              <Stat
                label="Overdue"
                value={data.services.overdueServices}
                type="danger"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

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
