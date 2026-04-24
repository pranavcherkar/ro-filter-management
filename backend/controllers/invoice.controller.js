import { Invoice } from "../models/invoice.model.js";
import { Customer } from "../models/customer.model.js";

export const getInvoices = async (req, res) => {
  try {
    const {
      customerName,
      type,
      paymentStatus,
      month,
      year,
      fromDate,
      toDate,
      page = 1,
      limit = 20,
    } = req.query;

    const currentPage = parseInt(page) || 1;
    const perPage = parseInt(limit) || 20;
    const skip = (currentPage - 1) * perPage;

    const query = {
      userId: req.userId,
    };

    // 🔎 Search by customer name (partial, case-insensitive)
    if (customerName) {
      const matchedCustomers = await Customer.find({
        userId: req.userId,
        name: { $regex: customerName, $options: "i" },
      }).select("_id");

      const customerIds = matchedCustomers.map((c) => c._id);

      if (customerIds.length === 0) {
        return res.status(200).json({
          success: true,
          totalItems: 0,
          totalPages: 0,
          currentPage,
          invoices: [],
        });
      }

      query.customerId = { $in: customerIds };
    }

    // Filter by invoice type
    if (type) query.type = type;

    // Filter by payment status
    if (paymentStatus) query.paymentStatus = paymentStatus;

    // Date filtering
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      query.invoiceDate = { $gte: start, $lte: end };
    } else if (fromDate || toDate) {
      query.invoiceDate = {};
      if (fromDate) query.invoiceDate.$gte = new Date(fromDate);
      if (toDate) query.invoiceDate.$lte = new Date(toDate);
    }

    // 🔥 Get total count BEFORE pagination
    const totalItems = await Invoice.countDocuments(query);
    const totalPages = Math.ceil(totalItems / perPage);

    // 🔥 Apply pagination
    const invoices = await Invoice.find(query)
      .sort({ invoiceDate: -1 }) // Latest first
      .skip(skip)
      .limit(perPage)
      .populate("customerId", "name phone customerType amcContract")
      .lean();

    const formattedInvoices = invoices.map((inv) => ({
      id: inv._id,
      invoiceDate: inv.invoiceDate,
      type: inv.type,

      customer: {
        id: inv.customerId?._id,
        name: inv.customerId?.name,
        phone: inv.customerId?.phone,
        customerType: inv.customerId?.customerType || "REGULAR",
        amcContract: inv.customerId?.amcContract
          ? {
              startDate: inv.customerId?.amcContract?.startDate || null,
              endDate: inv.customerId?.amcContract?.endDate || null,
            }
          : null,
      },

      items: inv.items,
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      pendingAmount: inv.totalAmount - inv.paidAmount,
      paymentStatus: inv.paymentStatus,
      referenceId: inv.referenceId,
    }));

    res.status(200).json({
      success: true,
      totalItems,
      totalPages,
      currentPage,
      perPage,
      invoices: formattedInvoices,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch invoices",
    });
  }
};
