import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/apiClient";
import Loading from "../../components/Loading";
import ErrorState from "../../components/ErrorState";

const CustomersList = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoveredId, setHoveredId] = useState(null);

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth < 768;

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const res = await api.get("/api/customers");
        if (Array.isArray(res.customers)) {
          setCustomers(res.customers);
        } else {
          setCustomers([]);
        }
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
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm),
  );

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  const getStatusStyle = (status) => {
    const s = status?.toLowerCase();
    if (s === "paid" || s === "completed" || s === "active")
      return { bg: "#dcfce7", text: "#166534" };
    if (s === "pending" || s === "due")
      return { bg: "#fee2e2", text: "#991b1b" };
    return { bg: "#fef3c7", text: "#92400e" };
  };

  const styles = {
    container: {
      backgroundColor: "#f0f9ff",
      minHeight: "100vh",
      padding: isMobile ? "20px 15px" : "40px 20px",
      fontFamily: "'Segoe UI', Roboto, sans-serif",
    },
    headerCard: {
      background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
      borderRadius: "16px",
      padding: isMobile ? "25px" : "40px",
      color: "white",
      marginBottom: "30px",
      boxShadow: "0 10px 20px rgba(30, 64, 175, 0.15)",
      maxWidth: "1000px",
      marginLeft: "auto",
      marginRight: "auto",
    },
    searchSection: {
      maxWidth: "1000px",
      margin: "0 auto 30px auto",
      display: "flex",
      gap: "10px",
      flexDirection: isMobile ? "column" : "row",
    },
    searchInput: {
      flex: 1,
      padding: "14px 20px",
      borderRadius: "12px",
      border: "2px solid #e0f2fe",
      fontSize: "16px",
      outline: "none",
      boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
    },
    addButton: {
      padding: "14px 24px",
      borderRadius: "12px",
      border: "none",
      background: "#1e40af",
      color: "white",
      fontWeight: "bold",
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
    listGrid: {
      display: "grid",
      gridTemplateColumns: isMobile
        ? "1fr"
        : "repeat(auto-fill, minmax(300px, 1fr))",
      gap: "20px",
      maxWidth: "1000px",
      margin: "0 auto",
    },
    customerCard: (id) => ({
      backgroundColor: "white",
      borderRadius: "12px",
      padding: "20px",
      cursor: "pointer",
      border: "1px solid #e0f2fe",
      transition: "all 0.2s ease",
      transform: hoveredId === id ? "translateY(-5px)" : "none",
      boxShadow:
        hoveredId === id
          ? "0 10px 20px rgba(30, 64, 175, 0.1)"
          : "0 4px 6px rgba(0,0,0,0.02)",
    }),
    name: {
      fontSize: "18px",
      fontWeight: "700",
      color: "#1e3a8a",
      marginBottom: "4px",
    },
    phone: {
      color: "#64748b",
      fontSize: "14px",
      marginBottom: "15px",
      display: "block",
    },
    badgeContainer: {
      display: "flex",
      gap: "8px",
      marginTop: "12px",
      borderTop: "1px solid #f1f5f9",
      paddingTop: "12px",
    },
    badge: (status) => ({
      padding: "4px 10px",
      borderRadius: "20px",
      fontSize: "11px",
      fontWeight: "bold",
      textTransform: "uppercase",
      backgroundColor: getStatusStyle(status).bg,
      color: getStatusStyle(status).text,
    }),
    viewButton: {
      marginTop: "12px",
      padding: "8px 12px",
      borderRadius: "8px",
      border: "none",
      background: "#3b82f6",
      color: "white",
      fontSize: "13px",
      cursor: "pointer",
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerCard}>
        <h2 style={{ margin: 0, fontSize: isMobile ? "24px" : "32px" }}>
          Customer Directory
        </h2>
        <p style={{ margin: "10px 0 0 0", opacity: 0.9 }}>
          Showing {filteredCustomers.length} active installation records
        </p>
      </div>

      <div style={styles.searchSection}>
        <input
          style={styles.searchInput}
          placeholder="Search by name or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button
          style={styles.addButton}
          onClick={() => navigate("/customers/new")}
        >
          + Add New
        </button>
      </div>

      <div style={styles.listGrid}>
        {filteredCustomers.length === 0 ? (
          <p
            style={{
              textAlign: "center",
              color: "#64748b",
              gridColumn: "1/-1",
            }}
          >
            No customers found matching your search.
          </p>
        ) : (
          filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              onMouseEnter={() => setHoveredId(customer.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={styles.customerCard(customer.id)}
            >
              <span style={styles.name}>{customer.name}</span>
              <span style={styles.phone}>📞 {customer.phone}</span>

              <div style={styles.badgeContainer}>
                <div>
                  <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                    PAYMENT
                  </div>
                  <div style={styles.badge(customer.filterPaymentStatus)}>
                    {customer.filterPaymentStatus || "N/A"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                    SERVICE
                  </div>
                  <div style={styles.badge(customer.serviceStatus)}>
                    {customer.serviceStatus || "N/A"}
                  </div>
                </div>
              </div>

              <button
                style={styles.viewButton}
                onClick={() => navigate(`/customers/${customer.id}`)}
              >
                View Details
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CustomersList;
