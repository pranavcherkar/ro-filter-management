import { getEnumLabel } from "../../../utils/enumLabels";

// ── Helpers (local to this file) ───────────────────────────────────────────
const formatDate = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const renderSafeValue = (val) => {
  if (val === null || val === undefined) return "-";
  if (typeof val === "object") return val.mapLink || "-";
  return String(val);
};

const getBadgeClass = (status) => {
  const s = String(status || "").toLowerCase();
  return ["paid", "active", "completed"].includes(s)
    ? "badge badge-good"
    : "badge badge-bad";
};

// ── Component ──────────────────────────────────────────────────────────────
const CustomerInfoSection = ({
  customer,
  id,
  navigate,
  isPaid,
  isRegular,
  isAmc,
  isServiceOnly,
  showDeleteModal,
  setShowDeleteModal,
  closeDeleteModal,
  deleteMode,
  setDeleteMode,
  deleteError,
  deleteLoading,
  handleDeleteCustomer,
}) => {
  const amcStatus = customer?.amcContract?.status || "NOT STARTED";

  return (
    <>
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="detail-header">
        <div>
          <h1>{renderSafeValue(customer.name)}</h1>
          <p>
            <a
              href={`tel:${customer.phone}`}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              📞 {renderSafeValue(customer.phone)}
            </a>
          </p>

          <div style={{ marginTop: 6 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "2px 10px",
                borderRadius: 20,
                background: isAmc
                  ? "#e0e7ff"
                  : isServiceOnly
                    ? "#fef9c3"
                    : "#dcfce7",
                color: isAmc
                  ? "#3730a3"
                  : isServiceOnly
                    ? "#854d0e"
                    : "#166534",
              }}
            >
              {getEnumLabel("customerType", customer.customerType)}
            </span>
          </div>

          {customer.installationDate && (
            <div className="install-date">
              Installed on: {formatDate(customer.installationDate)}
            </div>
          )}
        </div>

        <div className="header-due">
          <div className="due-label">NEXT SERVICE DUE</div>
          <div className="due-date">
            {formatDate(customer.service?.nextServiceDate)}
          </div>
        </div>
      </header>

      {/* ── ACTION BUTTONS ──────────────────────────────────────────────── */}
      <div className="action-panel">
        <button
          onClick={() => navigate(`/customers/${id}/edit`)}
          className="btn btn-primary"
        >
          Edit Profile
        </button>

        {customer?.payment?.filterPrice > 0 && (
          <button
            onClick={() => !isPaid && navigate(`/customers/${id}/payment`)}
            className={`btn btn-outline ${isPaid ? "btn-disabled" : ""}`}
            disabled={isPaid}
          >
            {isPaid ? "Filter Payment ✔" : "Update Filter Payment"}
          </button>
        )}

        <button
          onClick={() => navigate(`/customers/${id}/services/new`)}
          className="btn btn-outline"
        >
          + Add Service
        </button>

        <button
          onClick={() => setShowDeleteModal(true)}
          className="btn btn-danger"
        >
          Delete Customer
        </button>
      </div>

      {isPaid && <div className="paid-banner">Payment completed.</div>}

      {/* ── INFO GRID ───────────────────────────────────────────────────── */}
      <div className="info-grid">
        {/* Installation / Machine Details */}
        <div className="detail-card">
          <div className="section-title">
            {customer.installationDate
              ? "Installation Details"
              : "Machine Details"}
          </div>

          <div className="info-row">
            <span className="info-label">Address</span>
            <span className="info-value">
              {renderSafeValue(customer.address)}
            </span>
          </div>

          <div className="info-row">
            <span className="info-label">RO Model</span>
            <span className="info-value">
              {renderSafeValue(customer.roModel)}
            </span>
          </div>

          <div className="info-row">
            <span className="info-label">Body Type</span>
            <span className="info-value">
              {renderSafeValue(customer.roBodyType)}
            </span>
          </div>

          {customer.installationDate && (
            <div className="info-row">
              <span className="info-label">Installation Date</span>
              <span className="info-value">
                {formatDate(customer.installationDate)}
              </span>
            </div>
          )}

          <div className="info-row">
            <span className="info-label">Location</span>
            <span className="info-value">
              {customer.location?.mapLink ? (
                <a
                  href={customer.location.mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#2563eb", textDecoration: "underline" }}
                >
                  Open in Maps
                </a>
              ) : (
                "-"
              )}
            </span>
          </div>
        </div>

        {/* Service Health */}
        <div className="detail-card">
          <div className="section-title">Service Health</div>

          {customer?.payment?.filterPrice > 0 && (
            <div className="info-row">
              <span className="info-label">Payment Status</span>
              <span className={getBadgeClass(customer.payment?.status)}>
                {getEnumLabel("paymentStatus", customer.payment?.status)}
              </span>
            </div>
          )}

          {isAmc && (
            <div className="info-row">
              <span className="info-label">AMC Status</span>
              <span className={getBadgeClass(amcStatus)}>
                {getEnumLabel("amcStatus", amcStatus)}
              </span>
            </div>
          )}

          <div className="info-row">
            <span className="info-label">Last Service</span>
            <span className="info-value">
              {formatDate(customer.service?.lastServiceDate)}
            </span>
          </div>

          <div className="info-row">
            <span className="info-label">Next Service Due</span>
            <span className="info-value">
              {formatDate(customer.service?.nextServiceDate)}
            </span>
          </div>
        </div>
      </div>

      {/* ── FINANCIAL SUMMARY — REGULAR only ────────────────────────────── */}
      {customer?.payment?.filterPrice > 0 && (
        <div className="detail-card financial-card">
          <div className="section-title">💰 Financial Summary</div>

          <div className="financial-summary-row">
            <div className="financial-box">
              <div className="financial-label">Filter Price</div>
              <div className="financial-amount">
                ₹{renderSafeValue(customer.payment?.filterPrice)}
              </div>
            </div>

            <div className="financial-box">
              <div className="financial-label">Total Paid</div>
              <div className="financial-amount">
                ₹{renderSafeValue(customer.payment?.paidAmount)}
              </div>
            </div>

            <div className="financial-box">
              <div className="financial-label">Balance Due</div>
              <div className="financial-amount">
                ₹{renderSafeValue(customer.payment?.pendingAmount)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CUSTOMER MODAL ────────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Customer Delete</h3>
              <button className="close-btn" onClick={closeDeleteModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <p>
                Choose delete mode for <strong>{customer.name}</strong>.
              </p>

              <label className="delete-mode-option">
                <input
                  type="radio"
                  name="delete-mode"
                  value="soft"
                  checked={deleteMode === "soft"}
                  onChange={(e) => setDeleteMode(e.target.value)}
                />
                <span>
                  <strong>Soft delete:</strong> mark customer as inactive.
                </span>
              </label>

              <label className="delete-mode-option">
                <input
                  type="radio"
                  name="delete-mode"
                  value="hard"
                  checked={deleteMode === "hard"}
                  onChange={(e) => setDeleteMode(e.target.value)}
                />
                <span>
                  <strong>Hard delete:</strong> permanently remove customer,
                  services, and invoices.
                </span>
              </label>

              {deleteError && <div className="delete-error">{deleteError}</div>}

              <div className="delete-actions">
                <button className="btn btn-outline" onClick={closeDeleteModal}>
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleDeleteCustomer}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CustomerInfoSection;
