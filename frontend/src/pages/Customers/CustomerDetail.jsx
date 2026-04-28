import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/apiClient";
import Loading from "../../components/Loading";
import ErrorState from "../../components/ErrorState";
import "../../styles/cusDetails.css";
import { getEnumLabel } from "../../utils/enumLabels";

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [serviceHistory, setServiceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [selectedService, setSelectedService] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [serviceDeleteLoading, setServiceDeleteLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState("soft");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // AMC modal state
  const [showAmcModal, setShowAmcModal] = useState(false);
  const [amcLoading, setAmcLoading] = useState(false);
  const [amcError, setAmcError] = useState("");
  const [amcForm, setAmcForm] = useState({
    amount: "",
    startDate: "",
    endDate: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      const [customerRes, historyRes] = await Promise.all([
        api.get(`/api/customers/${id}`),
        api.get(`/api/services/customer/${id}`),
      ]);

      const customerData =
        customerRes?.data?.customer ||
        customerRes?.data ||
        customerRes?.customer ||
        null;

      if (!customerData) throw new Error("Customer data not found");

      setCustomer(customerData);

      const history = Array.isArray(historyRes.services)
        ? historyRes.services
        : [];
      history.sort((a, b) => new Date(b.date) - new Date(a.date));
      setServiceHistory(history);
    } catch (err) {
      setError(err?.message || "Failed to load customer");
    } finally {
      setLoading(false);
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // ── Helpers ────────────────────────────────────────────────────────────────

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

  const calculateAmcDaysLeft = (endDate, status) => {
    if (!endDate || status === "CANCELLED") return "-";
    const days = Math.ceil(
      (new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24),
    );
    return days < 0 ? "Expired" : `${days} days`;
  };

  // ── Derived values (computed after customer loads) ──────────────────────────

  const isRegular = customer?.customerType === "REGULAR";
  const isAmc = customer?.customerType === "AMC";
  const isServiceOnly = customer?.customerType === "SERVICE_ONLY";

  const isPaid =
    isRegular && customer?.payment?.status?.toLowerCase() === "paid";

  const amcStatus = customer?.amcContract?.status || "NOT STARTED";
  const amcDaysLeft = calculateAmcDaysLeft(
    customer?.amcContract?.endDate,
    amcStatus,
  );
  const lastAmcPayment = {
    amount: customer?.amcContract?.lastPaymentAmount ?? null,
    date: customer?.amcContract?.lastPaymentDate ?? null,
  };

  // ── Service modal ──────────────────────────────────────────────────────────

  const openServiceModal = async (serviceId) => {
    try {
      setModalLoading(true);
      const res = await api.get(`/api/services/${serviceId}`);
      setSelectedService(res.service);
    } catch {
      alert("Failed to load service details");
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => setSelectedService(null);

  const handleDeleteService = async () => {
    if (!selectedService?.id || serviceDeleteLoading) return;
    if (!window.confirm("Delete this service record? This cannot be undone."))
      return;

    try {
      setServiceDeleteLoading(true);
      await api.delete(`/api/services/${selectedService.id}`);
      setSelectedService(null);
      setHistoryLoading(true);
      await loadData();
    } catch (err) {
      alert(err?.message || "Failed to delete service");
    } finally {
      setServiceDeleteLoading(false);
    }
  };

  // ── Customer delete modal ──────────────────────────────────────────────────

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setShowDeleteModal(false);
    setDeleteError("");
    setDeleteMode("soft");
  };

  const handleDeleteCustomer = async () => {
    try {
      setDeleteLoading(true);
      setDeleteError("");
      await api.delete(`/api/customers/${id}?mode=${deleteMode}`);
      navigate("/customers");
    } catch (err) {
      setDeleteError(err?.message || "Failed to delete customer");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── AMC modal ──────────────────────────────────────────────────────────────

  const openAmcModal = () => {
    setAmcError("");
    setAmcForm({
      amount: "",
      startDate: customer?.amcContract?.startDate?.slice(0, 10) || "",
      endDate: customer?.amcContract?.endDate?.slice(0, 10) || "",
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: customer?.amcContract?.notes || "",
    });
    setShowAmcModal(true);
  };

  const closeAmcModal = () => {
    if (amcLoading) return;
    setShowAmcModal(false);
    setAmcError("");
  };

  const handleAmcPayment = async () => {
    setAmcError("");
    if (!amcForm.amount || Number(amcForm.amount) <= 0) {
      setAmcError("Please enter a valid amount.");
      return;
    }
    if (!amcForm.startDate || !amcForm.endDate) {
      setAmcError("Start date and end date are required.");
      return;
    }

    try {
      setAmcLoading(true);
      await api.post(`/api/customers/${id}/amc-payment`, {
        amount: Number(amcForm.amount),
        startDate: amcForm.startDate,
        endDate: amcForm.endDate,
        paymentDate: amcForm.paymentDate,
        notes: amcForm.notes,
      });
      setShowAmcModal(false);
      await loadData();
    } catch (err) {
      setAmcError(err?.message || "Failed to record AMC payment.");
    } finally {
      setAmcLoading(false);
    }
  };

  const handleStopAmc = async () => {
    if (
      !window.confirm(
        "Stop AMC for this customer? Their type will be set back to Regular.",
      )
    )
      return;

    try {
      setAmcLoading(true);
      await api.patch(`/api/customers/${id}`, {
        customerType: "REGULAR",
        amcContract: null,
      });
      await loadData();
    } catch (err) {
      alert(err?.message || "Failed to stop AMC.");
    } finally {
      setAmcLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  if (!customer) return <div>Customer not found</div>;

  return (
    <div className="detail-wrapper">
      <div className="detail-container">
        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <header className="detail-header">
          <div>
            <h1>{renderSafeValue(customer.name)}</h1>
            <p>📞 {renderSafeValue(customer.phone)}</p>

            {/* Customer type badge */}
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

            {/* Installation date — REGULAR only */}
            {isRegular && customer.installationDate && (
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

        {/* ── ACTION BUTTONS ─────────────────────────────────────────────── */}
        <div className="action-panel">
          <button
            onClick={() => navigate(`/customers/${id}/edit`)}
            className="btn btn-primary"
          >
            Edit Profile
          </button>

          {/* Update Payment — REGULAR only (they paid for a machine) */}
          {isRegular && (
            <button
              onClick={() => !isPaid && navigate(`/customers/${id}/payment`)}
              className={`btn btn-outline ${isPaid ? "btn-disabled" : ""}`}
              disabled={isPaid}
            >
              {isPaid ? "Payment ✔" : "Update Payment"}
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

        {/* Payment completed banner — REGULAR only */}
        {isPaid && <div className="paid-banner">Payment completed.</div>}

        {/* ── INFO GRID ──────────────────────────────────────────────────── */}
        <div className="info-grid">
          {/* Machine / Installation Details */}
          <div className="detail-card">
            <div className="section-title">
              {isRegular ? "Installation Details" : "Machine Details"}
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

            {/* Installation date row — REGULAR only */}
            {isRegular && (
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
                {renderSafeValue(customer.location)}
              </span>
            </div>
          </div>

          {/* Service Health */}
          <div className="detail-card">
            <div className="section-title">Service Health</div>

            {/* Payment status row — REGULAR only */}
            {isRegular && (
              <div className="info-row">
                <span className="info-label">Payment Status</span>
                <span className={getBadgeClass(customer.payment?.status)}>
                  {getEnumLabel("paymentStatus", customer.payment?.status)}
                </span>
              </div>
            )}

            {/* AMC status row — AMC customers */}
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

        {/* ── FINANCIAL SUMMARY — REGULAR only ───────────────────────────── */}
        {isRegular && (
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

        {/* ── AMC DETAILS — REGULAR and AMC only (not SERVICE_ONLY) ──────── */}
        {!isServiceOnly && (
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
              <span className="info-label">Last AMC Payment</span>
              <span className="info-value">
                {lastAmcPayment.amount ? `₹${lastAmcPayment.amount}` : "-"} /{" "}
                {formatDate(lastAmcPayment.date)}
              </span>
            </div>

            <div className="amc-action-panel">
              <button className="btn btn-primary" onClick={openAmcModal}>
                {amcStatus === "NOT STARTED" ? "Start AMC" : "Renew AMC"}
              </button>

              <button className="btn btn-outline" onClick={openAmcModal}>
                Record AMC Payment
              </button>

              <button
                className="btn btn-outline"
                onClick={handleStopAmc}
                disabled={amcStatus === "NOT STARTED" || amcLoading}
              >
                Stop AMC
              </button>
            </div>
          </div>
        )}

        {/* ── SERVICE HISTORY — all types ────────────────────────────────── */}
        <div className="detail-card">
          <div className="section-title">Service History</div>

          {historyLoading ? (
            <div className="history-empty">Loading...</div>
          ) : serviceHistory.length === 0 ? (
            <div className="history-empty">No service history yet.</div>
          ) : (
            <div className="history-scroll">
              {serviceHistory.map((service) => (
                <div
                  key={service.id}
                  className="history-item"
                  onClick={() => openServiceModal(service.id)}
                >
                  <div>
                    <div className="history-type">
                      {getEnumLabel("serviceType", service.type)}
                    </div>
                    <div className="history-date">
                      {formatDate(service.date)}
                    </div>
                  </div>
                  <div className="history-amount">₹{service.amount}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── SERVICE DETAIL MODAL ─────────────────────────────────────────── */}
      {selectedService && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            {modalLoading ? (
              <div>Loading...</div>
            ) : (
              <>
                <div className="modal-header">
                  <h3>Service Details</h3>
                  <div className="modal-header-actions">
                    <button
                      className="btn btn-danger"
                      onClick={handleDeleteService}
                      disabled={serviceDeleteLoading}
                    >
                      {serviceDeleteLoading ? "Deleting..." : "Delete"}
                    </button>
                    <button className="close-btn" onClick={closeModal}>
                      ×
                    </button>
                  </div>
                </div>

                <div className="modal-body">
                  <p>
                    <strong>Date:</strong>{" "}
                    {formatDate(selectedService.serviceDate)}
                  </p>
                  <p>
                    <strong>Type:</strong>{" "}
                    {getEnumLabel("serviceType", selectedService.serviceType)}
                  </p>
                  <p>
                    <strong>Service Charge:</strong> ₹
                    {selectedService.serviceCharge}
                  </p>

                  <div>
                    <strong>Replaced Parts:</strong>
                    {!selectedService.replacedParts?.length ? (
                      <p>No parts replaced</p>
                    ) : (
                      selectedService.replacedParts.map((p, i) => (
                        <p key={i}>
                          {p.partName} – ₹{p.price}
                        </p>
                      ))
                    )}
                  </div>

                  <div className="modal-total">
                    Total: ₹{selectedService.totalServiceAmount}
                  </div>
                </div>
              </>
            )}
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

      {/* ── AMC PAYMENT MODAL ────────────────────────────────────────────── */}
      {showAmcModal && (
        <div className="modal-overlay" onClick={closeAmcModal}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {amcStatus === "NOT STARTED"
                  ? "Start AMC"
                  : "Renew / Record AMC Payment"}
              </h3>
              <button className="close-btn" onClick={closeAmcModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              {amcError && (
                <div className="delete-error" style={{ marginBottom: 12 }}>
                  {amcError}
                </div>
              )}

              {[
                {
                  label: "Amount Paid (₹)",
                  key: "amount",
                  type: "number",
                  placeholder: "e.g. 2000",
                },
                { label: "AMC Start Date", key: "startDate", type: "date" },
                { label: "AMC End Date", key: "endDate", type: "date" },
                { label: "Payment Date", key: "paymentDate", type: "date" },
                {
                  label: "Notes (optional)",
                  key: "notes",
                  type: "text",
                  placeholder: "Any notes",
                },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 4,
                      fontWeight: 500,
                    }}
                  >
                    {label}
                  </label>
                  <input
                    type={type}
                    min={type === "number" ? "1" : undefined}
                    value={amcForm[key]}
                    placeholder={placeholder}
                    onChange={(e) =>
                      setAmcForm((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid #ccc",
                    }}
                  />
                </div>
              ))}

              <div className="delete-actions">
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
        </div>
      )}
    </div>
  );
};

export default CustomerDetail;
