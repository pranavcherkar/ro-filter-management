import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/apiClient";
import ErrorState from "../../components/ErrorState";
import Loading from "../../components/Loading";

const UpdatePayment = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [amount, setAmount] = useState("");
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadCustomer = async () => {
      try {
        const res = await api.get(`/api/customers/${id}`);

        const customerData =
          res?.data?.customer || res?.data || res?.customer || null;

        if (!customerData) {
          throw new Error("Customer not found");
        }

        setCustomer(customerData);
      } catch (err) {
         setError(err?.message || "Failed to load customer");
      } finally {
        setLoading(false);
      }
    };

    loadCustomer();
  }, [id]);

  const isPaid =
    customer?.payment?.status &&
    customer.payment.status.toLowerCase() === "paid";

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isPaid) return;

    const paidAmount = Number(amount);
    if (!paidAmount || paidAmount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await api.patch(`/api/customers/${id}/payment`, {
        paidAmount,
      });

      navigate(`/customers/${id}`);
    } catch (err) {
       setError(err?.message || "Failed to update payment");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div style={{ padding: 16, maxWidth: 400 }}>
      <h2>Update Payment</h2>

      {error && <ErrorState message={error} />}

      {isPaid && (
        <div
          style={{
            background: "#ecfdf5",
            color: "#065f46",
            padding: "10px",
            borderRadius: "6px",
            marginBottom: "12px",
            fontSize: "14px",
            fontWeight: "600",
          }}
        >
          ✅ Payment already completed. No further updates allowed.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <label>Amount Paid Now</label>

        <input
          type="number"
          value={amount}
          disabled={isPaid}
          min="1"
          onChange={(e) => setAmount(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            marginTop: 6,
            opacity: isPaid ? 0.6 : 1,
            cursor: isPaid ? "not-allowed" : "text",
          }}
        />

        <button
          type="submit"
          disabled={isPaid || submitting}
          style={{
            marginTop: 12,
            opacity: isPaid ? 0.6 : 1,
            cursor: isPaid ? "not-allowed" : "pointer",
          }}
        >
          {isPaid
            ? "Payment Completed"
            : submitting
              ? "Updating..."
              : "Update Payment"}
        </button>
      </form>
    </div>
  );
};

export default UpdatePayment;
