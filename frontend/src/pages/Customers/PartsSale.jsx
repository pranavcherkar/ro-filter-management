import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/apiClient";
import Loading from "../../components/Loading";
import ErrorState from "../../components/ErrorState";
import "../../styles/PartsSales.css";
// 
// ── Customer search dropdown ───────────────────────────────────────────────
const CustomerSearch = ({ onSelect, onWalkIn }) => {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [searching, setSearching] = useState(false);
  const [mode, setMode]         = useState("search"); // "search" | "walkin"
  const [walkInName, setWalkInName]   = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setResults([]);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = async (q) => {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get("/api/parts-sale/customers", { params: { q } });
      setResults(res.customers || []);
    } catch { setResults([]); }
    finally { setSearching(false); }
  };

  const pick = (c) => {
    setSelected(c);
    setQuery(c.name);
    setResults([]);
    onSelect(c.id, null, null);
  };

  const clearCustomer = () => {
    setSelected(null);
    setQuery("");
    onSelect(null, null, null);
  };

  const applyWalkIn = () => {
    onWalkIn(walkInName || "Walk-in", walkInPhone);
    onSelect(null, walkInName || "Walk-in", walkInPhone);
  };

  return (
    <div className="ps-customer-card">
      <div className="ps-section-title">Customer</div>

      <div className="ps-mode-tabs">
        <button className={`ps-mode-tab ${mode === "search" ? "active" : ""}`}
          onClick={() => { setMode("search"); onSelect(null, null, null); }}>
          Registered Customer
        </button>
        <button className={`ps-mode-tab ${mode === "walkin" ? "active" : ""}`}
          onClick={() => { setMode("walkin"); onSelect(null, walkInName, walkInPhone); }}>
          Walk-in / Other
        </button>
      </div>

      {mode === "search" ? (
        <div className="ps-customer-search" ref={ref}>
          {selected ? (
            <div className="ps-selected-customer">
              <div>
                <div className="ps-sel-name">{selected.name}</div>
                <div className="ps-sel-meta">{selected.phone} · {selected.address || selected.customerType}</div>
              </div>
              <button className="ps-clear-btn" onClick={clearCustomer}>✕</button>
            </div>
          ) : (
            <>
              <input
                className="ps-input"
                placeholder="Search by name or phone..."
                value={query}
                onChange={(e) => search(e.target.value)}
              />
              {searching && <div className="ps-dropdown-item" style={{ color: "#94a3b8" }}>Searching...</div>}
              {results.length > 0 && (
                <div className="ps-dropdown">
                  {results.map((c) => (
                    <div key={c.id} className="ps-dropdown-item" onClick={() => pick(c)}>
                      <strong>{c.name}</strong>
                      <span className="ps-dropdown-meta"> · {c.phone}{c.address ? ` · ${c.address}` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div>
          <input className="ps-input" placeholder="Customer name (optional)"
            value={walkInName} onChange={(e) => { setWalkInName(e.target.value); applyWalkIn(); }} />
          <input className="ps-input" style={{ marginTop: 8 }} placeholder="Phone (optional)"
            value={walkInPhone} onChange={(e) => { setWalkInPhone(e.target.value); applyWalkIn(); }} />
        </div>
      )}
    </div>
  );
};

// ── Price modal ────────────────────────────────────────────────────────────
const PriceModal = ({ part, onClose, onAdd }) => {
  const [price, setPrice] = useState("");
  const [qty, setQty]     = useState(1);

  const total = (Number(price) || 0) * qty;

  const submit = () => {
    if (!price || Number(price) <= 0) {
      document.getElementById("ps-price-input").focus();
      return;
    }
    onAdd({ inventoryItemId: part.id, name: part.name, price: Number(price), qty });
    onClose();
  };

  return (
    <div className="ps-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ps-modal-sheet">
        <div className="ps-modal-handle" />
        <div className="ps-modal-title">{part.name}</div>
        <div className="ps-modal-sub">Stock: {part.stock}</div>

        <label className="ps-label">Price per unit (₹)</label>
        <input id="ps-price-input" className="ps-input ps-price-input" type="number"
          placeholder="Enter selling price" value={price}
          onChange={(e) => setPrice(e.target.value)} autoFocus />

        <label className="ps-label" style={{ marginTop: 12 }}>Quantity</label>
        <div className="ps-qty-row">
          <button className="ps-qty-btn" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
          <span className="ps-qty-display">{qty}</span>
          <button className="ps-qty-btn" onClick={() => setQty(Math.min(qty + 1, part.stock))}>+</button>
          <span className="ps-qty-unit">of {part.stock}</span>
        </div>

        {total > 0 && (
          <div className="ps-total-preview">
            Total: <strong>₹{total.toLocaleString("en-IN")}</strong>
          </div>
        )}

        <div className="ps-modal-actions">
          <button className="ps-btn ps-btn-outline" onClick={onClose}>Cancel</button>
          <button className="ps-btn ps-btn-primary" onClick={submit}>Add to Cart</button>
        </div>
      </div>
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────
const PartsSale = () => {
  const navigate = useNavigate();

  const [parts,   setParts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [search,  setSearch]  = useState("");

  const [cart,    setCart]    = useState([]);
  const [modalPart, setModalPart] = useState(null);

  const [step, setStep] = useState("parts"); // "parts" | "checkout" | "success"

  const [customerId,   setCustomerId]   = useState(null);
  const [walkInName,   setWalkInName]   = useState(null);
  const [walkInPhone,  setWalkInPhone]  = useState(null);

  const [payStatus,   setPayStatus]   = useState("PAID");
  const [partialAmt,  setPartialAmt]  = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [successData, setSuccessData] = useState(null);

  // Load parts
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/api/parts-sale/parts",
          search ? { params: { search } } : {}
        );
        setParts(res.items || []);
      } catch (err) {
        setError(err?.message || "Failed to load parts");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [search]);

  const handleCustomerSelect = (cId, wName, wPhone) => {
    setCustomerId(cId);
    setWalkInName(wName);
    setWalkInPhone(wPhone);
  };

  const addToCart = (item) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.inventoryItemId === item.inventoryItemId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = item;
        return updated;
      }
      return [...prev, item];
    });
    setModalPart(null);
  };

  const removeFromCart = (inventoryItemId) => {
    setCart((prev) => prev.filter((c) => c.inventoryItemId !== inventoryItemId));
  };

  const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  const completeSale = async () => {
    setSubmitError("");
    let paid = cartTotal;
    if (payStatus === "PARTIAL") {
      paid = Number(partialAmt);
      if (!paid || paid <= 0 || paid >= cartTotal) {
        setSubmitError("Enter a valid partial amount (less than total).");
        return;
      }
    }
    if (payStatus === "PENDING") paid = 0;

    try {
      setSubmitting(true);
      const res = await api.post("/api/parts-sale", {
        customerId,
        walkInName,
        walkInPhone,
        cart: cart.map((c) => ({
          inventoryItemId: c.inventoryItemId,
          name:  c.name,
          price: c.price,
          qty:   c.qty,
        })),
        paymentStatus: payStatus,
        paidAmount: paid,
      });

      setSuccessData({ total: cartTotal, paid, invoiceId: res.invoiceId });
      setStep("success");
    } catch (err) {
      setSubmitError(err?.message || "Failed to complete sale");
    } finally {
      setSubmitting(false);
    }
  };

  const startFresh = () => {
    setCart([]);
    setStep("parts");
    setPayStatus("PAID");
    setPartialAmt("");
    setSuccessData(null);
    setSubmitError("");
  };

  const filteredParts = parts.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Loading />;
  if (error)   return <ErrorState message={error} />;

  // ── STEP: PARTS ──────────────────────────────────────────────────────────
  if (step === "parts") return (
    <div className="ps-page">
      <div className="ps-header">
        <button className="ps-back" onClick={() => navigate("/")}>←</button>
        <div className="ps-header-title">Sell Parts</div>
        {cart.length > 0 && (
          <button className="ps-cart-btn" onClick={() => setStep("checkout")}>
            Cart <span className="ps-cart-badge">{cartCount}</span>
          </button>
        )}
      </div>

      <div className="ps-body">
        <CustomerSearch onSelect={handleCustomerSelect} onWalkIn={(n, p) => { setWalkInName(n); setWalkInPhone(p); }} />

        <div className="ps-search-wrap">
          <input className="ps-search-input" placeholder="Search parts..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="ps-section-title">Parts ({filteredParts.length})</div>

        <div className="ps-parts-grid">
          {filteredParts.map((p) => {
            const inCart = cart.find((c) => c.inventoryItemId === p.id);
            return (
              <div key={p.id} className={`ps-part-card ${inCart ? "in-cart" : ""}`}
                onClick={() => p.stock > 0 && setModalPart(p)}>
                <div className="ps-part-name">{p.name}</div>
                <div className={`ps-part-stock ${p.stock <= 3 ? "low" : ""}`}>
                  Stock: {p.stock}
                </div>
                <button className={`ps-add-btn ${inCart ? "added" : ""}`}>
                  {inCart ? `✓ In Cart (${inCart.qty})` : p.stock === 0 ? "Out of Stock" : "+ Add"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {cart.length > 0 && (
        <div className="ps-sticky-bottom">
          <button className="ps-btn ps-btn-primary" onClick={() => setStep("checkout")}>
            Proceed to Bill — ₹{cartTotal.toLocaleString("en-IN")}
          </button>
        </div>
      )}

      {modalPart && (
        <PriceModal part={modalPart} onClose={() => setModalPart(null)} onAdd={addToCart} />
      )}
    </div>
  );

  // ── STEP: CHECKOUT ───────────────────────────────────────────────────────
  if (step === "checkout") return (
    <div className="ps-page">
      <div className="ps-header">
        <button className="ps-back" onClick={() => setStep("parts")}>←</button>
        <div className="ps-header-title">Create Bill</div>
      </div>

      <div className="ps-body">
        {/* Cart items */}
        <div className="ps-section-title">Items</div>
        {cart.map((c) => (
          <div key={c.inventoryItemId} className="ps-cart-item">
            <div className="ps-cart-info">
              <div className="ps-cart-name">{c.name}</div>
              <div className="ps-cart-meta">₹{c.price.toLocaleString("en-IN")} × {c.qty}</div>
            </div>
            <div className="ps-cart-total">₹{(c.price * c.qty).toLocaleString("en-IN")}</div>
            <button className="ps-remove-btn" onClick={() => removeFromCart(c.inventoryItemId)}>✕</button>
          </div>
        ))}

        {/* Total */}
        <div className="ps-summary-box">
          <div className="ps-summary-row">
            <span>Items</span><span>{cartCount}</span>
          </div>
          <div className="ps-summary-row ps-summary-total">
            <span>Total</span><span>₹{cartTotal.toLocaleString("en-IN")}</span>
          </div>
        </div>

        {/* Payment status */}
        <div className="ps-section-title">Payment Status</div>
        <div className="ps-pay-group">
          {[
            { key: "PAID",    label: "Paid"    },
            { key: "PARTIAL", label: "Partial" },
            { key: "PENDING", label: "Pending" },
          ].map(({ key, label }) => (
            <button key={key}
              className={`ps-pay-btn ${payStatus === key ? `ps-pay-${key.toLowerCase()}` : ""}`}
              onClick={() => setPayStatus(key)}>
              {label}
            </button>
          ))}
        </div>

        {payStatus === "PARTIAL" && (
          <div style={{ marginTop: 8 }}>
            <label className="ps-label">Amount Collected (₹)</label>
            <input className="ps-input" type="number"
              placeholder="Enter amount received"
              value={partialAmt} onChange={(e) => setPartialAmt(e.target.value)} />
          </div>
        )}

        {submitError && <div className="ps-error">{submitError}</div>}
      </div>

      <div className="ps-sticky-bottom">
        <button className="ps-btn ps-btn-primary" onClick={completeSale} disabled={submitting}>
          {submitting ? "Processing..." : "Complete Sale"}
        </button>
      </div>
    </div>
  );

  // ── STEP: SUCCESS ────────────────────────────────────────────────────────
  return (
    <div className="ps-page">
      <div className="ps-header">
        <div className="ps-header-title">Sale Complete</div>
      </div>

      <div className="ps-body">
        <div className="ps-success-card">
          <div className="ps-success-icon">✓</div>
          <div className="ps-success-title">Sale Recorded</div>
          <div className="ps-success-sub">
            ₹{successData?.total?.toLocaleString("en-IN")} · {cartCount} items
          </div>

          <div className="ps-invoice-preview">
            {cart.map((c) => (
              <div key={c.inventoryItemId} className="ps-preview-row">
                <span>{c.name} ×{c.qty}</span>
                <span>₹{(c.price * c.qty).toLocaleString("en-IN")}</span>
              </div>
            ))}
            <div className="ps-preview-row ps-preview-total">
              <span>Total</span>
              <span>₹{successData?.total?.toLocaleString("en-IN")}</span>
            </div>
            {payStatus !== "PAID" && (
              <div className="ps-preview-row" style={{ color: "#dc2626" }}>
                <span>Pending</span>
                <span>₹{((successData?.total || 0) - (successData?.paid || 0)).toLocaleString("en-IN")}</span>
              </div>
            )}
          </div>

          <button className="ps-btn ps-btn-outline" style={{ width: "100%", marginBottom: 10 }}
            onClick={() => navigate("/invoices")}>
            View Invoice
          </button>
          <button className="ps-btn ps-btn-primary" style={{ width: "100%" }} onClick={startFresh}>
            New Sale
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartsSale;