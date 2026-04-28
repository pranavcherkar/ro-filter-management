import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/apiClient";
import Loading from "../../components/Loading";
import ErrorState from "../../components/ErrorState";
import "../../styles/customers.css";
import { getEnumLabel } from "../../utils/enumLabels";

const PAGE_SIZE = 20;

const CustomersList = () => {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState(""); // controlled input, debounced to searchTerm
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [archivingId, setArchivingId] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Debounce search input → searchTerm (500ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1); // reset to page 1 on new search
    }, 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = {
        status: statusFilter,
        page: currentPage,
        limit: PAGE_SIZE,
      };

      if (typeFilter !== "ALL") params.customerType = typeFilter;
      if (searchTerm) params.search = searchTerm;

      const res = await api.get("/api/customers", { params });
      setCustomers(Array.isArray(res.customers) ? res.customers : []);
      setTotalPages(res.totalPages || 1);
      setTotalItems(res.totalItems || 0);
    } catch (err) {
      setError(err?.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, searchTerm, currentPage]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Reset to page 1 when filters change
  const handleStatusFilter = (val) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };
  const handleTypeFilter = (val) => {
    setTypeFilter(val);
    setCurrentPage(1);
  };

  const getStatusStyle = (status) => {
    const s = status?.toLowerCase();
    if (s === "paid" || s === "completed" || s === "active")
      return { bg: "#dcfce7", text: "#166534" };
    if (s === "pending" || s === "due")
      return { bg: "#fee2e2", text: "#991b1b" };
    return { bg: "#fef3c7", text: "#92400e" };
  };

  const getCustomerTypeStyle = (type) => {
    if (type === "AMC") return { bg: "#e0e7ff", text: "#3730a3" };
    if (type === "SERVICE_ONLY") return { bg: "#fef9c3", text: "#854d0e" };
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
      await api.delete(`/api/customers/${customer.id}?mode=soft`);
      await loadCustomers();
    } catch (err) {
      window.alert(err?.message || "Failed to archive customer");
    } finally {
      setArchivingId("");
    }
  };

  // Pagination helpers
  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;
  const pageNumbers = useMemo(() => {
    // Show at most 5 page numbers, centred around current page
    const pages = [];
    const delta = 2;
    const left = Math.max(1, currentPage - delta);
    const right = Math.min(totalPages, currentPage + delta);
    for (let i = left; i <= right; i++) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="customers-container">
      <div className="customers-header">
        <h2>Customer Directory</h2>
        <p>
          {totalItems} customer{totalItems !== 1 ? "s" : ""} total
          {totalPages > 1 && ` · page ${currentPage} of ${totalPages}`}
        </p>
      </div>

      <div className="search-section">
        <input
          className="search-input"
          placeholder="Search by name or phone..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button
          className="add-button"
          onClick={() => navigate("/customers/new")}
        >
          + Add New
        </button>
      </div>

      <div className="filter-row">
        <div className="toggle-group">
          <button
            className={
              statusFilter === "active" ? "toggle-btn active" : "toggle-btn"
            }
            onClick={() => handleStatusFilter("active")}
          >
            Active
          </button>
          <button
            className={
              statusFilter === "all" ? "toggle-btn active" : "toggle-btn"
            }
            onClick={() => handleStatusFilter("all")}
          >
            All
          </button>
          <button
            className={
              statusFilter === "inactive" ? "toggle-btn active" : "toggle-btn"
            }
            onClick={() => handleStatusFilter("inactive")}
          >
            Inactive
          </button>
        </div>

        <div className="toggle-group">
          <button
            className={
              typeFilter === "ALL" ? "toggle-btn active" : "toggle-btn"
            }
            onClick={() => handleTypeFilter("ALL")}
          >
            All Types
          </button>
          <button
            className={
              typeFilter === "REGULAR" ? "toggle-btn active" : "toggle-btn"
            }
            onClick={() => handleTypeFilter("REGULAR")}
          >
            Regular
          </button>
          <button
            className={
              typeFilter === "AMC" ? "toggle-btn active" : "toggle-btn"
            }
            onClick={() => handleTypeFilter("AMC")}
          >
            AMC
          </button>
          <button
            className={
              typeFilter === "SERVICE_ONLY" ? "toggle-btn active" : "toggle-btn"
            }
            onClick={() => handleTypeFilter("SERVICE_ONLY")}
          >
            Service Only
          </button>
        </div>
      </div>

      <div className="customer-grid">
        {customers.length === 0 ? (
          <p className="no-results">
            No customers found matching your filters.
          </p>
        ) : (
          customers.map((customer) => {
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
                        ? getEnumLabel(
                            "paymentStatus",
                            customer.filterPaymentStatus,
                          )
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
                    <span className="badge-label">Type</span>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: typeStyle.bg,
                        color: typeStyle.text,
                      }}
                    >
                      {getEnumLabel(
                        "customerType",
                        customer.customerType || "REGULAR",
                      )}
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

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="pagination-row">
          <button
            className="page-btn"
            onClick={() => setCurrentPage(1)}
            disabled={!canPrev}
          >
            «
          </button>
          <button
            className="page-btn"
            onClick={() => setCurrentPage((p) => p - 1)}
            disabled={!canPrev}
          >
            ‹
          </button>

          {pageNumbers[0] > 1 && (
            <>
              <button className="page-btn" onClick={() => setCurrentPage(1)}>
                1
              </button>
              {pageNumbers[0] > 2 && <span className="page-ellipsis">…</span>}
            </>
          )}

          {pageNumbers.map((n) => (
            <button
              key={n}
              className={
                n === currentPage ? "page-btn page-btn-active" : "page-btn"
              }
              onClick={() => setCurrentPage(n)}
            >
              {n}
            </button>
          ))}

          {pageNumbers[pageNumbers.length - 1] < totalPages && (
            <>
              {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                <span className="page-ellipsis">…</span>
              )}
              <button
                className="page-btn"
                onClick={() => setCurrentPage(totalPages)}
              >
                {totalPages}
              </button>
            </>
          )}

          <button
            className="page-btn"
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={!canNext}
          >
            ›
          </button>
          <button
            className="page-btn"
            onClick={() => setCurrentPage(totalPages)}
            disabled={!canNext}
          >
            »
          </button>

          <span className="page-info">
            {(currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, totalItems)} of {totalItems}
          </span>
        </div>
      )}
    </div>
  );
};

export default CustomersList;
