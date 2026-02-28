import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/apiClient";
import Loading from "../../components/Loading";
import ErrorState from "../../components/ErrorState";
import "../../styles/customers.css";

const CustomersList = () => {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const res = await api.get("/api/customers");
        setCustomers(Array.isArray(res.customers) ? res.customers : []);
      } catch (err) {
        setError(err?.message || "Failed to load customers");
      } finally {
        setLoading(false);
      }
    };

    loadCustomers();
  }, []);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.includes(searchTerm)
  );

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  const getStatusStyle = (status) => {
    const s = status?.toLowerCase();

    if (s === "paid" || s === "completed" || s === "active") {
      return { bg: "#dcfce7", text: "#166534" };
    }

    if (s === "pending" || s === "due") {
      return { bg: "#fee2e2", text: "#991b1b" };
    }

    return { bg: "#fef3c7", text: "#92400e" };
  };

  return (
    <div className="customers-container">
      <div className="customers-header">
        <h2>Customer Directory</h2>
        <p>Showing {filteredCustomers.length} active installation records</p>
      </div>

      <div className="search-section">
        <input
          className="search-input"
          placeholder="Search by name or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <button
          className="add-button"
          onClick={() => navigate("/customers/new")}
        >
          + Add New
        </button>
      </div>

      <div className="customer-grid">
        {filteredCustomers.length === 0 ? (
          <p className="no-results">No customers found matching your search.</p>
        ) : (
          filteredCustomers.map((customer) => {
            const paymentStyle = getStatusStyle(customer.filterPaymentStatus);
            const serviceStyle = getStatusStyle(customer.serviceStatus);

            return (
              <div
                key={customer.id}
                className="customer-card"
                onClick={() => navigate(`/customers/${customer.id}`)}
              >
                <div className="customer-top">
                  <span className="customer-name">{customer.name}</span>
                  <span className="customer-phone">📞 {customer.phone}</span>
                </div>

                <div className="badge-container">
                  <div className="badge-group">
                    <span className="badge-label">Payment</span>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: paymentStyle.bg,
                        color: paymentStyle.text,
                      }}
                    >
                      {customer.filterPaymentStatus || "N/A"}
                    </span>
                  </div>

                  <div className="badge-group">
                    <span className="badge-label">Service</span>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: serviceStyle.bg,
                        color: serviceStyle.text,
                      }}
                    >
                      {customer.serviceStatus || "N/A"}
                    </span>
                  </div>
                </div>

                <button
                  className="view-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/customers/${customer.id}`);
                  }}
                >
                  View Details
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CustomersList;
