import { Customer } from "../models/customer.model.js";
import { Service } from "../models/service.model.js";
import { Invoice } from "../models/invoice.model.js";
import { addMonths } from "../utils/date.utils.js";

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

    // 1. Calculate service amount
    const totalPartsAmount = replacedParts.reduce(
      (sum, p) => sum + (p.price || 0),
      0,
    );

    const totalServiceAmount = totalPartsAmount + serviceCharge;

    // 2. Create service record
    const service = await Service.create({
      userId,
      customerId,
      serviceDate: actualServiceDate,
      serviceType,
      affectsServiceCycle,
      replacedParts,
      serviceCharge,
      totalServiceAmount,
    });

    // 3. Update customer ONLY if service affects cycle
    if (affectsServiceCycle) {
      if (replacedParts.length > 0) {
        customer.filters = customer.filters.map((filter) => {
          const replaced = replacedParts.find(
            (p) => p.partName === filter.name,
          );

          if (replaced) {
            return {
              ...filter.toObject(),
              lastChangedDate: actualServiceDate,
            };
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
          : addMonths(actualServiceDate, 6);
    }

    await customer.save();

    // 4. CREATE SERVICE INVOICE (THIS WAS MISSING)
    const invoiceItems = [];

    replacedParts.forEach((p) => {
      invoiceItems.push({
        name: p.partName,
        price: p.price || 0,
      });
    });

    if (serviceCharge > 0) {
      invoiceItems.push({
        name: "Service Charge",
        price: serviceCharge,
      });
    }

    if (totalServiceAmount > 0) {
      await Invoice.create({
        userId,
        customerId,
        type: "SERVICE",
        referenceId: service._id,
        items: invoiceItems,
        totalAmount: totalServiceAmount,
        paidAmount: totalServiceAmount, // assume paid immediately
        paymentStatus: "PAID",
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

////get all services
export const getAllServices = async (req, res) => {
  try {
    const { customerId, fromDate, toDate, serviceType, month, year } =
      req.query;

    const query = {
      userId: req.userId,
    };

    // filter by customer
    if (customerId) {
      query.customerId = customerId;
    }

    // filter by service type
    if (serviceType) {
      query.serviceType = serviceType;
    }

    // date filtering
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);

      query.serviceDate = { $gte: start, $lte: end };
    } else if (fromDate || toDate) {
      query.serviceDate = {};

      if (fromDate) query.serviceDate.$gte = new Date(fromDate);
      if (toDate) query.serviceDate.$lte = new Date(toDate);
    }

    const services = await Service.find(query)
      .sort({ serviceDate: -1 })
      .populate("customerId", "name phone")
      .lean();

    // format response (lightweight)
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
      count: formatted.length,
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
