const ENUM_LABELS = {
  serviceType: {
    SCHEDULED: "Scheduled",
    EARLY: "Early",
    EMERGENCY: "Emergency",
  },
  invoiceType: {
    FILTER_SALE: "Filter Sale",
    SERVICE: "Service",
  },
  paymentStatus: {
    PAID: "Paid",
    PARTIAL: "Partial",
    UNPAID: "Unpaid",
    PENDING: "Pending",
    DUE: "Due",
    ACTIVE: "Active",
    COMPLETED: "Completed",
  },
};

const toReadableFallback = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const getEnumLabel = (category, value) => {
  if (!value) return "-";

  const normalizedValue = String(value).toUpperCase();
  const mapped = ENUM_LABELS[category]?.[normalizedValue];

  return mapped || toReadableFallback(value);
};
