import { useEffect, useState } from "react";
import api from "../../api/apiClient";
import Loading from "../../components/Loading";
import ErrorState from "../../components/ErrorState";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import "../../styles/invoicelist.css";
import { getEnumLabel } from "../../utils/enumLabels";

const InvoicesList = () => {
  const [invoices, setInvoices] = useState([]);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [type, setType] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState("");
  const limit = 20;

  const loadInvoices = async (page = 1) => {
    setLoading(true);
    setError("");

    try {
      const params = {
        page,
        limit,
      };

      if (customerName) params.customerName = customerName;
      if (type) params.type = type;
      if (paymentStatus) params.paymentStatus = paymentStatus;
      if (month) params.month = month;
      if (year) params.year = year;

      const [invoiceRes, userRes] = await Promise.all([
        api.get("/api/invoices", { params }),
        api.get("/api/auth/me"),
      ]);

      setInvoices(invoiceRes.invoices || []);
      setTotalPages(invoiceRes.totalPages || 1);
      setCurrentPage(invoiceRes.currentPage || 1);
      setBusiness(userRes.user || null);
    } catch (err) {
      setError(err.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices(1);
  }, []);

  const applyFilters = () => {
    setCurrentPage(1);
    loadInvoices(1);
  };

  const formatDate = (date) => new Date(date).toLocaleDateString("en-IN");
  const formatMoney = (value) => Number(value || 0).toLocaleString("en-IN");
  const invoiceTypeLabel = (invoiceType) => getEnumLabel("invoiceType", invoiceType);

  const generateInvoicePDF = (inv) => {
    const doc = new jsPDF();

    const businessName = business?.businessName || "";
    const ownerName = `${business?.firstname || ""} ${business?.lastname || ""}`;
    const businessPhone = business?.phone || "";
    const businessEmail = business?.email || "";

    let y = 20;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(businessName, 20, y);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    y += 6;
    doc.text(`Owner: ${ownerName}`, 20, y);
    y += 5;
    doc.text(`Phone: ${businessPhone}`, 20, y);
    y += 5;
    doc.text(`Email: ${businessEmail}`, 20, y);

    doc.setFontSize(26);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", 200, 25, { align: "right" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Invoice ID: ${inv.id}`, 200, 35, { align: "right" });
    doc.text(`Date: ${formatDate(inv.invoiceDate)}`, 200, 40, {
      align: "right",
    });
    doc.text(`Type: ${invoiceTypeLabel(inv.type)}`, 200, 45, {
      align: "right",
    });

    doc.line(20, 52, 200, 52);

    y = 60;
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", 20, y);

    doc.setFont("helvetica", "normal");
    y += 7;
    doc.text(inv.customer?.name || "", 20, y);
    y += 6;
    doc.text(`Phone: ${inv.customer?.phone || ""}`, 20, y);

    if (
      inv.customer?.customerType === "AMC" &&
      inv.customer?.amcContract?.startDate &&
      inv.customer?.amcContract?.endDate
    ) {
      y += 6;
      doc.text(
        `AMC Plan Period: ${formatDate(inv.customer.amcContract.startDate)} - ${formatDate(inv.customer.amcContract.endDate)}`,
        20,
        y
      );
      y += 6;
      doc.text(
        `AMC Renewal Date: ${formatDate(inv.customer.amcContract.endDate)}`,
        20,
        y
      );
    }

    const rows = inv.items.map((item, index) => [
      index + 1,
      item.name,
      formatMoney(item.price),
    ]);

    autoTable(doc, {
      startY: y + 10,
      head: [["#", "Description", "Amount (Rs)"]],
      body: rows,
      theme: "grid",
    });

    const finalY = doc.lastAutoTable.finalY + 15;

    doc.text("Subtotal:", 140, finalY);
    doc.text(`Rs ${formatMoney(inv.totalAmount)}`, 200, finalY, {
      align: "right",
    });

    doc.text("Paid:", 140, finalY + 8);
    doc.text(`Rs ${formatMoney(inv.paidAmount)}`, 200, finalY + 8, {
      align: "right",
    });

    doc.setFont("helvetica", "bold");
    doc.text("Pending:", 140, finalY + 16);
    doc.text(`Rs ${formatMoney(inv.pendingAmount)}`, 200, finalY + 16, {
      align: "right",
    });

    doc.save(`invoice_${inv.customer?.name}.pdf`);
  };

  const handleDeleteInvoice = async (invoice) => {
    const confirmed = window.confirm(
      `Delete invoice for ${invoice.customer?.name || "this customer"} on ${formatDate(invoice.invoiceDate)}? This cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      setDeletingInvoiceId(invoice.id);
      setError("");
      const response = await api.delete(`/api/invoices/${invoice.id}`);

      await loadInvoices(currentPage);
      if (response?.message) {
        window.alert(response.message);
      }
    } catch (err) {
      const message = err?.message || "Failed to delete invoice";
      setError(message);
      window.alert(message);
    } finally {
      setDeletingInvoiceId("");
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="invoices-wrapper">
      <h2 className="invoices-title">Invoices</h2>

      <div className="invoice-filters">
        <input
          placeholder="Search Customer Name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
        />

        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All Types</option>
          <option value="FILTER_SALE">Filter Sale</option>
          <option value="SERVICE">Service</option>
          <option value="AMC_PAYMENT">AMC Payment</option>
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

        <button className="apply-btn" onClick={applyFilters}>
          Apply Filters
        </button>
      </div>

      {invoices.length === 0 ? (
        <p className="no-results">No invoices found</p>
      ) : (
        <>
          {invoices.map((inv) => (
            <div key={inv.id} className="invoice-card">
              <div className="invoice-card-header">
                <div>
                  <span className="stat-label">Date</span>
                  <div className="stat-value">
                    {formatDate(inv.invoiceDate)}
                  </div>
                </div>
                <span className="status-badge">{getEnumLabel("paymentStatus", inv.paymentStatus)}</span>
              </div>

              <div className="invoice-grid">
                <div className="invoice-stat">
                  <span className="stat-label">Type</span>
                  <span className="stat-value">
                    {getEnumLabel("invoiceType", inv.type)}
                  </span>
                </div>
                <div className="invoice-stat">
                  <span className="stat-label">Customer</span>
                  <span className="stat-value">{inv.customer?.name}</span>
                </div>
                <div className="invoice-stat">
                  <span className="stat-label">Total</span>
                  <span className="stat-value">
                    Rs {formatMoney(inv.totalAmount)}
                  </span>
                </div>
              </div>

              <div className="invoice-actions">
                <button
                  className="pdf-btn"
                  onClick={() => generateInvoicePDF(inv)}
                >
                  Download Invoice PDF
                </button>

                <button
                  className="delete-btn"
                  onClick={() => handleDeleteInvoice(inv)}
                  disabled={deletingInvoiceId === inv.id}
                >
                  {deletingInvoiceId === inv.id ? "Deleting..." : "Delete Invoice"}
                </button>
              </div>
            </div>
          ))}

          <div className="pagination">
            <button
              disabled={currentPage === 1}
              onClick={() => loadInvoices(currentPage - 1)}
            >
              Prev
            </button>

            {[...Array(totalPages)].map((_, index) => {
              const pageNumber = index + 1;
              return (
                <button
                  key={pageNumber}
                  className={currentPage === pageNumber ? "active-page" : ""}
                  onClick={() => loadInvoices(pageNumber)}
                >
                  {pageNumber}
                </button>
              );
            })}

            <button
              disabled={currentPage === totalPages}
              onClick={() => loadInvoices(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default InvoicesList;
