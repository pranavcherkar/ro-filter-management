import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/apiClient";
import Loading from "../../components/Loading";
import ErrorState from "../../components/ErrorState";
import "../../styles/cusDetails.css";

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadCustomer = async () => {
      try {
        const res = await api.get(`/api/customers/${id}`);

        const customerData =
          res?.data?.customer || res?.data || res?.customer || null;

        if (!customerData) {
          throw new Error("Customer data not found");
        }

        setCustomer(customerData);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to load customer",
        );
      } finally {
        setLoading(false);
      }
    };

    loadCustomer();
  }, [id]);

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

  const isPaid =
    customer?.payment?.status &&
    customer.payment.status.toLowerCase() === "paid";

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  if (!customer) {
    return (
      <div className="detail-wrapper" style={{ textAlign: "center" }}>
        Customer not found
      </div>
    );
  }

  return (
    <div className="detail-wrapper">
      <div className="detail-container">
        {/* Header */}
        <header className="detail-header">
          <div>
            <h1>{renderSafeValue(customer.name)}</h1>
            <p>📞 {renderSafeValue(customer.phone)}</p>
          </div>

          <div className="header-due">
            <div style={{ fontSize: "11px", opacity: 0.8, fontWeight: "700" }}>
              NEXT SERVICE DUE
            </div>
            <div style={{ fontSize: "22px", fontWeight: "800" }}>
              {renderSafeValue(customer.service?.nextServiceDate) || "TBD"}
            </div>
          </div>
        </header>

        {/* Action panel */}
        <div className="action-panel">
          <button
            onClick={() => navigate(`/customers/${id}/edit`)}
            className="btn btn-primary"
          >
            Edit Profile
          </button>

          <button
            onClick={() => !isPaid && navigate(`/customers/${id}/payment`)}
            className="btn btn-outline"
            disabled={isPaid}
            style={{
              opacity: isPaid ? 0.6 : 1,
              cursor: isPaid ? "not-allowed" : "pointer",
            }}
          >
            Update Payment
          </button>

          <button
            onClick={() => navigate(`/customers/${id}/services/new`)}
            className="btn btn-outline"
          >
            + Add Service
          </button>
        </div>

        {/* Paid message */}
        {isPaid && (
          <div
            style={{
              marginTop: "10px",
              background: "#ecfdf5",
              color: "#065f46",
              padding: "10px",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            ✅ Payment completed. Further payment updates are disabled.
          </div>
        )}

        {/* Info grid */}
        <div className="info-grid">
          {/* Installation */}
          <div className="detail-card">
            <div className="section-title">📍 Installation Details</div>

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
              <span className="info-label">Location</span>
              <span className="info-value">
                {renderSafeValue(customer.location)}
              </span>
            </div>
          </div>

          {/* Service Health */}
          <div className="detail-card">
            <div className="section-title">🛠 Service Health</div>

            <div className="info-row">
              <span className="info-label">Status</span>
              <span className={getBadgeClass(customer.payment?.status)}>
                {renderSafeValue(customer.payment?.status)}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">Last Service</span>
              <span className="info-value">
                {renderSafeValue(customer.service?.lastServiceDate)}
              </span>
            </div>
          </div>
        </div>

        {/* Financial summary */}
        <div className="detail-card financial-card">
          <div className="section-title">💰 Financial Summary</div>

          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            <div>
              <div className="info-label">Filter Price</div>
              <div className="info-value" style={{ fontSize: "22px" }}>
                ₹{renderSafeValue(customer.payment?.filterPrice)}
              </div>
            </div>

            <div>
              <div className="info-label">Total Paid</div>
              <div className="info-value" style={{ fontSize: "22px" }}>
                ₹{renderSafeValue(customer.payment?.paidAmount)}
              </div>
            </div>

            <div>
              <div className="info-label">Balance Due</div>
              <div className="info-value" style={{ fontSize: "22px" }}>
                ₹{renderSafeValue(customer.payment?.pendingAmount)}
              </div>
            </div>
          </div>
        </div>

        {/* Service history */}
        <div className="detail-card">
          <div className="section-title">📜 Service History</div>

          {!customer.servicehistory?.length ? (
            <div
              style={{
                textAlign: "center",
                padding: "30px",
                color: "#94a3b8",
              }}
            >
              No service history available.
            </div>
          ) : (
            customer.servicehistory.map((service, index) => (
              <div key={index} className="history-item">
                <div>
                  <div style={{ fontWeight: "700" }}>
                    {renderSafeValue(service.type)}
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748b" }}>
                    {renderSafeValue(service.date)}
                  </div>
                </div>
                <div className="info-value">
                  ₹{renderSafeValue(service.amount)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerDetail;
