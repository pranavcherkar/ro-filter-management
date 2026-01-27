import { Invoice } from "../models/invoice.model.js";
import { Service } from "../models/service.model.js";
import { Customer } from "../models/customer.model.js";

export const getDashboardSummary = async (req, res) => {
  try {
    const userId = req.userId;
    const now = new Date();

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    /* ================= MONEY ================= */

    const invoices = await Invoice.find({
      userId,
      invoiceDate: { $gte: startOfMonth, $lte: endOfMonth },
    }).lean();

    let totalCollected = 0;
    let pendingAmount = 0;
    let filterSales = 0;
    let serviceIncome = 0;

    invoices.forEach((inv) => {
      totalCollected += inv.paidAmount;
      pendingAmount += inv.totalAmount - inv.paidAmount;

      if (inv.type === "FILTER_SALE") {
        filterSales += inv.paidAmount;
      } else if (inv.type === "SERVICE") {
        serviceIncome += inv.paidAmount;
      }
    });

    /* ================= SERVICES ================= */

    const servicesDoneThisMonth = await Service.countDocuments({
      userId,
      serviceDate: { $gte: startOfMonth, $lte: endOfMonth },
    });

    const customers = await Customer.find({
      userId,
      isActive: true,
      nextServiceDate: { $ne: null },
    }).select("nextServiceDate");

    let upcomingServices = 0;
    let overdueServices = 0;

    customers.forEach((c) => {
      const diffDays =
        (new Date(c.nextServiceDate) - now) / (1000 * 60 * 60 * 24);

      if (diffDays < 0) overdueServices++;
      else if (diffDays <= 10) upcomingServices++;
    });

    /* ================= CUSTOMERS ================= */

    const totalActive = await Customer.countDocuments({
      userId,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      summary: {
        month: now.toLocaleString("default", {
          month: "long",
          year: "numeric",
        }),

        money: {
          totalCollected,
          pendingAmount,
          filterSales,
          serviceIncome,
        },

        services: {
          servicesDoneThisMonth,
          upcomingServices,
          overdueServices,
        },

        customers: {
          totalActive,
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to load dashboard summary",
    });
  }
};
