import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/apiClient";
import Loading from "../../components/Loading";
import ErrorState from "../../components/ErrorState";
import "../../styles/customers.css";
import { getEnumLabel } from "../../utils/enumLabels";

const CustomersList = () => {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [archivingId, setArchivingId] = useState("");

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError("");

      const params = {
        status: statusFilter,
      };

      if (typeFilter !== "ALL") {
        params.customerType = typeFilter;
      }

      const res = await api.get("/api/customers", { params });
      setCustomers(Array.isArray(res.customers) ? res.customers : []);
    } catch (err) {
      setError(err?.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [statusFilter, typeFilter]);

  const filteredCustomers = useMemo(
    () =>
      customers.filter(
        (c) =>
          c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.phone?.includes(searchTerm),
      ),
    [customers, searchTerm],
  );

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

  const getCustomerTypeStyle = (type) => {
    if (type === "AMC") {
      return { bg: "#e0e7ff", text: "#3730a3" };
    }

    return { bg: "#e2e8f0", text: "#334155" };
  };

  const archiveCustomer = async (e, customer) => {
    e.stopPropagation();

    if (!customer?.id || archivingId) return;

    const confirmed = window.confirm(
      `Archive ${customer.name}? Customer will be marked inactive.`,
    );

    if (!confirmed) return;

    try {
      setArchivingId(customer.id);
      await api.delete(`/api/customers/${customer.id}`, {
        data: { mode: "soft" },
      });

      await loadCustomers();
    } catch (err) {
      window.alert(err?.message || "Failed to archive customer");
    } finally {
      setArchivingId("");
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="customers-container">
      <div className="customers-header">
        <h2>Customer Directory</h2>
        <p>Showing {filteredCustomers.length} customer records</p>
      </div>

      <div className="search-section">
        <input
          className="search-input"
          placeholder="Search by name or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <button className="add-button" onClick={() => navigate("/customers/new")}>
          + Add New
        </button>
      </div>

      <div className="filter-row">
        <div className="toggle-group">
          <button
            className={statusFilter === "active" ? "toggle-btn active" : "toggle-btn"}
            onClick={() => setStatusFilter("active")}
          >
            Active
          </button>
          <button
            className={statusFilter === "all" ? "toggle-btn active" : "toggle-btn"}
            onClick={() => setStatusFilter("all")}
          >
            All
          </button>
          <button
            className={statusFilter === "inactive" ? "toggle-btn active" : "toggle-btn"}
            onClick={() => setStatusFilter("inactive")}
          >
            Inactive
          </button>
        </div>

        <div className="toggle-group">
          <button
            className={typeFilter === "ALL" ? "toggle-btn active" : "toggle-btn"}
            onClick={() => setTypeFilter("ALL")}
          >
            All Types
          </button>
          <button
            className={typeFilter === "REGULAR" ? "toggle-btn active" : "toggle-btn"}
            onClick={() => setTypeFilter("REGULAR")}
          >
            Regular
          </button>
          <button
            className={typeFilter === "AMC" ? "toggle-btn active" : "toggle-btn"}
            onClick={() => setTypeFilter("AMC")}
          >
            AMC
          </button>
        </div>
      </div>

      <div className="customer-grid">
        {filteredCustomers.length === 0 ? (
          <p className="no-results">No customers found matching your filters.</p>
        ) : (
          filteredCustomers.map((customer) => {
            const paymentStyle = getStatusStyle(customer.filterPaymentStatus);
            const serviceStyle = getStatusStyle(customer.serviceStatus);
            const typeStyle = getCustomerTypeStyle(customer.customerType);

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
                      {customer.filterPaymentStatus
                        ? getEnumLabel("paymentStatus", customer.filterPaymentStatus)
                        : "N/A"}
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
                      {customer.serviceStatus
                        ? getEnumLabel("serviceStatus", customer.serviceStatus)
                        : "N/A"}
                    </span>
                  </div>

                  <div className="badge-group">
                    <span className="badge-label">Customer Type</span>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: typeStyle.bg,
                        color: typeStyle.text,
                      }}
                    >
                      {getEnumLabel("customerType", customer.customerType || "REGULAR")}
                    </span>
                  </div>
                </div>

                <div className="customer-actions">
                  <button
                    className="view-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/customers/${customer.id}`);
                    }}
                  >
                    View Details
                  </button>

                  <button
                    className="archive-button"
                    onClick={(e) => archiveCustomer(e, customer)}
                    disabled={archivingId === customer.id || !customer.isActive}
                  >
                    {archivingId === customer.id
                      ? "Archiving..."
                      : customer.isActive
                        ? "Archive"
                        : "Archived"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CustomersList;
