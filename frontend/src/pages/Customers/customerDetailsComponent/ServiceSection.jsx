import api from "../../../api/apiClient";
import { getEnumLabel } from "../../../utils/enumLabels";

// ── Helper ─────────────────────────────────────────────────────────────────
const formatDate = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// ── Component ──────────────────────────────────────────────────────────────
const ServiceSection = ({
  serviceHistory,
  historyLoading,
  selectedService,
  modalLoading,
  serviceDeleteLoading,
  openServiceModal,
  closeModal,
  handleDeleteService,
  loadData,
}) => {
  return (
    <>
      {/* ── SERVICE HISTORY CARD ─────────────────────────────────────────── */}
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
                  <div className="history-date">{formatDate(service.date)}</div>
                </div>
                <div className="history-amount">₹{service.amount}</div>
              </div>
            ))}
          </div>
        )}
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

                  {/* ── Inline payment recorder (only when not fully paid) ── */}
                  {selectedService?.chargePaymentStatus !== "PAID" && (
                    <div
                      style={{
                        marginTop: 16,
                        borderTop: "1px solid #e2e8f0",
                        paddingTop: 14,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          color: "#64748b",
                          marginBottom: 8,
                        }}
                      >
                        Payment:{" "}
                        <strong>
                          {selectedService?.chargePaymentStatus || "PAID"}
                        </strong>
                        {" · "}Paid: ₹{selectedService?.chargePaidAmount || 0}
                        {" · "}Remaining: ₹
                        {Math.max(
                          0,
                          (selectedService?.totalServiceAmount || 0) -
                            (selectedService?.chargePaidAmount || 0),
                        )}
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          type="number"
                          placeholder="Amount to record"
                          id="svc-pay-input"
                          style={{
                            flex: 1,
                            padding: "7px 10px",
                            borderRadius: 6,
                            border: "1px solid #ccc",
                          }}
                        />
                        <button
                          className="btn btn-primary"
                          style={{ whiteSpace: "nowrap" }}
                          onClick={async () => {
                            const val = Number(
                              document.getElementById("svc-pay-input").value,
                            );
                            if (!val || val <= 0) return;
                            try {
                              await api.patch(
                                `/api/services/${selectedService.id}/payment`,
                                { additionalPaidAmount: val },
                              );
                              closeModal();
                              await loadData();
                            } catch (err) {
                              alert(err?.message || "Failed to update payment");
                            }
                          }}
                        >
                          Record
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ServiceSection;
