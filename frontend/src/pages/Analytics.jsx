import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/apiClient";
import Loading from "../components/Loading";
import ErrorState from "../components/ErrorState";
import "../styles/analytics.css";

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString("en-IN");
const fmtRs = (n) => `₹${fmt(n)}`;

// ── CSS Bar Chart ──────────────────────────────────────────────────────────
const BarChart = ({
  data,
  valueKey,
  label,
  color = "#6173c7",
  secondKey,
  secondColor = "#e2b96e",
}) => {
  const safeData = data || [];
  const max = Math.max(
    ...safeData.map((d) => Math.max(d[valueKey] || 0, d[secondKey] || 0)),
    1,
  );

  if (safeData.length === 0) {
    return <div className="an-empty">No data yet</div>;
  }

  return (
    <div className="an-barchart">
      <div className="an-bars">
        {safeData.map((d, i) => (
          <div key={i} className="an-bar-col">
            <div className="an-bar-stack">
              {secondKey && (
                <div
                  className="an-bar-seg"
                  style={{
                    height: `${((d[secondKey] || 0) / max) * 100}%`,
                    background: secondColor,
                  }}
                  title={`${d.month}: ${fmtRs(d[secondKey])}`}
                />
              )}
              <div
                className="an-bar-seg"
                style={{
                  height: `${((d[valueKey] || 0) / max) * 100}%`,
                  background: color,
                }}
                title={`${d.month}: ${fmtRs(d[valueKey])}`}
              />
            </div>
            <div className="an-bar-label">{d.month?.split(" ")[0]}</div>
          </div>
        ))}
      </div>
      {secondKey && (
        <div className="an-legend">
          <span className="an-legend-dot" style={{ background: color }} />{" "}
          {label}
          <span
            className="an-legend-dot"
            style={{ background: secondColor, marginLeft: 12 }}
          />{" "}
          Pending
        </div>
      )}
    </div>
  );
};

