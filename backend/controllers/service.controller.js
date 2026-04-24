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
    const owner = await User.findById(customer.userId).select(
      "defaultServiceCycleMonths",
    );
    const resolvedServiceCycleMonths = resolveServiceCycleMonths({
      customerCycleMonthsOverride: customer.serviceCycleMonthsOverride,
      ownerDefaultCycleMonths: owner?.defaultServiceCycleMonths,
    });

    // 1️⃣ Calculate service amount
    const totalPartsAmount = replacedParts.reduce(
      (sum, p) => sum + (p.price || 0),
      0,
    );

    const totalServiceAmount = totalPartsAmount + serviceCharge;

    // 2️⃣ Create service record
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

    // 3️⃣ 🔻 Deduct parts inventory (DO NOT BLOCK SERVICE)
    for (const part of replacedParts) {
      const inventoryItem = await InventoryItem.findOne({
        userId,
        name: part.partName,
      });

      if (inventoryItem) {
        inventoryItem.quantity -= 1; // allow negative
        await inventoryItem.save();
      }
    }

    // 4️⃣ Update customer service cycle if required
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
          : addMonths(actualServiceDate, resolvedServiceCycleMonths);
    }

    await customer.save();

    // 5️⃣ Create SERVICE invoice
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
        paidAmount: totalServiceAmount, // assumed paid
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

    const query = {
      userId: req.userId,
    };

    // 🔎 Search by customer name
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

    // Filter by service type
    if (serviceType) {
      query.serviceType = serviceType;
    }

    // Date filtering
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      query.serviceDate = { $gte: start, $lte: end };
    } else if (fromDate || toDate) {
      query.serviceDate = {};
      if (fromDate) query.serviceDate.$gte = new Date(fromDate);
      if (toDate) query.serviceDate.$lte = new Date(toDate);
    }

    // 🔥 Get total count before pagination
    const totalItems = await Service.countDocuments(query);
    const totalPages = Math.ceil(totalItems / perPage);

    // 🔥 Apply pagination
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
// // get service by id
// import { Service } from "../models/service.model.js";

export const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate Mongo ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
    }

    const service = await Service.findOne({
      _id: id,
      userId: req.userId, // 🔐 security check
    })
      .populate("customerId", "name phone address roModel")
      .lean();

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Format response
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

//get services by customer id
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
