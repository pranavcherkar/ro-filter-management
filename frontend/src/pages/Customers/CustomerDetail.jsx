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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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

        if (!customerData) {
          throw new Error("Customer data not found");
        }

        setCustomer(customerData);

        const history = Array.isArray(historyRes.services)
          ? historyRes.services
          : [];

        history.sort((a, b) => new Date(b.date) - new Date(a.date));
        setServiceHistory(history);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to load customer",
        );
      } finally {
        setLoading(false);
        setHistoryLoading(false);
      }
    };

    loadData();
  }, [id]);

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

  const isPaid =
    customer?.payment?.status &&
    customer.payment.status.toLowerCase() === "paid";

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

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  if (!customer) return <div>Customer not found</div>;

  return (
    <div className="detail-wrapper">
      <div className="detail-container">
        {/* HEADER */}
        <header className="detail-header">
          <div>
            <h1>{renderSafeValue(customer.name)}</h1>
            <p>📞 {renderSafeValue(customer.phone)}</p>
            <div className="install-date">
              Installed on: {formatDate(customer.installationDate)}
            </div>
          </div>

          <div className="header-due">
            <div className="due-label">NEXT SERVICE DUE</div>
            <div className="due-date">
              {formatDate(customer.service?.nextServiceDate)}
            </div>
          </div>
        </header>

        {/* ACTION BUTTONS */}
        <div className="action-panel">
          <button
            onClick={() => navigate(`/customers/${id}/edit`)}
            className="btn btn-primary"
          >
            Edit Profile
          </button>

          <button
            onClick={() => !isPaid && navigate(`/customers/${id}/payment`)}
            className={`btn btn-outline ${isPaid ? "btn-disabled" : ""}`}
            disabled={isPaid}
          >
            {isPaid ? "Payment ✔" : "Update Payment"}
          </button>

          <button
            onClick={() => navigate(`/customers/${id}/services/new`)}
            className="btn btn-outline"
          >
            + Add Service
          </button>
        </div>

        {/* PAYMENT MESSAGE */}
        {isPaid && <div className="paid-banner">Payment completed.</div>}

        {/* INFO GRID */}
        <div className="info-grid">
          {/* INSTALLATION DETAILS */}
          <div className="detail-card">
            <div className="section-title">Installation Details</div>

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

          {/* SERVICE HEALTH */}
          <div className="detail-card">
            <div className="section-title">Service Health</div>

            <div className="info-row">
              <span className="info-label">Status</span>
              <span className={getBadgeClass(customer.payment?.status)}>
                {getEnumLabel("paymentStatus", customer.payment?.status)}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">Last Service</span>
              <span className="info-value">
                {formatDate(customer.service?.lastServiceDate)}
              </span>
            </div>
          </div>
        </div>

        {/* FINANCIAL SUMMARY */}
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

        {/* SERVICE HISTORY */}
        <div className="detail-card">
          <div className="section-title">Service History</div>

          {historyLoading ? (
            <div className="history-empty">Loading...</div>
          ) : serviceHistory.length === 0 ? (
            <div className="history-empty">No service history available.</div>
          ) : (
            <div className="history-scroll">
              {serviceHistory.map((service) => (
                <div
                  key={service.id}
                  className="history-item"
                  onClick={() => openServiceModal(service.id)}
                >
                  <div>
                    <div className="history-type">{getEnumLabel("serviceType", service.type)}</div>
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

      {/* MODAL */}
      {selectedService && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            {modalLoading ? (
              <div>Loading...</div>
            ) : (
              <>
                <div className="modal-header">
                  <h3>Service Details</h3>
                  <button className="close-btn" onClick={closeModal}>
                    ×
                  </button>
                </div>

                <div className="modal-body">
                  <p>
                    <strong>Date:</strong>{" "}
                    {formatDate(selectedService.serviceDate)}
                  </p>
                  <p>
                    <strong>Type:</strong> {getEnumLabel("serviceType", selectedService.serviceType)}
                  </p>
                  <p>
                    <strong>Service Charge:</strong> ₹
                    {selectedService.serviceCharge}
                  </p>

                  <div>
                    <strong>Replaced Parts:</strong>
                    {selectedService.replacedParts?.length === 0 ? (
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
    </div>
  );
};

export default CustomerDetail;