// ── SVG Donut Chart ────────────────────────────────────────────────────────
const DonutChart = ({ slices }) => {
  // slices = [{ label, value, color }]
  const safeSlices = slices || [];
  const total = safeSlices.reduce((s, x) => s + (x.value || 0), 0);
  if (total === 0) return <div className="an-donut-empty">No data</div>;


const offsets = safeSlices.reduce((acc, s) => {
  const prevTotal = acc.length ? acc[acc.length - 1].cum : 0;
  acc.push({ cum: prevTotal + (s.value || 0) / total });
  return acc;
}, []);
  const R = 60,
    cx = 70,
    cy = 70,
    stroke = 22;
  const circumference = 2 * Math.PI * R;

  return (
    <div className="an-donut-wrap">
      <svg width="140" height="140" className="an-donut-svg">
        {safeSlices.map((s, i) => {
  const pct = (s.value || 0) / total;
  const dash = pct * circumference;
  const gap = circumference - dash;
  
  const startOffset = i === 0 ? 0 : offsets[i - 1].cum;
  const rot = startOffset * 360 - 90;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${gap}`}
              transform={`rotate(${rot} ${cx} ${cy})`}
            />
          );
        })}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fontSize="11"
          fill="#64748b"
        >
          Total
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          fontSize="13"
          fontWeight="600"
          fill="#1e293b"
        >
          {fmt(total)}
        </text>
      </svg>
      <div className="an-donut-legend">
        {safeSlices.map((s, i) => (
          <div key={i} className="an-donut-item">
            <span className="an-legend-dot" style={{ background: s.color }} />
            <span className="an-donut-label">{s.label}</span>
            <span className="an-donut-val">
              {Math.round(((s.value || 0) / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Horizontal Bar ─────────────────────────────────────────────────────────
const HBar = ({ items, nameKey, valueKey, color = "#6173c7" }) => {
  const safeItems = items || [];
  const max = Math.max(...safeItems.map((i) => i[valueKey] || 0), 1);

  if (safeItems.length === 0) {
    return <div className="an-empty">No data yet</div>;
  }

  return (
    <div className="an-hbar-list">
      {safeItems.map((item, i) => (
        <div key={i} className="an-hbar-row">
          <div className="an-hbar-name">{item[nameKey]}</div>
          <div className="an-hbar-track">
            <div
              className="an-hbar-fill"
              style={{
                width: `${((item[valueKey] || 0) / max) * 100}%`,
                background: color,
              }}
            />
          </div>
          <div className="an-hbar-count">{item[valueKey]}</div>
        </div>
      ))}
    </div>
  );
};

// ── KPI Card ───────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, color = "#6173c7", icon }) => (
  <div className="an-kpi" style={{ borderTopColor: color }}>
    <div className="an-kpi-icon">{icon}</div>
    <div className="an-kpi-value" style={{ color }}>
      {value}
    </div>
    <div className="an-kpi-label">{label}</div>
    {sub && <div className="an-kpi-sub">{sub}</div>}
  </div>
);

// ── Main Page ──────────────────────────────────────────────────────────────
const Analytics = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [dues, setDues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview"); // overview | customers | services | dues

  useEffect(() => {
    const load = async () => {
      try {
        const [aRes, dRes] = await Promise.all([
          api.get("/api/analytics"),
          api.get("/api/analytics/dues"),
        ]);
        setData(aRes.analytics);
        setDues(dRes.dues);
      } catch (err) {
        setError(err?.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  // Total billed revenue across all invoice types (used in the "Total
  // Revenue" KPI below - previously computed but never actually used,
  // with the card silently showing collected-amount instead).
  const totalRevenue =
    (data.revenueByType.FILTER_SALE || 0) +
    (data.revenueByType.SERVICE || 0) +
    (data.revenueByType.AMC_PAYMENT || 0) +
    (data.revenueByType.PARTS_SALE || 0);

  return (
    <div className="an-page">
      {/* Header */}
      <div className="an-header">
        <button className="an-back" onClick={() => navigate("/")}>
          ← Dashboard
        </button>
        <h1>Analytics</h1>
        <p>Last 12 months · All figures in ₹</p>
      </div>

      {/* Tabs */}
      <div className="an-tabs">
        {[
          { key: "overview", label: "📊 Overview" },
          { key: "customers", label: "👥 Customers" },
          { key: "services", label: "🔧 Services" },
          {
            key: "dues",
            label: `💰 Dues (${(dues?.invoiceDues?.length || 0) + (dues?.customerDues?.length || 0)})`,
          },
        ].map((t) => (
          <button
            key={t.key}
            className={`an-tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="an-body">
        {/* ══ OVERVIEW TAB ══════════════════════════════════════════════════ */}
        {tab === "overview" && (
          <>
            {/* KPI row */}
            <div className="an-kpi-row">
              <KpiCard
                icon="💵"
                label="Total Revenue"
                value={fmtRs(totalRevenue)}
                sub={`${fmtRs(data.collectionData.pending)} pending`}
                color="#6173c7"
              />
              <KpiCard
                icon="📈"
                label="Collection Rate"
                value={`${data.collectionRate}%`}
                sub="paid vs billed"
                color="#22c55e"
              />
              <KpiCard
                icon="⚠️"
                label="Overdue Customers"
                value={data.overdueCount}
                sub="need service now"
                color="#ef4444"
              />
              <KpiCard
                icon="🛡️"
                label="AMC Renewals"
                value={data.amcRenewalsThisMonth}
                sub="due this month"
                color="#f59e0b"
              />
            </div>

            {/* Monthly Revenue */}
            <div className="an-card">
              <div className="an-card-title">
                Monthly Revenue — Collected vs Pending
              </div>
              <BarChart
                data={data.monthlyRevenue}
                valueKey="revenue"
                secondKey="pending"
                label="Collected"
                color="#6173c7"
                secondColor="#fca5a5"
              />
            </div>

            {/* Revenue split */}
            <div className="an-card-row">
              <div className="an-card an-card-half">
                <div className="an-card-title">Revenue by Type</div>
                <DonutChart
                  slices={[
                    {
                      label: "Filter Sales",
                      value: data.revenueByType.FILTER_SALE,
                      color: "#6173c7",
                    },
                    {
                      label: "Service",
                      value: data.revenueByType.SERVICE,
                      color: "#22c55e",
                    },
                    {
                      label: "AMC",
                      value: data.revenueByType.AMC_PAYMENT,
                      color: "#f59e0b",
                    },
                    {
                      label: "Parts Sale",
                      value: data.revenueByType.PARTS_SALE || 0,
                      color: "#8b5cf6",
                    },
                  ]}
                />
                <div className="an-type-breakdown">
                  <div>
                    <span style={{ color: "#6173c7" }}>●</span> Filter Sales:{" "}
                    <strong>{fmtRs(data.revenueByType.FILTER_SALE)}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#22c55e" }}>●</span> Services:{" "}
                    <strong>{fmtRs(data.revenueByType.SERVICE)}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#f59e0b" }}>●</span> AMC:{" "}
                    <strong>{fmtRs(data.revenueByType.AMC_PAYMENT)}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#8b5cf6" }}>●</span> Parts Sale:{" "}
                    <strong>{fmtRs(data.revenueByType.PARTS_SALE || 0)}</strong>
                  </div>
                </div>
              </div>

              <div className="an-card an-card-half">
                <div className="an-card-title">Collection Status</div>
                <DonutChart
                  slices={[
                    {
                      label: "Collected",
                      value: data.collectionData.totalPaid,
                      color: "#22c55e",
                    },
                    {
                      label: "Pending",
                      value: data.collectionData.pending,
                      color: "#ef4444",
                    },
                  ]}
                />
                <div className="an-type-breakdown">
                  <div>
                    <span style={{ color: "#22c55e" }}>●</span> Collected:{" "}
                    <strong>{fmtRs(data.collectionData.totalPaid)}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#ef4444" }}>●</span> Pending:{" "}
                    <strong>{fmtRs(data.collectionData.pending)}</strong>
                  </div>
                  <div>
                    Billed Total:{" "}
                    <strong>{fmtRs(data.collectionData.totalAmount)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══ CUSTOMERS TAB ════════════════════════════════════════════════ */}
        {tab === "customers" && (
          <>
            <div className="an-kpi-row">
              <KpiCard
                icon="✅"
                label="Active Customers"
                value={fmt(data.activeCount)}
                color="#22c55e"
              />
              <KpiCard
                icon="🔒"
                label="Inactive Customers"
                value={fmt(data.inactiveCount)}
                color="#94a3b8"
              />
              <KpiCard
                icon="🔄"
                label="Regular"
                value={fmt(data.customerBreakdown.REGULAR)}
                color="#6173c7"
              />
              <KpiCard
                icon="🛡️"
                label="AMC"
                value={fmt(data.customerBreakdown.AMC)}
                color="#f59e0b"
              />
              <KpiCard
                icon="🔧"
                label="Service Only"
                value={fmt(data.customerBreakdown.SERVICE_ONLY)}
                color="#22c55e"
              />
            </div>

            {/* New customers */}
            <div className="an-card">
              <div className="an-card-title">New Customers per Month</div>
              <BarChart
                data={data.newCustomers}
                valueKey="count"
                label="New Customers"
                color="#6173c7"
              />
            </div>

            <div className="an-card-row">
              <div className="an-card an-card-half">
                <div className="an-card-title">Customer Type Breakdown</div>
                <DonutChart
                  slices={[
                    {
                      label: "Regular",
                      value: data.customerBreakdown.REGULAR,
                      color: "#6173c7",
                    },
                    {
                      label: "AMC",
                      value: data.customerBreakdown.AMC,
                      color: "#f59e0b",
                    },
                    {
                      label: "Service Only",
                      value: data.customerBreakdown.SERVICE_ONLY,
                      color: "#22c55e",
                    },
                  ]}
                />
              </div>

              <div className="an-card an-card-half">
                <div className="an-card-title">Top Serviced RO Models</div>
                {(data.topRoModels || []).length === 0 ? (
                  <div className="an-empty">No data yet</div>
                ) : (
                  <HBar
                    items={data.topRoModels}
                    nameKey="model"
                    valueKey="count"
                    color="#6173c7"
                  />
                )}
              </div>
            </div>
          </>
        )}

        {/* ══ SERVICES TAB ═════════════════════════════════════════════════ */}
        {tab === "services" && (
          <>
            <div className="an-kpi-row">
              <KpiCard
                icon="🔧"
                label="Avg Service Charge"
                value={fmtRs(data.avgServiceCharge)}
                color="#6173c7"
                sub="per visit"
              />
              <KpiCard
                icon="📅"
                label="Scheduled"
                value={fmt(data.serviceTypeRatio.SCHEDULED)}
                color="#22c55e"
              />
              <KpiCard
                icon="⚡"
                label="Early"
                value={fmt(data.serviceTypeRatio.EARLY)}
                color="#f59e0b"
              />
              <KpiCard
                icon="🚨"
                label="Emergency"
                value={fmt(data.serviceTypeRatio.EMERGENCY)}
                color="#ef4444"
              />
              <KpiCard
                icon="🛡️"
                label="AMC Service"
                value={fmt(data.serviceTypeRatio.AMC_SERVICE)}
                color="#8b5cf6"
              />
            </div>

            {/* Services per month */}
            <div className="an-card">
              <div className="an-card-title">Services per Month</div>
              <BarChart
                data={data.servicesPerMonth}
                valueKey="count"
                label="Services"
                color="#22c55e"
              />
            </div>

            <div className="an-card-row">
              <div className="an-card an-card-half">
                <div className="an-card-title">Service Type Ratio</div>
                <DonutChart
                  slices={[
                    {
                      label: "Scheduled",
                      value: data.serviceTypeRatio.SCHEDULED,
                      color: "#22c55e",
                    },
                    {
                      label: "Early",
                      value: data.serviceTypeRatio.EARLY,
                      color: "#f59e0b",
                    },
                    {
                      label: "Emergency",
                      value: data.serviceTypeRatio.EMERGENCY,
                      color: "#ef4444",
                    },
                    {
                      label: "AMC Service",
                      value: data.serviceTypeRatio.AMC_SERVICE,
                      color: "#8b5cf6",
                    },
                  ]}
                />
              </div>

              <div className="an-card an-card-half">
                <div className="an-card-title">Most Replaced Parts (Top 8)</div>
                {(data.topParts || []).length === 0 ? (
                  <div className="an-empty">No parts data yet</div>
                ) : (
                  <HBar
                    items={data.topParts.slice(0, 8)}
                    nameKey="name"
                    valueKey="count"
                    color="#ef4444"
                  />
                )}
              </div>
            </div>

            {/* Parts table */}
            {(data.topParts || []).length > 0 && (
              <div className="an-card">
                <div className="an-card-title">Parts Revenue Breakdown</div>
                <table className="an-table">
                  <thead>
                    <tr>
                      <th>Part</th>
                      <th>Times Replaced</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topParts.map((p, i) => (
                      <tr key={i}>
                        <td>{p.name}</td>
                        <td>{p.count}</td>
                        <td>{fmtRs(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ══ DUES TAB ═════════════════════════════════════════════════════ */}
        {tab === "dues" && dues && (
          <>
            <div className="an-kpi-row">
              <KpiCard
                icon="💰"
                label="Total Pending"
                value={fmtRs(dues.totalPending)}
                color="#ef4444"
              />
              <KpiCard
                icon="👤"
                label="Filter Payment Dues"
                value={dues.customerDues?.length || 0}
                color="#f59e0b"
                sub="customers with unpaid filters"
              />
              <KpiCard
                icon="📄"
                label="Invoice Dues"
                value={dues.invoiceDues?.length || 0}
                color="#6173c7"
                sub="partial or unpaid invoices"
              />
            </div>

            {/* Filter sale dues */}
            {(dues.customerDues || []).length > 0 && (
              <div className="an-card">
                <div className="an-card-title">
                  Filter Sale — Unpaid / Partial
                </div>
                <table className="an-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Phone</th>
                      <th>RO Model</th>
                      <th>Total</th>
                      <th>Paid</th>
                      <th>Pending</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dues.customerDues.map((c) => (
                      <tr
                        key={c.id}
                        className="an-clickrow"
                        onClick={() => navigate(`/customers/${c.id}`)}
                      >
                        <td>{c.name}</td>
                        <td>
                          <a
                            href={`tel:${c.phone}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {c.phone}
                          </a>
                        </td>
                        <td>{c.roModel || "-"}</td>
                        <td>{fmtRs(c.filterPrice)}</td>
                        <td>{fmtRs(c.paidAmount)}</td>
                        <td className="an-due-amt">{fmtRs(c.pendingAmount)}</td>
                        <td>
                          <span
                            className={`an-status-badge an-status-${(c.status || "unknown").toLowerCase()}`}
                          >
                            {c.status || "Unknown"}
                          </span>
                        </td>
                        <td>
                          <span className="an-arrow">→</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Invoice dues */}
            {(dues.invoiceDues || []).length > 0 && (
              <div className="an-card">
                <div className="an-card-title">
                  Invoice Dues — All Pending Payments
                </div>
                <table className="an-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Phone</th>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Total</th>
                      <th>Paid</th>
                      <th>Pending</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dues.invoiceDues.map((inv) => (
                      <tr key={inv.id}>
                        <td>{inv.customerName}</td>
                        <td>
                          <a href={`tel:${inv.customerPhone}`}>
                            {inv.customerPhone}
                          </a>
                        </td>
                        <td>
                          <span className="an-type-badge">
                            {(inv.type || "").replace("_", " ")}
                          </span>
                        </td>
                        <td>
                          {new Date(inv.invoiceDate).toLocaleDateString(
                            "en-IN",
                            { day: "numeric", month: "short", year: "numeric" },
                          )}
                        </td>
                        <td>{fmtRs(inv.totalAmount)}</td>
                        <td>{fmtRs(inv.paidAmount)}</td>
                        <td className="an-due-amt">
                          {fmtRs(inv.pendingAmount)}
                        </td>
                        <td>
                          <span
                            className={`an-status-badge an-status-${(inv.status || "unknown").toLowerCase()}`}
                          >
                            {inv.status || "Unknown"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(dues.customerDues || []).length === 0 &&
              (dues.invoiceDues || []).length === 0 && (
                <div
                  className="an-card"
                  style={{ textAlign: "center", padding: 48 }}
                >
                  <div style={{ fontSize: 48 }}>🎉</div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginTop: 12 }}>
                    All clear!
                  </div>
                  <div style={{ color: "#64748b", marginTop: 4 }}>
                    No pending dues found.
                  </div>
                </div>
              )}
          </>
        )}
      </div>
    </div>
  );
};

export default Analytics;