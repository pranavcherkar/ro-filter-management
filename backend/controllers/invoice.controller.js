import { Invoice } from "../models/invoice.model.js";
import { Customer } from "../models/customer.model.js";
import { Service } from "../models/service.model.js";
import mongoose from "mongoose";

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

export const deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice ID",
      });
    }

    const invoice = await Invoice.findOne({
      _id: id,
      userId: req.userId,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const customer = await Customer.findOne({
      _id: invoice.customerId,
      userId: req.userId,
    });

    if (!customer) {
      return res.status(409).json({
        success: false,
        message: "Invoice customer mismatch or missing. Cannot delete safely.",
      });
    }
    ///////

    // If this is a SERVICE invoice and a linked service record still exists,
    // cascade-delete the service too — same way deleteService already deletes
    // its invoice. This makes the relationship symmetrical: you can approach
    // from either direction.
    if (invoice.type === "SERVICE") {
      const linkedService = await Service.findOne({
        _id: invoice.referenceId,
        customerId: invoice.customerId,
        userId: req.userId,
      });

      if (linkedService) {
        await Service.deleteOne({ _id: linkedService._id });
      }
    }

    //////
    if (
      ["FILTER_SALE", "AMC_PAYMENT"].includes(invoice.type) &&
      String(invoice.referenceId) !== String(invoice.customerId)
    ) {
      return res.status(409).json({
        success: false,
        message: "Invoice reference integrity check failed.",
      });
    }

    if (invoice.type === "FILTER_SALE" && customer.isActive) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete active customer's filter sale invoice. Archive or delete customer first.",
      });
    }

    if (
      invoice.type === "AMC_PAYMENT" &&
      customer.amcContract?.lastPaymentDate &&
      customer.amcContract?.lastPaymentAmount
    ) {
      const isLatestPaymentRecord =
        new Date(customer.amcContract.lastPaymentDate).getTime() ===
          new Date(invoice.invoiceDate).getTime() &&
        Number(customer.amcContract.lastPaymentAmount) ===
          Number(invoice.paidAmount);

      if (isLatestPaymentRecord) {
        return res.status(409).json({
          success: false,
          message:
            "Cannot delete latest AMC payment invoice while contract references it.",
        });
      }
    }

    await Invoice.deleteOne({
      _id: invoice._id,
      userId: req.userId,
    });

    return res.status(200).json({
      success: true,
      message: "Invoice deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete invoice",
    });
  }
};
