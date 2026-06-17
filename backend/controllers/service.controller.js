import { Customer } from "../models/customer.model.js";
import { Service } from "../models/service.model.js";
import { Invoice } from "../models/invoice.model.js";
import { addMonths } from "../utils/date.utils.js";
import { InventoryItem } from "../models/inventoryItem.model.js";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";

const FALLBACK_SERVICE_CYCLE_MONTHS = 6;

const resolveServiceCycleMonths = ({
  customerCycleMonthsOverride,
  ownerDefaultCycleMonths,
}) => {
  const parsedOverride = Number(customerCycleMonthsOverride);
  if (Number.isFinite(parsedOverride) && parsedOverride > 0) {
    return parsedOverride;
  }

  const parsedOwnerDefault = Number(ownerDefaultCycleMonths);
  if (Number.isFinite(parsedOwnerDefault) && parsedOwnerDefault > 0) {
    return parsedOwnerDefault;
  }

  return FALLBACK_SERVICE_CYCLE_MONTHS;
};

// Service chargePaymentStatus uses "PENDING"; Invoice paymentStatus uses "UNPAID".
// Always run through this before writing to an Invoice doc.
const toInvoiceStatus = (chargeStatus) => {
  if (chargeStatus === "PENDING") return "UNPAID";
  return chargeStatus; // "PAID" | "PARTIAL" — valid in both enums
};

const recomputeCustomerServiceSchedule = async (
  customer,
  ownerDefaultCycleMonths,
) => {
  const resolvedServiceCycleMonths = resolveServiceCycleMonths({
    customerCycleMonthsOverride: customer.serviceCycleMonthsOverride,
    ownerDefaultCycleMonths,
  });

  const baselineDate = customer.installationDate
    ? new Date(customer.installationDate)
    : new Date();

  const recalculatedFilters = customer.filters.map((filter) => ({
    ...filter.toObject(),
    lastChangedDate: baselineDate,
  }));

  const serviceHistory = await Service.find({
    userId: customer.userId,
    customerId: customer._id,
    affectsServiceCycle: true,
  })
    .sort({ serviceDate: 1 })
    .select("serviceDate replacedParts")
    .lean();

  serviceHistory.forEach((service) => {
    const serviceDate = new Date(service.serviceDate);
    recalculatedFilters.forEach((filter) => {
      const wasFilterReplaced = service.replacedParts?.some(
        (part) => part.partName === filter.name,
      );

      if (wasFilterReplaced) {
        filter.lastChangedDate = serviceDate;
      }
    });
  });

  const latestService = serviceHistory[serviceHistory.length - 1] || null;

  customer.filters = recalculatedFilters;
  customer.lastServiceDate = latestService
    ? new Date(latestService.serviceDate)
    : null;

  const nextDates = recalculatedFilters.map((filter) =>
    addMonths(filter.lastChangedDate, filter.intervalMonths),
  );

  if (nextDates.length > 0) {
    customer.nextServiceDate = new Date(Math.min(...nextDates));
  } else if (customer.lastServiceDate) {
    customer.nextServiceDate = addMonths(
      customer.lastServiceDate,
      resolvedServiceCycleMonths,
    );
  } else {
    customer.nextServiceDate = addMonths(
      baselineDate,
      resolvedServiceCycleMonths,
    );
  }
};

