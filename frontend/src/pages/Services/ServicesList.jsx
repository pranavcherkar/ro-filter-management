import { useEffect, useState } from "react";
import api from "../../api/apiClient";
import Loading from "../../components/Loading";
import ErrorState from "../../components/ErrorState";
import "../../styles/servList.css";

const ServicesList = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [serviceType, setServiceType] = useState("");

  const [selectedService, setSelectedService] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const limit = 10;

  const loadServices = async (page = 1) => {
    setLoading(true);
    setError("");

    try {
      const params = {
        page,
        limit,
      };

      if (customerName) params.customerName = customerName;
      if (month) params.month = month;
      if (year) params.year = year;
      if (serviceType) params.serviceType = serviceType;

      const res = await api.get("/api/services", { params });

      setServices(Array.isArray(res.services) ? res.services : []);
      setCurrentPage(res.currentPage || 1);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      setError(err.message || "Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    setCurrentPage(1);
    loadServices(1);
  };

  const openServiceModal = async (id) => {
    try {
      setModalLoading(true);
      const res = await api.get(`/api/services/${id}`);
      setSelectedService(res.service);
    } catch (err) {
      alert("Failed to load service details");
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedService(null);
  };

  useEffect(() => {
    loadServices(1);
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="services-wrapper">
      <h2 className="services-title">All Services</h2>

      <div className="filter-container">
        <input
          placeholder="Search Customer Name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
        />

        <input
          type="number"
          placeholder="Month (1-12)"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />

        <input
          type="number"
          placeholder="Year (e.g. 2025)"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />

        <select
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value)}
        >
          <option value="">All Types</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="EARLY">Early</option>
          <option value="EMERGENCY">Emergency</option>
        </select>

        <button className="filter-btn" onClick={applyFilters}>
          Apply Filters
        </button>
      </div>

      {services.length === 0 ? (
        <div className="no-results">
          No services found for the selected filters.
        </div>
      ) : (
        <>
          {services.map((service) => (
            <div
              key={service.id}
              className="service-card"
              onClick={() => openServiceModal(service.id)}
            >
              <div>
                <strong>Service Date</strong>
                <p>
                  {new Date(service.serviceDate).toLocaleDateString("en-IN", {
                    dateStyle: "long",
                  })}
                </p>
              </div>

              <div>
                <strong>Customer</strong>
                <p>{service.customer?.name}</p>
                <p className="sub-text">{service.customer?.phone}</p>
              </div>

              <div>
                <strong>Service Type</strong>
                <span className="service-type-badge">
                  {service.serviceType}
                </span>
              </div>

              <div>
                <strong>Total Amount</strong>
                <p className="amount-text">₹{service.totalServiceAmount}</p>
              </div>
            </div>
          ))}

          <div className="pagination">
            <button
              disabled={currentPage === 1}
              onClick={() => loadServices(currentPage - 1)}
            >
              Prev
            </button>

            {[...Array(totalPages)].map((_, index) => {
              const pageNumber = index + 1;
              return (
                <button
                  key={pageNumber}
                  className={currentPage === pageNumber ? "active-page" : ""}
                  onClick={() => loadServices(pageNumber)}
                >
                  {pageNumber}
                </button>
              );
            })}

            <button
              disabled={currentPage === totalPages}
              onClick={() => loadServices(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}

      {selectedService && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            {modalLoading ? (
              <div className="modal-loading">Loading...</div>
            ) : (
              <>
                <div className="modal-header">
                  <h3>Service Details</h3>
                  <button className="close-btn" onClick={closeModal}>
                    ×
                  </button>
                </div>

                <div className="modal-body">
                  <div className="modal-section">
                    <strong>Date</strong>
                    <p>
                      {new Date(selectedService.serviceDate).toLocaleDateString(
                        "en-IN",
                        {
                          dateStyle: "long",
                        },
                      )}
                    </p>
                  </div>

                  <div className="modal-section">
                    <strong>Customer</strong>
                    <p>{selectedService.customer?.name}</p>
                    <p className="sub-text">
                      {selectedService.customer?.phone}
                    </p>
                  </div>

                  <div className="modal-section">
                    <strong>Service Type</strong>
                    <p>{selectedService.serviceType}</p>
                  </div>

                  <div className="modal-section">
                    <strong>Service Charge</strong>
                    <p>₹{selectedService.serviceCharge}</p>
                  </div>

                  <div className="modal-section">
                    <strong>Replaced Parts</strong>
                    {selectedService.replacedParts?.length === 0 ? (
                      <p>No parts replaced</p>
                    ) : (
                      selectedService.replacedParts.map((part, index) => (
                        <p key={index}>
                          {part.partName} : ₹{part.price}
                        </p>
                      ))
                    )}
                  </div>

                  <div className="modal-section total-highlight">
                    <strong>Total Amount</strong>
                    <p>₹{selectedService.totalServiceAmount}</p>
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

export default ServicesList;
