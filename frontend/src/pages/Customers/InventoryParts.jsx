import { useEffect, useState } from "react";
import api from "../../api/apiClient";
import Loading from "../../components/Loading";
import ErrorState from "../../components/ErrorState";
import "../../styles/inventory.css";

const InventoryParts = () => {
  const [type, setType] = useState("parts");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState(0);

  // bulk quantity per item
  const [qtyInputs, setQtyInputs] = useState({});

  useEffect(() => {
    loadInventory();
  }, [type]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const endpoint =
        type === "parts" ? "/api/inventory/parts" : "/api/inventory/ro-models";
      //  res = await api.get("/api/inventory/ro-models");

      const res = await api.get(endpoint);
      const data = type === "parts" ? res.items || [] : res.models || [];

      setItems(data);

      const initialInputs = {};
      data.forEach((item) => {
        initialInputs[item._id] = "";
      });
      setQtyInputs(initialInputs);
    } catch (err) {
      setError("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = async (id, change) => {
    try {
      const endpoint =
        type === "parts"
          ? `/api/inventory/parts/${id}`
          : `/api/inventory/ro-models/${id}`;

      await api.patch(endpoint, { change });

      setItems((prev) =>
        prev.map((item) =>
          item._id === id
            ? { ...item, quantity: Math.max(0, item.quantity + change) }
            : item,
        ),
      );
    } catch (err) {
      alert(err?.response?.data?.message || "Update failed");
      loadInventory();
    }
  };

  const handleBulkUpdate = async (id) => {
    const change = Number(qtyInputs[id]);
    if (!change) return;

    try {
      const endpoint =
        type === "parts"
          ? `/api/inventory/parts/${id}`
          : `/api/inventory/ro-models/${id}`;

      await api.patch(endpoint, { change });

      setItems((prev) =>
        prev.map((item) =>
          item._id === id
            ? { ...item, quantity: Math.max(0, item.quantity + change) }
            : item,
        ),
      );

      setQtyInputs((prev) => ({ ...prev, [id]: "" }));
    } catch (err) {
      alert(err?.response?.data?.message || "Update failed");
      loadInventory();
    }
  };

  const handleAddNew = async () => {
    if (!newName.trim()) return alert("Name required");

    try {
      const endpoint =
        type === "parts" ? "/api/inventory/parts" : "/api/inventory/ro-models";

      const body =
        type === "parts"
          ? { name: newName, quantity: Number(newQuantity) }
          : { modelName: newName, quantity: Number(newQuantity) };

      await api.post(endpoint, body);

      setNewName("");
      setNewQuantity(0);
      loadInventory();
    } catch (err) {
      alert(err?.response?.data?.message || "Add failed");
    }
  };

  const displayedItems = items.filter((item) => {
    const itemName = item.name || item.modelName || "";
    return itemName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="inv-page-wrapper">
      <div className="inv-container">
        <header className="inv-header">
          <div>
            <h1 className="inv-title">Inventory Control</h1>
            <p className="inv-subtitle">Manage Stock Levels</p>
          </div>

          <div className="inv-toggle-box">
            <button
              className={`inv-toggle-btn ${type === "parts" ? "active" : ""}`}
              onClick={() => {
                setType("parts");
                setSearchTerm("");
              }}
            >
              Parts
            </button>

            <button
              className={`inv-toggle-btn ${type === "ro" ? "active" : ""}`}
              onClick={() => {
                setType("ro");
                setSearchTerm("");
              }}
            >
              RO Models
            </button>
          </div>
        </header>

        <div className="inv-search-section">
          <div className="inv-search-bar">
            <span>🔍</span>
            <input
              type="text"
              placeholder={`Quick search ${
                type === "parts" ? "parts" : "models"
              }...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="inv-add-card">
          <h2 className="inv-card-title">Register New Stock</h2>

          <div className="inv-form-stack">
            <input
              className="inv-input-text"
              placeholder={
                type === "parts" ? "Part Name..." : "RO Model Name..."
              }
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />

            <div className="inv-qty-row">
              <div className="inv-qty-input-group">
                <label>Qty:</label>
                <input
                  className="inv-input-num"
                  type="number"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(Number(e.target.value))}
                />
              </div>

              <button className="inv-primary-btn" onClick={handleAddNew}>
                Add Item
              </button>
            </div>
          </div>
        </div>

        <div className="inv-list-grid">
          {displayedItems.map((item) => (
            <div
              key={item._id}
              className={`inv-item-card ${
                item.quantity <= 0 ? "out-of-stock" : ""
              }`}
            >
              <div>
                <h3 className="inv-item-name">
                  {type === "parts" ? item.name : item.modelName}
                </h3>
                <span className="inv-item-cat">
                  {type === "parts" ? item.category || "Part" : "RO Unit"}
                </span>
              </div>

              <div className="inv-item-controls">
                {/* Quick row */}
                <div className="inv-quick-row">
                  <button
                    className="inv-qty-btn"
                    onClick={() => handleQuantityChange(item._id, -1)}
                  >
                    −
                  </button>

                  <span className="inv-qty-val">{item.quantity}</span>

                  <button
                    className="inv-qty-btn"
                    onClick={() => handleQuantityChange(item._id, 1)}
                  >
                    +
                  </button>
                </div>

                {/* Bulk row */}
                <div className="inv-bulk-row">
                  <input
                    type="number"
                    className="inv-bulk-input"
                    value={qtyInputs[item._id] || ""}
                    onChange={(e) =>
                      setQtyInputs({
                        ...qtyInputs,
                        [item._id]: e.target.value,
                      })
                    }
                    placeholder="+/-"
                  />

                  <button
                    className="inv-update-btn"
                    onClick={() => handleBulkUpdate(item._id)}
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InventoryParts;
