import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/apiClient";
import Loading from "../components/Loading";
import ErrorState from "../components/ErrorState";
import "../styles/cusForm.css";

const CustomerForm = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(isEdit);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    roModel: "",
    bodyType: "",
    installationDate: "",
    filterPrice: "",
    initialPaidAmount: "",
    lastServiceDate: "",
    location: "",
    isActive: true,
  });

  // Load customer for edit
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
          bodyType: customer.bodyType || "",
          installationDate: customer.installationDate?.slice(0, 10) || "",
          filterPrice: customer.payment?.filterPrice || "",
          initialPaidAmount: "",
          lastServiceDate:
            customer.service?.lastServiceDate?.slice(0, 10) || "",
          location: customer.location || "",
          isActive: customer.isActive ?? true,
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
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isEdit) {
        const { filterPrice, initialPaidAmount, ...updatePayload } = form;
        await api.patch(`/api/customers/${id}`, updatePayload);
      } else {
        await api.post("/api/customers", form);
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
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Enter name"
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
                  placeholder="Phone number"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                className="form-input"
                placeholder="Full address"
              />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">RO Model</label>
                <input
                  name="roModel"
                  value={form.roModel}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. Kent Grand"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Body Type</label>
                <input
                  name="bodyType"
                  value={form.bodyType}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. Cabinet"
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Installation Date</label>
                <input
                  type="date"
                  name="installationDate"
                  value={form.installationDate}
                  onChange={handleChange}
                  className="form-input"
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

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Filter Price</label>
                <input
                  type="number"
                  name="filterPrice"
                  value={form.filterPrice}
                  disabled={isEdit}
                  onChange={handleChange}
                  onWheel={(e) => e.target.blur()} // 🔒 disables scroll
                  inputMode="numeric"
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
                    onWheel={(e) => e.target.blur()}
                    inputMode="numeric"
                    className="form-input"
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Location / Landmark</label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                className="form-input"
                placeholder="Nearby landmark"
              />
            </div>

            {/* Edit-only: Active / Inactive */}
            {isEdit && (
              <div className="form-group">
                <label className="form-label">Customer Status</label>
                <select
                  className="form-input"
                  value={form.isActive ? "true" : "false"}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      isActive: e.target.value === "true",
                    })
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
