import { useEffect, useState } from "react";
import api from "../../api/apiClient";
import Loading from "../../components/Loading";
import ErrorState from "../../components/ErrorState";
import { jsPDF } from "jspdf";
import "../../styles/invoicelist.css"; // Import the CSS

const InvoicesList = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [customerId, setCustomerId] = useState("");
  const [type, setType] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");

  const loadInvoices = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (customerId) params.customer = customerId;
      if (type) params.type = type;
      if (paymentStatus) params.paymentStatus = paymentStatus;
      if (month) params.month = month;
      if (year) params.year = year;

      const res = await api.get("/api/invoices", { params });
      setInvoices(Array.isArray(res.invoices) ? res.invoices : []);
    } catch (err) {
      setError(err.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const isFullyPaid = (inv) => {
    if (!inv) return false;
    if (inv.paymentStatus === "PAID") return true;
    if (Number(inv.pendingAmount) === 0) return true;
    return Number(inv.totalAmount || 0) === Number(inv.paidAmount || 0);
  };

  const getStatusClass = (status) => {
    const s = String(status).toUpperCase();
    if (s === "PAID") return "status-badge status-paid";
    if (s === "PARTIAL") return "status-badge status-partial";
    return "status-badge status-unpaid";
  };

  // generateInvoicePDF function remains exactly as you had it
  const generateInvoicePDF = (inv) => {
    const doc = new jsPDF();
    const safeText = (v) => String(v || "-");
    const formatDate = (date) => {
      if (!date) return "-";
      const d = new Date(date);
      return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-IN");
    };
    const money = (v) => `Rs. ${Number(v || 0).toLocaleString("en-IN")}`;

    const customerName = (inv.customer?.name || "customer")
      .replace(/\s+/g, "_")
      .toLowerCase();
    const customerPhone = inv.customer?.phone || "unknown";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text("INVOICE", 105, 25, { align: "center" });
    doc.line(20, 30, 190, 30);

    let y = 45;
    doc.rect(105, 40, 85, 40);
    doc.setFontSize(9);
    doc.text("INVOICE NO.", 110, y + 5);
    doc.setFont("helvetica", "normal");
    doc.text(safeText(inv._id || inv.id), 110, y + 12);

    doc.setFont("helvetica", "bold");
    doc.text("DATE", 110, y + 27);
    doc.setFont("helvetica", "normal");
    doc.text(formatDate(inv.invoiceDate || inv.createdAt), 110, y + 34);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("BILL TO", 20, y);
    doc.setFontSize(11);
    doc.text(safeText(inv.customer?.name), 20, y + 8);
    doc.setFont("helvetica", "normal");
    doc.text(`Phone: ${safeText(inv.customer?.phone)}`, 20, y + 16);

    y = 92;
    doc.rect(20, y - 5, 170, 10);
    doc.setFont("helvetica", "bold");
    doc.text("DESCRIPTION", 25, y + 2);
    doc.text("AMOUNT", 185, y + 2, { align: "right" });

    y += 15;
    doc.setFont("helvetica", "normal");
    doc.text(
      inv.type === "FILTER_SALE" ? "Filter Sale" : "Service Charge",
      25,
      y,
    );
    doc.text(money(inv.totalAmount), 185, y, { align: "right" });

    y += 20;
    doc.line(20, y, 190, y);
    y += 12;
    doc.text("Subtotal", 130, y);
    doc.text(money(inv.totalAmount), 185, y, { align: "right" });
    y += 8;
    doc.text("Paid Amount", 130, y);
    doc.text(money(inv.paidAmount), 185, y, { align: "right" });

    y += 15;
    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT STATUS", 130, y + 4);
    doc.text(safeText(inv.paymentStatus), 185, y + 4, { align: "right" });

    doc.save(`invoice_${customerName}_${customerPhone}.pdf`);
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="invoices-wrapper">
      <h2 className="invoices-title">Invoices</h2>

      <div className="invoice-filters">
        <input
          placeholder="Customer ID"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All Types</option>
          <option value="FILTER_SALE">Filter Sale</option>
          <option value="SERVICE">Service</option>
        </select>
        <select
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value)}
        >
          <option value="">All Payments</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="UNPAID">Unpaid</option>
        </select>
        <input
          type="number"
          placeholder="Month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <input
          type="number"
          placeholder="Year"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />
        <button className="apply-btn" onClick={loadInvoices}>
          Apply Filters
        </button>
      </div>

      {invoices.length === 0 ? (
        <p className="no-results">No invoices found</p>
      ) : (
        invoices.map((inv) => (
          <div key={inv._id || inv.id} className="invoice-card">
            <div className="invoice-card-header">
              <div>
                <span className="stat-label">Date</span>
                <div className="stat-value">
                  {new Date(inv.createdAt).toLocaleDateString()}
                </div>
              </div>
              <span className={getStatusClass(inv.paymentStatus)}>
                {inv.paymentStatus}
              </span>
            </div>

            <div className="invoice-grid">
              <div className="invoice-stat">
                <span className="stat-label">Customer</span>
                <span className="stat-value">{inv.customer?.name}</span>
              </div>
              <div className="invoice-stat">
                <span className="stat-label">Type</span>
                <span className="stat-value">{inv.type}</span>
              </div>
              <div className="invoice-stat">
                <span className="stat-label">Total</span>
                <span className="stat-value">₹{inv.totalAmount}</span>
              </div>
              <div className="invoice-stat">
                <span className="stat-label">Paid</span>
                <span className="stat-value" style={{ color: "#16a34a" }}>
                  ₹{inv.paidAmount}
                </span>
              </div>
              <div className="invoice-stat">
                <span className="stat-label">Pending</span>
                <span className="stat-value" style={{ color: "#dc2626" }}>
                  ₹{inv.pendingAmount}
                </span>
              </div>
            </div>

            {isFullyPaid(inv) && (
              <button
                className="pdf-btn"
                onClick={() => generateInvoicePDF(inv)}
              >
                📄 Download Invoice PDF
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default InvoicesList;
