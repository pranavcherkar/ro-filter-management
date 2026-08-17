import { useEffect, useState } from "react";
import api from "../api/apiClient";
import Loading from "../components/Loading";
import ErrorState from "../components/ErrorState";
import { useNavigate } from "react-router-dom";
import "../styles/dash.css";

// ── Invoice type → readable label ──────────────────────────────────────────
const TYPE_LABEL = {
  FILTER_SALE: "Filter Sale",
  SERVICE: "Service",
  AMC: "AMC",
};

// ── Pending breakdown modal ────────────────────────────────────────────────
const PendingModal = ({ onClose }) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get("/api/dashboard/pending-breakdown");
        setRows(res.pending || []);
      } catch (err) {
        setError(err?.message || "Failed to load pending details");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const totalPending = rows.reduce((sum, r) => sum + r.pendingAmount, 0);

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div className="pm-header">
          <div>
            <h3 className="pm-title">Pending Dues</h3>
            <p className="pm-subtitle">This month's outstanding balances</p>
          </div>
          <button className="pm-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* ── Body ── */}
        <div className="pm-body">
          {loading ? (
            <div className="pm-state">Loading...</div>
          ) : error ? (
            <div className="pm-state pm-error">{error}</div>
          ) : rows.length === 0 ? (
            <div className="pm-state pm-empty">
              🎉 No pending dues this month!
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="pm-table-wrap">
                <table className="pm-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>For</th>
                      <th>Total</th>
                      <th>Paid</th>
                      <th>Pending</th>
                      <th>Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.invoiceId}
                        className="pm-row"
                        onClick={() => {
                          if (row.customerId) {
                            navigate(`/customers/${row.customerId}`);
                            onClose();
                          }
                        }}
                        style={{
                          cursor: row.customerId ? "pointer" : "default",
                        }}
                      >
                        <td className="pm-name">{row.customerName}</td>
                        <td>
                          <span
                            className={`pm-type-badge pm-type-${(row.invoiceType || "").toLowerCase()}`}
                          >
                            {TYPE_LABEL[row.invoiceType] || row.invoiceType}
                          </span>
                        </td>
                        <td className="pm-amount">
                          ₹{row.totalAmount.toLocaleString("en-IN")}
                        </td>
                        <td className="pm-amount pm-paid">
                          ₹{row.paidAmount.toLocaleString("en-IN")}
                        </td>
                        <td className="pm-amount pm-due">
                          ₹{row.pendingAmount.toLocaleString("en-IN")}
                        </td>
                        <td>
                          {row.phone ? (
                            <a
                              href={`tel:${row.phone}`}
                              className="pm-phone"
                              onClick={(e) => e.stopPropagation()}
                            >
                              📞 {row.phone}
                            </a>
                          ) : (
                            <span className="pm-no-phone">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer total */}
              <div className="pm-footer">
                <span>Total outstanding</span>
                <span className="pm-footer-total">
                  ₹{totalPending.toLocaleString("en-IN")}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Dashboard ──────────────────────────────────────────────────────────────
const Dashboard = () => {
  const [data, setData] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPendingModal, setShowPendingModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const [summaryRes, userRes] = await Promise.all([
          api.get("/api/dashboard/summary"),
          api.get("/api/auth/me"),
        ]);

        const summary = summaryRes.summary || {};

        if (userRes.success) setUser(userRes.user);

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
        {/* Financial Overview */}
        <section className="card">
          <h2>Revenue overview for this month ({data.month})</h2>
          <div className="grid">
            <Stat
              label="Total Collected"
              value={data.money.totalCollected}
              isMoney
            />

            {/* Pending — clickable, opens breakdown modal */}
            <div
              className="clickable-stat"
              onClick={() => setShowPendingModal(true)}
              title="Click to see who owes money"
            >
              <Stat
                label="Pending"
                value={data.money.pendingAmount}
                isMoney
                type="warning"
                clickable
              />
            </div>

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
          <h2>Service Status For This Month</h2>
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

        {/* Quick actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 8, marginBottom: 8 }}>
          <button
            onClick={() => navigate("/parts-sale")}
            style={{
              flex: 1,
              background: "white",
              color: "#6173c7",
              border: "2px solid #6173c7",
              borderRadius: 12,
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sell Parts
          </button>
          <button
            onClick={() => navigate("/analytics")}
            style={{
              flex: 2,
              background: "linear-gradient(135deg, #6173c7, #764ba2)",
              color: "white",
              border: "none",
              borderRadius: 12,
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(97,115,199,0.35)",
            }}
          >
            View Analytics
          </button>
        </div>
      </div>

      {/* Pending breakdown modal */}
      {showPendingModal && (
        <PendingModal onClose={() => setShowPendingModal(false)} />
      )}
    </div>
  );
};

// ── Stat box ───────────────────────────────────────────────────────────────
const Stat = ({ label, value, type, isMoney = false, clickable = false }) => (
  <div
    className={`stat-box ${type || ""} ${clickable ? "stat-clickable" : ""}`}
  >
    <div className="stat-label">
      {label}
      {clickable && <span className="stat-hint"> ↗</span>}
    </div>
    <div className="stat-value">
      {isMoney ? `₹${Number(value).toLocaleString()}` : value}
    </div>
  </div>
);

export default Dashboard;