import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/apiClient";
import Loading from "../components/Loading";
import ErrorState from "../components/ErrorState";
import "../styles/cusForm.css";

const Profile = () => {
  const navigate = useNavigate();

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    phone: "",
    businessName: "",
    defaultServiceCycleMonths: 6,
    email: "", // read-only — shown but not sent
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/api/auth/me");
        const user = res?.user || res;
        setForm({
          firstname: user.firstname || "",
          lastname: user.lastname || "",
          phone: user.phone || "",
          businessName: user.businessName || "",
          defaultServiceCycleMonths: user.defaultServiceCycleMonths ?? 6,
          email: user.email || "",
        });
      } catch (err) {
        setError(err?.message || "Failed to load profile");
      } finally {
        setPageLoading(false);
      }
    };
    load();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const cycle = Number(form.defaultServiceCycleMonths);
    if (!Number.isFinite(cycle) || cycle < 1) {
      setError("Service cycle must be a positive number (months).");
      return;
    }

    setSaving(true);
    try {
      await api.patch("/api/auth/profile", {
        firstname: form.firstname.trim(),
        lastname: form.lastname.trim(),
        phone: form.phone.trim(),
        businessName: form.businessName.trim(),
        defaultServiceCycleMonths: cycle,
      });
      setSuccess("Profile updated successfully.");
    } catch (err) {
      setError(err?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (pageLoading) return <Loading />;

  return (
    <div className="form-page-wrapper">
      <div className="form-card">
        <div className="form-header">
          <h2>My Profile &amp; Settings</h2>
        </div>

        <div className="form-body">
          {error && <ErrorState message={error} />}
          {success && (
            <div
              style={{
                background: "#ecfdf5",
                color: "#065f46",
                padding: "10px 14px",
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              ✅ {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* ── Business Name ────────────────────────────────────── */}
            <div className="form-group">
              <label className="form-label">Business Name</label>
              <input
                name="businessName"
                value={form.businessName}
                onChange={handleChange}
                className="form-input"
                placeholder="Your RO service business name"
              />
            </div>

            {/* ── First + Last name ────────────────────────────────── */}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input
                  name="firstname"
                  value={form.firstname}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input
                  name="lastname"
                  value={form.lastname}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>
            </div>

            {/* ── Phone + Email ─────────────────────────────────────── */}
            <div className="form-grid">
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
              <div className="form-group">
                <label className="form-label">
                  Email{" "}
                  <span
                    style={{
                      fontWeight: 400,
                      color: "#94a3b8",
                      textTransform: "none",
                    }}
                  >
                    (read-only)
                  </span>
                </label>
                <input
                  value={form.email}
                  disabled
                  className="form-input"
                  style={{ opacity: 0.6, cursor: "not-allowed" }}
                />
              </div>
            </div>

            {/* ── Default Service Cycle ─────────────────────────────── */}
            <div className="form-group">
              <label className="form-label">
                Default Service Cycle (months)
              </label>
              <input
                type="number"
                name="defaultServiceCycleMonths"
                value={form.defaultServiceCycleMonths}
                onChange={handleChange}
                className="form-input"
                min="1"
                max="24"
                required
              />
              <span style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                How many months between scheduled services for customers who
                don't have a custom cycle set. Currently set to{" "}
                <strong>
                  {form.defaultServiceCycleMonths} month
                  {form.defaultServiceCycleMonths !== 1 ? "s" : ""}
                </strong>
                .
              </span>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button
                type="submit"
                disabled={saving}
                className="submit-btn"
                style={{ flex: 1 }}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                className="submit-btn"
                style={{ flex: 0, background: "#f1f5f9", color: "#334155" }}
                onClick={() => navigate(-1)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
