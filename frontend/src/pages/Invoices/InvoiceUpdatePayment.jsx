import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/apiClient";
import Loading from "../../components/Loading";
import ErrorState from "../../components/ErrorState";
import "../../styles/cusForm.css";

// Safe currency formatter - guards against null/undefined values from the
// API so we never call .toLocaleString() on something that isn't a number.
const fmtRs = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const InvoiceUpdatePayment = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [amount, setAmount]     = useState("");
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess]   = useState("");

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const res = await api.get(`/api/invoices/${id}`);
        const inv = res?.invoice || res;
        if (!inv) throw new Error("Invoice not found");
        if (!isMounted) return;
        if (inv.paymentStatus === "PAID") {
          navigate("/invoices");
          return;
        }
        setInvoice(inv);
      } catch (err) {
        if (isMounted) setError(err?.message || "Failed to load invoice");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Single source of truth for remaining balance, used for both validation
  // and display. Clamped to 0 so floating-point rounding or bad data (e.g.
  // paidAmount slightly exceeding totalAmount) never produces a negative
  // remaining balance that would silently block all payments.
  const remaining = invoice
    ? Math.max(0, Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0))
    : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveError("");
    const val = Number(amount);
    if (!val || val <= 0) {
      setSaveError("Enter a valid amount.");
      return;
    }
    if (val > remaining) {
      setSaveError(`Cannot exceed remaining balance of ${fmtRs(remaining)}.`);
      return;
    }
    try {
      setSaving(true);
      const res = await api.patch(`/api/invoices/${id}/payment`, {
        additionalPaidAmount: val,
      });
      const isNowPaid = val >= remaining;
      setSuccess(res.message || "Payment recorded");
      setInvoice((prev) => ({
        ...prev,
        paidAmount:    Number(prev.paidAmount || 0) + val,
        paymentStatus: isNowPaid ? "PAID" : "PARTIAL",
      }));
      setAmount("");
      if (isNowPaid) setTimeout(() => navigate("/invoices"), 1400);
    } catch (err) {
      setSaveError(err?.message || "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;
  if (error)   return <ErrorState message={error} />;
  if (!invoice) return null;

  const isPaid = invoice.paymentStatus === "PAID";

  return (
    <div className="form-page-wrapper">
      <div className="form-card">
        <div className="form-header">
          <h2>Record Payment</h2>
          <p style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
            {invoice.customerName}
            {invoice.customerPhone ? ` · ${invoice.customerPhone}` : ""}
          </p>
        </div>

        <div className="form-body">

          {/* Summary */}
          <div className="inv-pay-grid">
            <div className="inv-pay-box">
              <div className="inv-pay-label">Invoice Total</div>
              <div className="inv-pay-value">
                {fmtRs(invoice.totalAmount)}
              </div>
            </div>
            <div className="inv-pay-box">
              <div className="inv-pay-label">Paid So Far</div>
              <div className="inv-pay-value" style={{ color: "#22c55e" }}>
                {fmtRs(invoice.paidAmount)}
              </div>
            </div>
            <div className="inv-pay-box">
              <div className="inv-pay-label">Remaining</div>
              <div className="inv-pay-value" style={{ color: isPaid ? "#22c55e" : "#ef4444" }}>
                {fmtRs(remaining)}
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="inv-pay-items">
            <div className="inv-pay-items-title">Items</div>
            {(invoice.items || []).map((item, i) => (
              <div key={i} className="inv-pay-item-row">
                <span>{item.name}</span>
                <span>{fmtRs(item.price)}</span>
              </div>
            ))}
          </div>

          {success && (
            <div className="inv-pay-success">{success}</div>
          )}

          {isPaid ? (
            <div className="inv-pay-success">Invoice fully paid.</div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Amount Received Now (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder={`Up to ${fmtRs(remaining)}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  required
                />
              </div>

              {saveError && (
                <div className="inv-pay-error">{saveError}</div>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  className="submit-btn"
                  style={{ flex: 0, background: "#f1f5f9", color: "#334155" }}
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="submit-btn"
                  style={{ flex: 1 }}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Record Payment"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceUpdatePayment;