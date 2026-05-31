import { getEnumLabel } from "../../../utils/enumLabels";

// ── Helpers ────────────────────────────────────────────────────────────────
const formatDate = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getBadgeClass = (status) => {
  const s = String(status || "").toLowerCase();
  return ["paid", "active", "completed"].includes(s)
    ? "badge badge-good"
    : "badge badge-bad";
};

// ── AMC form field config ──────────────────────────────────────────────────
const AMC_FORM_FIELDS = [
  {
    label: "Amount Paid (₹)",
    key: "amount",
    type: "number",
    placeholder: "e.g. 2000",
  },
  {
    label: "Total AMC Fee (₹)",
    key: "totalAmcAmount",
    type: "number",
    placeholder: "Full fee for the period",
  },
  { label: "AMC Start Date", key: "startDate", type: "date" },
  { label: "AMC End Date", key: "endDate", type: "date" },
  { label: "Payment Date", key: "paymentDate", type: "date" },
  { label: "Payment Status", key: "paymentStatus", type: "select" },
  {
    label: "Notes (optional)",
    key: "notes",
    type: "text",
    placeholder: "Any notes",
  },
];

// ── Component ──────────────────────────────────────────────────────────────
const AmcSection = ({
  customer,
  amcStatus,
  amcDaysLeft,
  lastAmcPayment,
  amcLoading,
  // Start / Renew modal
  showAmcModal,
  openAmcModal,
  closeAmcModal,
  amcForm,
  setAmcForm,
  amcError,
  handleAmcPayment,
  handleStopAmc,
  // Update payment modal
  showAmcUpdateModal,
  setShowAmcUpdateModal,
  amcUpdateAmount,
  setAmcUpdateAmount,
  amcUpdateError,
  amcUpdateLoading,
  handleUpdateAmcPayment,
}) => {
  const totalFee = customer?.amcContract?.totalAmcAmount || 0;
  const paidSoFar = customer?.amcContract?.paidAmcAmount || 0;
  const remaining = Math.max(0, totalFee - paidSoFar);

  // Remaining due preview inside the Start/Renew modal
  const modalTotal = Number(amcForm.totalAmcAmount) || 0;
  const modalPaid = Number(amcForm.amount) || 0;
  const modalRemaining = Math.max(0, modalTotal - modalPaid);

  return (
    <>
      {/* ── AMC DETAILS CARD ────────────────────────────────────────────── */}
      <div className="detail-card amc-card">
        <div className="section-title">🛡️ AMC Details</div>

        <div className="info-row">
          <span className="info-label">AMC Status</span>
          <span className={getBadgeClass(amcStatus)}>
            {getEnumLabel("amcStatus", amcStatus)}
          </span>
        </div>

        <div className="info-row">
          <span className="info-label">Start Date / End Date</span>
          <span className="info-value">
            {formatDate(customer?.amcContract?.startDate)} /{" "}
            {formatDate(customer?.amcContract?.endDate)}
          </span>
        </div>

        <div className="info-row">
          <span className="info-label">Days Left</span>
          <span className="info-value">{amcDaysLeft}</span>
        </div>

        <div className="info-row">
          <span className="info-label">Total AMC Fee</span>
          <span className="info-value">
            {totalFee ? `₹${totalFee.toLocaleString("en-IN")}` : "-"}
          </span>
        </div>

        <div className="info-row">
          <span className="info-label">Paid So Far</span>
          <span className="info-value">
            {customer?.amcContract?.paidAmcAmount != null
              ? `₹${paidSoFar.toLocaleString("en-IN")}`
              : "-"}
          </span>
        </div>

        <div className="info-row">
          <span className="info-label">Remaining</span>
          <span
            className="info-value"
            style={{
              color: remaining > 0 ? "#dc2626" : "#16a34a",
              fontWeight: 600,
            }}
          >
            ₹{remaining.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="info-row">
          <span className="info-label">Last Payment</span>
          <span className="info-value">
            {lastAmcPayment.amount
              ? `₹${lastAmcPayment.amount.toLocaleString("en-IN")} on ${formatDate(lastAmcPayment.date)}`
              : "-"}
          </span>
        </div>

        <div className="amc-action-panel">
          <button className="btn btn-primary" onClick={openAmcModal}>
            {amcStatus === "NOT STARTED" ? "Start AMC" : "Renew AMC"}
          </button>

          {customer?.amcContract && (!totalFee || paidSoFar < totalFee) && (
            <button
              className="btn btn-outline"
              onClick={() => setShowAmcUpdateModal(true)}
            >
              Update AMC Payment
            </button>
          )}

          <button
            className="btn btn-outline"
            onClick={handleStopAmc}
            disabled={amcStatus === "NOT STARTED" || amcLoading}
          >
            Stop AMC
          </button>
        </div>
      </div>

      {/* ── START / RENEW AMC MODAL ──────────────────────────────────────── */}
      {showAmcModal && (
        <div className="modal-overlay" onClick={closeAmcModal}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              flexDirection: "column",
              maxHeight: "90vh" /* never taller than viewport */,
              width: "95%",
              maxWidth: 480,
            }}
          >
            {/* Fixed header */}
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <h3 style={{ margin: 0 }}>
                {amcStatus === "NOT STARTED"
                  ? "Start AMC"
                  : "Renew / Record AMC Payment"}
              </h3>
              <button className="close-btn" onClick={closeAmcModal}>
                ×
              </button>
            </div>

            {/* Scrollable body */}
            <div
              className="modal-body"
              style={{ overflowY: "auto", flex: 1, paddingTop: 12 }}
            >
              {amcError && (
                <div className="delete-error" style={{ marginBottom: 12 }}>
                  {amcError}
                </div>
              )}

              {AMC_FORM_FIELDS.map(({ label, key, type, placeholder }) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 4,
                      fontWeight: 500,
                      fontSize: 14,
                    }}
                  >
                    {label}
                  </label>

                  {type === "select" ? (
                    <select
                      value={amcForm[key]}
                      onChange={(e) =>
                        setAmcForm((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #ccc",
                        fontSize: 14,
                        boxSizing: "border-box",
                      }}
                    >
                      <option value="PAID">Paid in Full</option>
                      <option value="PARTIAL">Partial / Half Paid</option>
                      <option value="PENDING">Pending / Not Collected</option>
                    </select>
                  ) : (
                    <input
                      type={type}
                      min={type === "number" ? "0" : undefined}
                      value={amcForm[key]}
                      placeholder={placeholder}
                      onChange={(e) =>
                        setAmcForm((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #ccc",
                        fontSize: 14,
                        boxSizing: "border-box",
                      }}
                    />
                  )}
                </div>
              ))}

              {/* Remaining due preview — only show when both fields filled */}
              {modalTotal > 0 && (
                <div
                  style={{
                    background: modalRemaining > 0 ? "#fff7ed" : "#f0fdf4",
                    border: `1px solid ${modalRemaining > 0 ? "#fed7aa" : "#86efac"}`,
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginBottom: 12,
                    fontSize: 14,
                  }}
                >
                  <div>
                    Total Fee:{" "}
                    <strong>₹{modalTotal.toLocaleString("en-IN")}</strong>
                  </div>
                  <div>
                    Paid Now:{" "}
                    <strong>
                      ₹{Math.min(modalPaid, modalTotal).toLocaleString("en-IN")}
                    </strong>
                  </div>
                  <div
                    style={{
                      color: modalRemaining > 0 ? "#c2410c" : "#16a34a",
                    }}
                  >
                    Remaining Due:{" "}
                    <strong>₹{modalRemaining.toLocaleString("en-IN")}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Fixed footer actions */}
            <div
              className="delete-actions"
              style={{
                flexShrink: 0,
                paddingTop: 12,
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button className="btn btn-outline" onClick={closeAmcModal}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAmcPayment}
                disabled={amcLoading}
              >
                {amcLoading ? "Saving..." : "Save AMC Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── UPDATE AMC PAYMENT MODAL ─────────────────────────────────────── */}
      {showAmcUpdateModal && (
        <div
          className="modal-overlay"
          onClick={() => !amcUpdateLoading && setShowAmcUpdateModal(false)}
        >
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Update AMC Payment</h3>
              <button
                className="close-btn"
                onClick={() => setShowAmcUpdateModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {/* Summary box */}
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #86efac",
                  borderRadius: 8,
                  padding: "10px 14px",
                  marginBottom: 14,
                  fontSize: 14,
                }}
              >
                <div>
                  Total fee:{" "}
                  <strong>₹{totalFee.toLocaleString("en-IN")}</strong>
                </div>
                <div>
                  Paid so far:{" "}
                  <strong>₹{paidSoFar.toLocaleString("en-IN")}</strong>
                </div>
                <div style={{ color: "#dc2626" }}>
                  Remaining:{" "}
                  <strong>₹{remaining.toLocaleString("en-IN")}</strong>
                </div>
              </div>

              {amcUpdateError && (
                <div className="delete-error" style={{ marginBottom: 12 }}>
                  {amcUpdateError}
                </div>
              )}

              <label
                style={{ display: "block", marginBottom: 4, fontWeight: 500 }}
              >
                Amount Received Now (₹)
              </label>
              <input
                type="number"
                min="1"
                value={amcUpdateAmount}
                onChange={(e) => setAmcUpdateAmount(e.target.value)}
                placeholder="Enter amount collected"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  marginBottom: 16,
                  boxSizing: "border-box",
                }}
              />

              <div className="delete-actions">
                <button
                  className="btn btn-outline"
                  onClick={() => setShowAmcUpdateModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleUpdateAmcPayment}
                  disabled={amcUpdateLoading}
                >
                  {amcUpdateLoading ? "Saving..." : "Record Payment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AmcSection;
