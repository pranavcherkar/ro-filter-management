import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/apiClient";
import ErrorState from "../../components/ErrorState";
import "../../styles/AddService.css"; // Import the CSS

const AddService = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [serviceDate, setServiceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [serviceType, setServiceType] = useState("SCHEDULED");
  const [affectsServiceCycle, setAffectsServiceCycle] = useState(true);
  const [serviceCharge, setServiceCharge] = useState("");
  const [parts, setParts] = useState([{ partName: "", price: "" }]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePartChange = (index, field, value) => {
    const updated = [...parts];
    updated[index][field] = value;
    setParts(updated);
  };

  const addPart = () => {
    setParts([...parts, { partName: "", price: "" }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/api/services", {
        customerId: id,
        serviceDate,
        serviceType,
        affectsServiceCycle,
        serviceCharge: Number(serviceCharge) || 0,
        replacedParts: parts
          .filter((p) => p.partName)
          .map((p) => ({
            partName: p.partName,
            price: Number(p.price) || 0,
          })),
      });

      navigate(`/customers/${id}`);
    } catch (err) {
      setError(err.message || "Failed to add service");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="service-form-wrapper">
      <div className="service-form-card">
        <div className="service-form-header">
          <h2>Add Service Record</h2>
        </div>

        <div className="service-form-body">
          {error && <ErrorState message={error} />}

          <form onSubmit={handleSubmit}>
            <div className="form-section">
              <label className="service-label">Service Date</label>
              <input
                className="service-input"
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                required
              />
            </div>

            <div className="form-section">
              <label className="service-label">Service Type</label>
              <select
                className="service-select"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
              >
                <option value="SCHEDULED">Scheduled Maintenance</option>
                <option value="EARLY">Early Service</option>
                <option value="EMERGENCY">Emergency Repair</option>
              </select>
            </div>

            <div className="form-section">
              <label className="service-label">Service Charge (Labor)</label>
              <input
                className="service-input"
                type="number"
                placeholder="0.00"
                value={serviceCharge}
                onChange={(e) => setServiceCharge(e.target.value)}
              />
            </div>

            <label className="checkbox-group">
              <input
                type="checkbox"
                checked={affectsServiceCycle}
                onChange={(e) => setAffectsServiceCycle(e.target.checked)}
              />
              Update next service due date
            </label>

            <h4 className="parts-title">Replaced Parts</h4>

            {parts.map((part, index) => (
              <div key={index} className="part-row">
                <input
                  className="service-input"
                  placeholder="Part name"
                  value={part.partName}
                  onChange={(e) =>
                    handlePartChange(index, "partName", e.target.value)
                  }
                />
                <input
                  className="service-input"
                  type="number"
                  placeholder="Price"
                  value={part.price}
                  onChange={(e) =>
                    handlePartChange(index, "price", e.target.value)
                  }
                />
              </div>
            ))}

            <button type="button" className="add-part-btn" onClick={addPart}>
              + Add Another Part
            </button>

            <button
              type="submit"
              className="submit-service-btn"
              disabled={loading}
            >
              {loading ? "Processing..." : "Save Service Record"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddService;
