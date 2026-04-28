import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/apiClient";
import Loading from "../components/Loading";
import ErrorState from "../components/ErrorState";
import "../styles/cusForm.css";

const CustomerForm = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(isEdit);
  const [error, setError] = useState("");

  const [roModels, setRoModels] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    roModel: "",
    roBodyType: "",
    installationDate: "",
    filterPrice: "",
    initialPaidAmount: "",
    lastServiceDate: "",
    locationMapLink: "",
    isActive: true,
    customerType: "REGULAR",
    amcStartDate: "",
    amcEndDate: "",
  });

  // Derived booleans — used throughout the JSX to show/hide fields
  const isRegular = form.customerType === "REGULAR";
  const isAmc = form.customerType === "AMC";
  const isServiceOnly = form.customerType === "SERVICE_ONLY";

  // Load RO Models for autocomplete
  useEffect(() => {
    const loadModels = async () => {
      try {
        const res = await api.get("/api/inventory/ro-models");
        const models = res.models || [];
        setRoModels(
          models
            .filter((m) => m.isActive && m.quantity > 0)
            .map((m) => m.modelName),
        );
      } catch (err) {
        console.error("Failed to load RO models");
      }
    };
    loadModels();
  }, []);

  // Close autocomplete dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load existing customer data in edit mode
  useEffect(() => {
    if (!isEdit) return;

    const loadCustomer = async () => {
      try {
        const res = await api.get(`/api/customers/${id}`);
        const customer =
          res?.data?.customer || res?.data || res?.customer || res;

        if (!customer) throw new Error("Customer not found");

        setForm({
          name: customer.name || "",
          phone: customer.phone || "",
          address: customer.address || "",
          roModel: customer.roModel || "",
          roBodyType: customer.roBodyType || "",
          installationDate: customer.installationDate?.slice(0, 10) || "",
          filterPrice: customer.payment?.filterPrice || "",
          initialPaidAmount: "",
          lastServiceDate:
            customer.service?.lastServiceDate?.slice(0, 10) || "",
          locationMapLink: customer.location?.mapLink || "",
          isActive: customer.isActive ?? true,
          customerType: customer.customerType || "REGULAR",
          amcStartDate: customer.amcContract?.startDate?.slice(0, 10) || "",
          amcEndDate: customer.amcContract?.endDate?.slice(0, 10) || "",
        });
      } catch (err) {
        setError(err.message || "Failed to load customer");
      } finally {
        setPageLoading(false);
      }
    };

    loadCustomer();
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectModel = (model) => {
    setForm((prev) => ({ ...prev, roModel: model }));
    setShowDropdown(false);
  };

  const filteredModels = roModels.filter((m) =>
    m.toLowerCase().includes(form.roModel.toLowerCase()),
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isEdit) {
        await api.patch(`/api/customers/${id}`, {
          name: form.name,
          phone: form.phone,
          address: form.address,
          roModel: form.roModel,
          roBodyType: form.roBodyType,
          isActive: form.isActive,
          location: { mapLink: form.locationMapLink },
        });
      } else {
        const payload = {
          name: form.name,
          phone: form.phone,
          address: form.address,
          roModel: form.roModel,
          roBodyType: form.roBodyType,
          location: { mapLink: form.locationMapLink },
          customerType: form.customerType,

          // REGULAR only
          ...(isRegular && {
            installationDate: form.installationDate,
            filterPrice: form.filterPrice,
            initialPaidAmount: form.initialPaidAmount,
            lastServiceDate: form.lastServiceDate,
          }),

          // AMC only
          ...(isAmc && {
            amcContract: {
              startDate: form.amcStartDate,
              endDate: form.amcEndDate,
            },
          }),
        };

        await api.post("/api/customers", payload);
      }

      navigate("/customers");
    } catch (err) {
      setError(err.message || "Failed to save customer");
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) return <Loading />;

  return (
    <div className="form-page-wrapper">
      <div className="form-card">
        <div className="form-header">
          <h2>
            {isEdit ? "Edit Customer Details" : "New Customer Registration"}
          </h2>
        </div>

        <div className="form-body">
          {error && <ErrorState message={error} />}

          <form onSubmit={handleSubmit}>
            {/* ── Customer Type selector (create only) ─────────────────────── */}
            {!isEdit && (
              <div className="form-group">
                <label className="form-label">Customer Type</label>
                <select
                  name="customerType"
                  value={form.customerType}
                  onChange={handleChange}
                  className="form-input"
                >
                  <option value="REGULAR">
                    Regular (bought machine from us)
                  </option>
                  <option value="AMC">AMC – Annual Maintenance Contract</option>
                  <option value="SERVICE_ONLY">
                    Service Only (owns machine externally)
                  </option>
                </select>
              </div>
            )}

            {/* ── Name + Phone ─────────────────────────────────────────────── */}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>
            </div>

            {/* ── Address ──────────────────────────────────────────────────── */}
            <div className="form-group">
              <label className="form-label">Address</label>
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            {/* ── RO Model + Body Type ─────────────────────────────────────── */}
            {/* Shown for all types. Required only for REGULAR.                 */}
            {/* AMC / SERVICE_ONLY: stored for reference if known.              */}
            <div className="form-grid">
              <div
                className="form-group autocomplete-wrapper"
                ref={dropdownRef}
              >
                <label className="form-label">
                  RO Model{" "}
                  {!isRegular && (
                    <span style={{ fontWeight: 400, color: "#94a3b8" }}>
                      (optional)
                    </span>
                  )}
                </label>
                <input
                  name="roModel"
                  value={form.roModel}
                  onChange={handleChange}
                  onFocus={() => setShowDropdown(true)}
                  className="form-input"
                  placeholder={
                    isRegular ? "Search RO model" : "Optional — enter if known"
                  }
                  required={isRegular}
                />

                {showDropdown && filteredModels.length > 0 && (
                  <div className="autocomplete-dropdown">
                    {filteredModels.map((model, index) => (
                      <div
                        key={index}
                        className="autocomplete-item"
                        onClick={() => handleSelectModel(model)}
                      >
                        {model}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Body Type</label>
                <input
                  name="roBodyType"
                  value={form.roBodyType}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>
            </div>

            {/* ── Installation Date + Last Service Date (REGULAR only) ──────── */}
            {/* AMC customers have external installs.                            */}
            {/* SERVICE_ONLY: no installation through us at all.                 */}
            {isRegular && (
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Installation Date</label>
                  <input
                    type="date"
                    name="installationDate"
                    value={form.installationDate}
                    onChange={handleChange}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Last Service Date</label>
                  <input
                    type="date"
                    name="lastServiceDate"
                    value={form.lastServiceDate}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
              </div>
            )}

            {/* ── Filter Price + Initial Paid (REGULAR only) ───────────────── */}
            {/* AMC / SERVICE_ONLY never purchased a machine through us.         */}
            {isRegular && (
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Filter Price</label>
                  <input
                    type="number"
                    name="filterPrice"
                    value={form.filterPrice}
                    disabled={isEdit}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>

                {!isEdit && (
                  <div className="form-group">
                    <label className="form-label">Initial Paid Amount</label>
                    <input
                      type="number"
                      name="initialPaidAmount"
                      value={form.initialPaidAmount}
                      onChange={handleChange}
                      className="form-input"
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── AMC Contract Dates (AMC only, create only) ───────────────── */}
            {!isEdit && isAmc && (
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">AMC Start Date</label>
                  <input
                    type="date"
                    name="amcStartDate"
                    value={form.amcStartDate}
                    onChange={handleChange}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">AMC End Date</label>
                  <input
                    type="date"
                    name="amcEndDate"
                    value={form.amcEndDate}
                    onChange={handleChange}
                    className="form-input"
                    required
                  />
                </div>
              </div>
            )}

            {/* ── Location / Map Link ──────────────────────────────────────── */}
            <div className="form-group">
              <label className="form-label">Location / Map Link</label>
              <input
                name="locationMapLink"
                value={form.locationMapLink}
                onChange={handleChange}
                className="form-input"
                placeholder="Google Maps link or landmark"
              />
            </div>

            {/* ── Active / Inactive toggle (edit only) ─────────────────────── */}
            {isEdit && (
              <div className="form-group">
                <label className="form-label">Customer Status</label>
                <select
                  className="form-input"
                  value={form.isActive ? "true" : "false"}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      isActive: e.target.value === "true",
                    }))
                  }
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            )}

            <button type="submit" disabled={loading} className="submit-btn">
              {loading
                ? "Processing..."
                : isEdit
                  ? "Update Records"
                  : "Create Customer Profile"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CustomerForm;