export const createService = async (req, res) => {
  try {
    const userId = req.userId;

    const {
      customerId,
      serviceDate,
      serviceType = "SCHEDULED",
      affectsServiceCycle = true,
      replacedParts = [],
      serviceCharge = 0,
      chargePaymentStatus = "PAID",
      chargePaidAmount: rawChargePaid,
    } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required",
      });
    }

    const customer = await Customer.findById(customerId);

    if (!customer || !customer.isActive) {
      return res.status(404).json({
        success: false,
        message: "Customer not found or inactive",
      });
    }

    const actualServiceDate = serviceDate ? new Date(serviceDate) : new Date();
    const owner = await User.findById(customer.userId).select(
      "defaultServiceCycleMonths",
    );
    const resolvedServiceCycleMonths = resolveServiceCycleMonths({
      customerCycleMonthsOverride: customer.serviceCycleMonthsOverride,
      ownerDefaultCycleMonths: owner?.defaultServiceCycleMonths,
    });

    // Calculate amounts
    const totalPartsAmount = replacedParts.reduce(
      (sum, p) => sum + (p.price || 0) * (p.quantity || 1),
      0,
    );
    const totalServiceAmount = totalPartsAmount + serviceCharge;

    // How much was actually paid right now
    const resolvedChargePaid = (() => {
      if (chargePaymentStatus === "PAID") return totalServiceAmount;
      if (chargePaymentStatus === "PARTIAL") {
        const p = Number(rawChargePaid);
        return Number.isFinite(p) && p > 0
          ? Math.min(p, totalServiceAmount)
          : 0;
      }
      return 0; // PENDING — nothing collected yet
    })();

    // Create service record
    const service = await Service.create({
      userId,
      customerId,
      serviceDate: actualServiceDate,
      serviceType,
      affectsServiceCycle,
      replacedParts,
      serviceCharge,
      totalServiceAmount,
      chargePaymentStatus,
      chargePaidAmount: resolvedChargePaid,
    });

    // Deduct parts inventory (non-blocking)
    for (const part of replacedParts) {
      const inventoryItem = await InventoryItem.findOne({
        userId,
        name: part.partName,
      });
      if (inventoryItem) {
        inventoryItem.quantity -= part.quantity || 1;
        await inventoryItem.save();
      }
    }

    // Update customer service cycle
    if (affectsServiceCycle) {
      if (replacedParts.length > 0) {
        customer.filters = customer.filters.map((filter) => {
          const replaced = replacedParts.find(
            (p) => p.partName === filter.name,
          );
          if (replaced) {
            return { ...filter.toObject(), lastChangedDate: actualServiceDate };
          }
          return filter;
        });
      }

      customer.lastServiceDate = actualServiceDate;

      const nextDates = customer.filters.map((f) =>
        addMonths(f.lastChangedDate, f.intervalMonths),
      );

      customer.nextServiceDate =
        nextDates.length > 0
          ? new Date(Math.min(...nextDates))
          : addMonths(actualServiceDate, resolvedServiceCycleMonths);
    }

    await customer.save();

    // Create SERVICE invoice only when there is money involved
    if (totalServiceAmount > 0) {
      const invoiceItems = [];

      replacedParts.forEach((p) => {
        const qty = p.quantity || 1;
        const rate = p.price || 0;

        invoiceItems.push({
          name: p.partName,
          quantity: qty,
          rate,
          price: qty * rate,
        });
      });

      if (serviceCharge > 0) {
        invoiceItems.push({
          name: "Service Charge",
          quantity: 1,
          rate: serviceCharge,
          price: serviceCharge,
        });
      }

      await Invoice.create({
        userId,
        customerId,
        type: "SERVICE",
        referenceId: service._id,
        items: invoiceItems,
        totalAmount: totalServiceAmount,
        paidAmount: resolvedChargePaid,
        // ← Invoice schema only knows PAID / PARTIAL / UNPAID — map PENDING→UNPAID
        paymentStatus: toInvoiceStatus(chargePaymentStatus),
        invoiceDate: actualServiceDate,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Service recorded successfully",
      service,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to record service",
    });
  }
};

export const getAllServices = async (req, res) => {
  try {
    const {
      customerName,
      fromDate,
      toDate,
      serviceType,
      month,
      year,
      page = 1,
      limit = 10,
    } = req.query;

    const currentPage = parseInt(page) || 1;
    const perPage = parseInt(limit) || 10;
    const skip = (currentPage - 1) * perPage;

    const query = { userId: req.userId };

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
          services: [],
        });
      }

      query.customerId = { $in: customerIds };
    }

    if (serviceType) {
      query.serviceType = serviceType;
    }

    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      query.serviceDate = { $gte: start, $lte: end };
    } else if (fromDate || toDate) {
      query.serviceDate = {};
      if (fromDate) query.serviceDate.$gte = new Date(fromDate);
      if (toDate) query.serviceDate.$lte = new Date(toDate);
    }

    const totalItems = await Service.countDocuments(query);
    const totalPages = Math.ceil(totalItems / perPage);

    const services = await Service.find(query)
      .sort({ serviceDate: -1 })
      .skip(skip)
      .limit(perPage)
      .populate("customerId", "name phone")
      .lean();

    const formatted = services.map((s) => ({
      id: s._id,
      serviceDate: s.serviceDate,
      serviceType: s.serviceType,
      customer: {
        id: s.customerId?._id,
        name: s.customerId?.name,
        phone: s.customerId?.phone,
      },
      serviceCharge: s.serviceCharge,
      replacedParts: s.replacedParts,
      totalServiceAmount: s.totalServiceAmount,
    }));

    res.status(200).json({
      success: true,
      totalItems,
      totalPages,
      currentPage,
      perPage,
      services: formatted,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch services",
    });
  }
};

