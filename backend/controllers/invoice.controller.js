import { Invoice } from "../models/invoice.model.js";

export const getInvoices = async (req, res) => {
  try {
    const { customerId, type, paymentStatus, month, year, fromDate, toDate } =
      req.query;

    const query = {
      userId: req.userId,
    };

    // filters
    if (customerId) query.customerId = customerId;
    if (type) query.type = type;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    // date filtering
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      query.invoiceDate = { $gte: start, $lte: end };
    } else if (fromDate || toDate) {
      query.invoiceDate = {};
      if (fromDate) query.invoiceDate.$gte = new Date(fromDate);
      if (toDate) query.invoiceDate.$lte = new Date(toDate);
    }

    const invoices = await Invoice.find(query)
      .sort({ invoiceDate: -1 })
      .populate("customerId", "name phone")
      .lean();

    const formattedInvoices = invoices.map((inv) => ({
      id: inv._id,
      invoiceDate: inv.invoiceDate,
      type: inv.type,

      customer: {
        id: inv.customerId?._id,
        name: inv.customerId?.name,
        phone: inv.customerId?.phone,
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
      count: formattedInvoices.length,
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
