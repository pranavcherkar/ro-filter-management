import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/apiClient";
import Loading from "../../components/Loading";
import ErrorState from "../../components/ErrorState";
import "../../styles/cusDetails.css";

import CustomerInfoSection from "./customerDetailsComponent/CustomerInfoSection";
import AmcSection from "./customerDetailsComponent/AmcSection";
import ServiceSection from "./customerDetailsComponent/ServiceSection";

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // ── Customer & history state ───────────────────────────────────────────────
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [serviceHistory, setServiceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // ── Service modal state ────────────────────────────────────────────────────
  const [selectedService, setSelectedService] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [serviceDeleteLoading, setServiceDeleteLoading] = useState(false);

  // ── Delete customer modal state ────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState("soft");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // ── AMC modal state ────────────────────────────────────────────────────────
  const [showAmcModal, setShowAmcModal] = useState(false);
  const [amcLoading, setAmcLoading] = useState(false);
  const [amcError, setAmcError] = useState("");
  const [amcForm, setAmcForm] = useState({
    amount: "",
    totalAmcAmount: "",
    startDate: "",
    endDate: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentStatus: "PAID",
    notes: "",
  });

  const [showAmcUpdateModal, setShowAmcUpdateModal] = useState(false);
  const [amcUpdateAmount, setAmcUpdateAmount] = useState("");
  const [amcUpdateLoading, setAmcUpdateLoading] = useState(false);
  const [amcUpdateError, setAmcUpdateError] = useState("");

  // ── Data loader ────────────────────────────────────────────────────────────
  const loadData = async () => {
    try {
      const [customerRes, historyRes] = await Promise.all([
        api.get(`/api/customers/${id}`),
        api.get(`/api/services/customer/${id}`),
      ]);

      const customerData =
        customerRes?.data?.customer ||
        customerRes?.data ||
        customerRes?.customer ||
        null;

      if (!customerData) throw new Error("Customer data not found");

      setCustomer(customerData);

      const history = Array.isArray(historyRes.services)
        ? historyRes.services
        : [];
      history.sort((a, b) => new Date(b.date) - new Date(a.date));
      setServiceHistory(history);
    } catch (err) {
      setError(err?.message || "Failed to load customer");
    } finally {
      setLoading(false);
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const isRegular = customer?.customerType === "REGULAR";
  const isAmc = customer?.customerType === "AMC";
  const isServiceOnly = customer?.customerType === "SERVICE_ONLY";
  // Note: intentionally NOT gated by isRegular — a customer can buy a machine
  // and later start AMC (customerType becomes "AMC"), but their filter payment
  // status should still reflect correctly and disable the button when fully paid.
  const isPaid = customer?.payment?.status?.toLowerCase() === "paid";

  const calculateAmcDaysLeft = (endDate, status) => {
    if (!endDate || status === "CANCELLED") return "-";
    const days = Math.ceil(
      (new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24),
    );
    return days < 0 ? "Expired" : `${days} days`;
  };

  const amcStatus = customer?.amcContract?.status || "NOT STARTED";
  const amcDaysLeft = calculateAmcDaysLeft(
    customer?.amcContract?.endDate,
    amcStatus,
  );
  const lastAmcPayment = {
    amount: customer?.amcContract?.lastPaymentAmount ?? null,
    date: customer?.amcContract?.lastPaymentDate ?? null,
  };

  // ── Service modal handlers ─────────────────────────────────────────────────
  const openServiceModal = async (serviceId) => {
    try {
      setModalLoading(true);
      const res = await api.get(`/api/services/${serviceId}`);
      setSelectedService(res.service);
    } catch {
      alert("Failed to load service details");
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => setSelectedService(null);

  const handleDeleteService = async () => {
    if (!selectedService?.id || serviceDeleteLoading) return;
    if (!window.confirm("Delete this service record? This cannot be undone."))
      return;

    try {
      setServiceDeleteLoading(true);
      await api.delete(`/api/services/${selectedService.id}`);
      setSelectedService(null);
      setHistoryLoading(true);
      await loadData();
    } catch (err) {
      alert(err?.message || "Failed to delete service");
    } finally {
      setServiceDeleteLoading(false);
    }
  };

  // ── Delete customer handlers ───────────────────────────────────────────────
  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setShowDeleteModal(false);
    setDeleteError("");
    setDeleteMode("soft");
  };

  const handleDeleteCustomer = async () => {
    try {
      setDeleteLoading(true);
      setDeleteError("");
      await api.delete(`/api/customers/${id}?mode=${deleteMode}`);
      navigate("/customers");
    } catch (err) {
      setDeleteError(err?.message || "Failed to delete customer");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── AMC handlers ───────────────────────────────────────────────────────────
  const openAmcModal = () => {
    setAmcError("");
    setAmcForm({
      amount: "",
      startDate: customer?.amcContract?.startDate?.slice(0, 10) || "",
      endDate: customer?.amcContract?.endDate?.slice(0, 10) || "",
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: customer?.amcContract?.notes || "",
    });
    setShowAmcModal(true);
  };

  const closeAmcModal = () => {
    if (amcLoading) return;
    setShowAmcModal(false);
    setAmcError("");
  };

  const handleAmcPayment = async () => {
    setAmcError("");
    if (!amcForm.startDate || !amcForm.endDate) {
      setAmcError("Start date and end date are required.");
      return;
    }
    try {
      setAmcLoading(true);
      await api.post(`/api/customers/${id}/amc-payment`, {
        amount: Number(amcForm.amount),
        startDate: amcForm.startDate,
        endDate: amcForm.endDate,
        paymentDate: amcForm.paymentDate,
        paymentStatus: amcForm.paymentStatus,
        notes: amcForm.notes,
        totalAmcAmount:
          Number(amcForm.totalAmcAmount) || Number(amcForm.amount),
      });
      setShowAmcModal(false);
      await loadData();
    } catch (err) {
      setAmcError(err?.message || "Failed to record AMC payment.");
    } finally {
      setAmcLoading(false);
    }
  };

  const handleStopAmc = async () => {
    if (
      !window.confirm(
        "Stop AMC for this customer? Their type will be set back to Regular.",
      )
    )
      return;
    try {
      setAmcLoading(true);
      await api.patch(`/api/customers/${id}`, {
        customerType: isServiceOnly ? "SERVICE_ONLY" : "REGULAR",
        amcContract: null,
      });
      await loadData();
    } catch (err) {
      alert(err?.message || "Failed to stop AMC.");
    } finally {
      setAmcLoading(false);
    }
  };

  const handleUpdateAmcPayment = async () => {
    const val = Number(amcUpdateAmount);
    if (!val || val <= 0) {
      setAmcUpdateError("Enter a valid amount");
      return;
    }
    try {
      setAmcUpdateLoading(true);
      setAmcUpdateError("");
      await api.patch(`/api/customers/${id}/amc-payment`, {
        additionalPaidAmount: val,
      });
      setShowAmcUpdateModal(false);
      setAmcUpdateAmount("");
      await loadData();
    } catch (err) {
      setAmcUpdateError(err?.message || "Failed to update AMC payment");
    } finally {
      setAmcUpdateLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  if (!customer) return <div>Customer not found</div>;

  return (
    <div className="detail-wrapper">
      <div className="detail-container">
        {/* ── SECTION 1: Customer info + financial summary ── */}
        <CustomerInfoSection
          customer={customer}
          id={id}
          navigate={navigate}
          isPaid={isPaid}
          isRegular={isRegular}
          isAmc={isAmc}
          isServiceOnly={isServiceOnly}
          showDeleteModal={showDeleteModal}
          setShowDeleteModal={setShowDeleteModal}
          closeDeleteModal={closeDeleteModal}
          deleteMode={deleteMode}
          setDeleteMode={setDeleteMode}
          deleteError={deleteError}
          deleteLoading={deleteLoading}
          handleDeleteCustomer={handleDeleteCustomer}
        />

        {/* ── SECTION 2: AMC details + AMC modals ── */}
        <AmcSection
          customer={customer}
          amcStatus={amcStatus}
          amcDaysLeft={amcDaysLeft}
          lastAmcPayment={lastAmcPayment}
          amcLoading={amcLoading}
          showAmcModal={showAmcModal}
          openAmcModal={openAmcModal}
          closeAmcModal={closeAmcModal}
          amcForm={amcForm}
          setAmcForm={setAmcForm}
          amcError={amcError}
          handleAmcPayment={handleAmcPayment}
          handleStopAmc={handleStopAmc}
          showAmcUpdateModal={showAmcUpdateModal}
          setShowAmcUpdateModal={setShowAmcUpdateModal}
          amcUpdateAmount={amcUpdateAmount}
          setAmcUpdateAmount={setAmcUpdateAmount}
          amcUpdateError={amcUpdateError}
          amcUpdateLoading={amcUpdateLoading}
          handleUpdateAmcPayment={handleUpdateAmcPayment}
        />

        {/* ── SECTION 3: Service history + service detail modal ── */}
        <ServiceSection
          serviceHistory={serviceHistory}
          historyLoading={historyLoading}
          selectedService={selectedService}
          modalLoading={modalLoading}
          serviceDeleteLoading={serviceDeleteLoading}
          openServiceModal={openServiceModal}
          closeModal={closeModal}
          handleDeleteService={handleDeleteService}
          loadData={loadData}
          selectedServiceId={selectedService?.id}
        />
      </div>
    </div>
  );
};

export default CustomerDetail;