export const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
    }

    const service = await Service.findOne({
      _id: id,
      userId: req.userId,
    })
      .populate("customerId", "name phone address roModel")
      .lean();

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const formattedService = {
      id: service._id,
      serviceDate: service.serviceDate,
      serviceType: service.serviceType,
      customer: {
        id: service.customerId?._id,
        name: service.customerId?.name,
        phone: service.customerId?.phone,
        address: service.customerId?.address,
        roModel: service.customerId?.roModel,
      },
      chargePaymentStatus: service.chargePaymentStatus || "PAID",
      // Bug fix: don't fall back to totalServiceAmount when 0 — that hides PENDING state
      chargePaidAmount: service.chargePaidAmount ?? 0,
      serviceCharge: service.serviceCharge,
      replacedParts: service.replacedParts,
      totalServiceAmount: service.totalServiceAmount,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };

    res.status(200).json({
      success: true,
      service: formattedService,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch service",
    });
  }
};

export const getServicesByCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    const services = await Service.find({
      customerId,
      userId: req.userId,
    })
      .sort({ serviceDate: -1 })
      .select(
        "serviceDate serviceType serviceCharge replacedParts totalServiceAmount",
      )
      .lean();

    const formatted = services.map((s) => ({
      id: s._id,
      date: s.serviceDate,
      type: s.serviceType,
      serviceCharge: s.serviceCharge,
      replacedParts: s.replacedParts,
      amount: s.totalServiceAmount,
    }));

    return res.status(200).json({
      success: true,
      count: formatted.length,
      services: formatted,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch service history",
    });
  }
};

export const updateServicePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { additionalPaidAmount } = req.body;

    const extra = Number(additionalPaidAmount);
    if (!Number.isFinite(extra) || extra <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid amount" });
    }

    const service = await Service.findOne({ _id: id, userId: req.userId });
    if (!service) {
      return res
        .status(404)
        .json({ success: false, message: "Service not found" });
    }

    const newPaid = (service.chargePaidAmount || 0) + extra;
    const capped = Math.min(newPaid, service.totalServiceAmount);

    service.chargePaidAmount = capped;
    service.chargePaymentStatus =
      capped >= service.totalServiceAmount ? "PAID" : "PARTIAL";
    await service.save();

    // Update linked invoice — both enums share PAID and PARTIAL so no mapping needed
    const invoice = await Invoice.findOne({
      referenceId: service._id,
      type: "SERVICE",
    });
    if (invoice) {
      invoice.paidAmount = capped;
      invoice.paymentStatus = service.chargePaymentStatus; // "PAID" | "PARTIAL"
      await invoice.save();
    }

    return res.status(200).json({
      success: true,
      message: "Payment updated",
      service,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update payment" });
  }
};

export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
    }

    const service = await Service.findOne({
      _id: id,
      userId: req.userId,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const customer = await Customer.findOne({
      _id: service.customerId,
      userId: req.userId,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found for this service",
      });
    }

    await Service.deleteOne({ _id: service._id });

    await Invoice.deleteMany({
      userId: req.userId,
      customerId: customer._id,
      type: "SERVICE",
      referenceId: service._id,
    });

    const owner = await User.findById(customer.userId).select(
      "defaultServiceCycleMonths",
    );

    await recomputeCustomerServiceSchedule(
      customer,
      owner?.defaultServiceCycleMonths,
    );
    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Service deleted successfully",
      customerService: {
        lastServiceDate: customer.lastServiceDate,
        nextServiceDate: customer.nextServiceDate,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete service",
    });
  }
};
