const ENUM_LABELS = {
  serviceType: {
    SCHEDULED: "Scheduled",
    EARLY: "Early",
    EMERGENCY: "Emergency",
  },
  invoiceType: {
    FILTER_SALE: "Filter Sale",
    SERVICE: "Service",
    AMC_PAYMENT: "AMC Payment",
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
  serviceStatus: {
    OK: "On Track",
    UPCOMING: "Due Soon",
    OVERDUE: "Overdue",
    NONE: "Not Set",
  },
  amcStatus: {
    ACTIVE: "Active",
    EXPIRED: "Expired",
    CANCELLED: "Cancelled",
  },
  customerType: {
    REGULAR: "Regular",
    AMC: "AMC",
    SERVICE_ONLY: "Service Only",
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
