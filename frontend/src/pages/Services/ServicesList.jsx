import { useEffect, useState } from "react";
import api from "../../api/apiClient";
import Loading from "../../components/Loading";
import ErrorState from "../../components/ErrorState";
import "../../styles/servList.css"; // Import the CSS

const ServicesList = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [customerId, setCustomerId] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [serviceType, setServiceType] = useState("");

  const loadServices = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (customerId) params.customerId = customerId;
      if (month) params.month = month;
      if (year) params.year = year;
      if (serviceType) params.serviceType = serviceType;

      const res = await api.get("/api/services", { params });
      setServices(Array.isArray(res.services) ? res.services : []);
    } catch (err) {
      setError(err.message || "Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="services-wrapper">
      <h2 className="services-title">All Services</h2>

      {/* Filters Section */}
      <div className="filter-container">
        <div className="filter-group">
          <input
            placeholder="Customer ID"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <input
            type="number"
            placeholder="Month (1-12)"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <input
            type="number"
            placeholder="Year (e.g. 2025)"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="EARLY">Early</option>
            <option value="EMERGENCY">Emergency</option>
          </select>
        </div>
        <button className="filter-btn" onClick={loadServices}>
          Apply Filters
        </button>
      </div>

      {/* List Section */}
      {services.length === 0 ? (
        <div className="no-results">
          No services found for the selected filters.
        </div>
      ) : (
        services.map((service) => (
          <div key={service.id} className="service-card">
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
              <p style={{ fontSize: "12px", opacity: 0.7 }}>
                {service.customer?.phone}
              </p>
            </div>

            <div>
              <strong>Service Type</strong>
              <span className="service-type-badge">{service.serviceType}</span>
            </div>

            <div>
              <strong>Total Amount</strong>
              <p className="amount-text">₹{service.totalServiceAmount}</p>
              <p style={{ fontSize: "11px" }}>
                Charge: ₹{service.serviceCharge}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ServicesList;
