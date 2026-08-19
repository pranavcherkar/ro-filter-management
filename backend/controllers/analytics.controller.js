import { Invoice } from "../models/invoice.model.js";
import { Service } from "../models/service.model.js";
import { Customer } from "../models/customer.model.js";

export const getAnalytics = async (req, res) => {
  try {
    const userId = req.userId;
    const now = new Date();

    // 12-month window starting from the 1st of the month 11 months ago
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // ── Parallel queries ──────────────────────────────────────────────────────
    const [
      monthlyRevenueRaw,
      revenueByTypeRaw,
      newCustomersRaw,
      servicesPerMonthRaw,
      serviceTypeRatioRaw,
      topPartsRaw,
      topRoModelsRaw,
      avgServiceChargeRaw,
      customersByTypeRaw,
      activeCount,
      inactiveCount,
      totalRevenue,
      totalPaid,
      amcRenewalsThisMonth,
      overdueCount,
    ] = await Promise.all([
      // 1. Monthly revenue (last 12 months) from invoices
      Invoice.aggregate([
        {
          $match: {
            userId,
            invoiceDate: { $gte: start },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$invoiceDate" },
              month: { $month: "$invoiceDate" },
            },
            revenue: { $sum: "$paidAmount" },
            pending: { $sum: { $subtract: ["$totalAmount", "$paidAmount"] } },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      // 2. Revenue split by invoice type
      Invoice.aggregate([
        { $match: { userId, invoiceDate: { $gte: start } } },
        {
          $group: {
            _id: "$type",
            total: { $sum: "$paidAmount" },
          },
        },
      ]),

      // 3. New customers per month
      Customer.aggregate([
        {
          $match: {
            userId,
            createdAt: { $gte: start },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      // 4. Services per month
      Service.aggregate([
        {
          $match: {
            userId,
            serviceDate: { $gte: start },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$serviceDate" },
              month: { $month: "$serviceDate" },
            },
            count: { $sum: 1 },
            income: { $sum: "$totalServiceAmount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      // 5. Service type ratio
      Service.aggregate([
        { $match: { userId, serviceDate: { $gte: start } } },
        { $group: { _id: "$serviceType", count: { $sum: 1 } } },
      ]),

      // 6. Top replaced parts
      Service.aggregate([
        { $match: { userId, serviceDate: { $gte: start } } },
        { $unwind: "$replacedParts" },
        {
          $group: {
            _id: "$replacedParts.partName",
            count: { $sum: 1 },
            revenue: { $sum: "$replacedParts.price" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // 7. Most serviced RO models
      Service.aggregate([
        { $match: { userId, serviceDate: { $gte: start } } },
        {
          $lookup: {
            from: "customers",
            localField: "customerId",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },
        { $match: { "customer.roModel": { $ne: "" } } },
        {
          $group: {
            _id: "$customer.roModel",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),

      // 8. Average service charge
      Service.aggregate([
        {
          $match: {
            userId,
            serviceDate: { $gte: start },
            serviceCharge: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            avg: { $avg: "$serviceCharge" },
            total: { $sum: "$serviceCharge" },
            count: { $sum: 1 },
          },
        },
      ]),

      // 9. Customer type breakdown
      Customer.aggregate([
        { $match: { userId, isActive: true } },
        { $group: { _id: "$customerType", count: { $sum: 1 } } },
      ]),

      // 10. Active customers count
      Customer.countDocuments({ userId, isActive: true }),

      // 11. Inactive customers count
      Customer.countDocuments({ userId, isActive: false }),

      // 12. Total invoice amounts for collection rate
      Invoice.aggregate([
        { $match: { userId, invoiceDate: { $gte: start } } },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$totalAmount" },
            totalPaid: { $sum: "$paidAmount" },
          },
        },
      ]),

      // 13. Same as totalRevenue — reuse for paid
      Invoice.aggregate([
        { $match: { userId, invoiceDate: { $gte: start } } },
        { $group: { _id: null, totalPaid: { $sum: "$paidAmount" } } },
      ]),

      // 14. AMC renewals due this month
      Customer.countDocuments({
        userId,
        isActive: true,
        "amcContract.endDate": {
          $gte: new Date(now.getFullYear(), now.getMonth(), 1),
          $lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
        },
      }),

      // 15. Overdue count
      Customer.countDocuments({
        userId,
        isActive: true,
        nextServiceDate: {
          $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        },
      }),
    ]);

    // ── Build month labels for the last 12 months ─────────────────────────────
    const MONTHS = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthLabels = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthLabels.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      });
    }

    const fillMonths = (raw, valueKey = "revenue") =>
      monthLabels.map((ml) => {
        const found = raw.find(
          (r) => r._id.year === ml.year && r._id.month === ml.month,
        );
        return {
          month: ml.label,
          [valueKey]: found ? found[valueKey] : 0,
          ...(found || {}),
        };
      });

    // Monthly revenue chart data
    const monthlyRevenue = fillMonths(monthlyRevenueRaw, "revenue").map(
      (m, i) => ({
        month: m.month,
        revenue: Math.round(m.revenue || 0),
        pending: Math.round(
          monthlyRevenueRaw.find(
            (r) =>
              r._id.year === monthLabels[i].year &&
              r._id.month === monthLabels[i].month,
          )?.pending || 0,
        ),
      }),
    );

    // New customers per month
    const newCustomers = fillMonths(newCustomersRaw, "count").map((m) => ({
      month: m.month,
      count: m.count || 0,
    }));

    // Services per month
    const servicesPerMonth = fillMonths(servicesPerMonthRaw, "count").map(
      (m, i) => ({
        month: m.month,
        count: m.count || 0,
        income: Math.round(
          servicesPerMonthRaw.find(
            (r) =>
              r._id.year === monthLabels[i].year &&
              r._id.month === monthLabels[i].month,
          )?.income || 0,
        ),
      }),
    );

    // Revenue by type
       const revenueByType = {
      FILTER_SALE:
        revenueByTypeRaw.find((r) => r._id === "FILTER_SALE")?.total  || 0,
      SERVICE:
        revenueByTypeRaw.find((r) => r._id === "SERVICE")?.total      || 0,
      AMC_PAYMENT:
        revenueByTypeRaw.find((r) => r._id === "AMC_PAYMENT")?.total  || 0,
      PARTS_SALE:
        revenueByTypeRaw.find((r) => r._id === "PARTS_SALE")?.total   || 0,
    };

    // Service type ratio
    const serviceTypeRatio = {
      SCHEDULED:
        serviceTypeRatioRaw.find((r) => r._id === "SCHEDULED")?.count || 0,
      EARLY: serviceTypeRatioRaw.find((r) => r._id === "EARLY")?.count || 0,
      EMERGENCY:
        serviceTypeRatioRaw.find((r) => r._id === "EMERGENCY")?.count || 0,
      AMC_SERVICE:
        serviceTypeRatioRaw.find((r) => r._id === "AMC_SERVICE")?.count || 0,
    };

    // Customer type breakdown
    const customerBreakdown = {
      REGULAR: customersByTypeRaw.find((r) => r._id === "REGULAR")?.count || 0,
      AMC: customersByTypeRaw.find((r) => r._id === "AMC")?.count || 0,
      SERVICE_ONLY:
        customersByTypeRaw.find((r) => r._id === "SERVICE_ONLY")?.count || 0,
    };

    // Collection rate
    const collectionData = totalRevenue[0] || { totalAmount: 0, totalPaid: 0 };
    const collectionRate =
      collectionData.totalAmount > 0
        ? Math.round(
            (collectionData.totalPaid / collectionData.totalAmount) * 100,
          )
        : 0;

    res.status(200).json({
      success: true,
      analytics: {
        monthlyRevenue,
        revenueByType,
        newCustomers,
        servicesPerMonth,
        serviceTypeRatio,
        topParts: topPartsRaw.map((p) => ({
          name: p._id,
          count: p.count,
          revenue: Math.round(p.revenue),
        })),
        topRoModels: topRoModelsRaw.map((m) => ({
          model: m._id,
          count: m.count,
        })),
        avgServiceCharge: Math.round(avgServiceChargeRaw[0]?.avg || 0),
        customerBreakdown,
        activeCount,
        inactiveCount,
        collectionRate,
        collectionData: {
          totalAmount: Math.round(collectionData.totalAmount),
          totalPaid: Math.round(collectionData.totalPaid),
          pending: Math.round(
            collectionData.totalAmount - collectionData.totalPaid,
          ),
        },
        amcRenewalsThisMonth,
        overdueCount,
      },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Failed to load analytics" });
  }
};

// ── Dues list ─────────────────────────────────────────────────────────────────
export const getDues = async (req, res) => {
  try {
    const userId = req.userId;

    // Customers with unpaid/partial filter payments (REGULAR only)
    const customerDues = await Customer.find({
      userId,
      isActive: true,
      customerType: "REGULAR",
      filterPaymentStatus: { $in: ["UNPAID", "PARTIAL"] },
    })
      .select(
        "name phone filterPrice filterPaidAmount filterPaymentStatus roModel address",
      )
      .lean();

    const customerDuesList = customerDues.map((c) => ({
      id: c._id,
      name: c.name,
      phone: c.phone,
      roModel: c.roModel,
      address: c.address,
      filterPrice: c.filterPrice,
      paidAmount: c.filterPaidAmount,
      pendingAmount: c.filterPrice - c.filterPaidAmount,
      status: c.filterPaymentStatus,
      type: "FILTER_SALE",
    }));

    // Invoices with PARTIAL or UNPAID status
    const invoiceDues = await Invoice.find({
      userId,
      paymentStatus: { $in: ["PARTIAL", "UNPAID"] },
    })
      .populate("customerId", "name phone")
      .sort({ invoiceDate: -1 })
      .lean();

    const invoiceDuesList = invoiceDues.map((inv) => ({
      id: inv._id,
      invoiceDate: inv.invoiceDate,
      type: inv.type,
      customerName: inv.customerId?.name || "Unknown",
      customerPhone: inv.customerId?.phone || "-",
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      pendingAmount: inv.totalAmount - inv.paidAmount,
      status: inv.paymentStatus,
    }));

    res.status(200).json({
      success: true,
      dues: {
        customerDues: customerDuesList,
        invoiceDues: invoiceDuesList,
        totalPending: [
          ...customerDuesList.map((c) => c.pendingAmount),
          ...invoiceDuesList.map((i) => i.pendingAmount),
        ].reduce((a, b) => a + b, 0),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to load dues" });
  }
};
