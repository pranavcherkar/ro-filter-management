// utils/date.utils.js

/**
 * Safely add months to a date
 * Handles month overflow correctly
 */
export const addMonths = (date, months) => {
  if (!date) return null;
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

/**
 * Get number of days remaining from today to target date
 * Returns:
 *  - positive number → days left
 *  - 0 → today
 *  - negative number → overdue
 */
export const getDaysRemaining = (targetDate) => {
  if (!targetDate) return null;
  const today = new Date();
  const diffMs = new Date(targetDate) - today;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Resolve service status from nextServiceDate
 * Business rule:
 *  - null → NONE
 *  - < 0 days → OVERDUE
 *  - 0–10 days → UPCOMING
 *  - > 10 days → OK
 */
export const getServiceStatus = (nextServiceDate) => {
  if (!nextServiceDate) {
    return {
      status: "NONE",
      daysRemaining: null,
    };
  }

  const daysRemaining = getDaysRemaining(nextServiceDate);

  if (daysRemaining < 0) {
    return { status: "OVERDUE", daysRemaining };
  }

  if (daysRemaining <= 10) {
    return { status: "UPCOMING", daysRemaining };
  }

  return { status: "OK", daysRemaining };
};

/**
 * Get start and end date of a month
 * Used in dashboard, invoices, analytics
 */
export const getMonthRange = (month, year) => {
  if (!month || !year) return null;

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  return { startDate, endDate };
};
