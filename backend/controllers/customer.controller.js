import mongoose from "mongoose";
import { Customer } from "../models/customer.model.js";
import { addMonths } from "../utils/date.utils.js";
import { Invoice } from "../models/invoice.model.js";
import { ROModelInventory } from "../models/roModelInventory.model.js";
import { Service } from "../models/service.model.js";

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

const resolveAmcStatus = (amcContract) => {
  if (!amcContract) return null;

  if (amcContract.status === "CANCELLED") return "CANCELLED";

  if (amcContract.endDate) {
    const now = new Date();
    const endDate = new Date(amcContract.endDate);

    if (endDate < now) return "EXPIRED";
  }

  return "ACTIVE";
};

const normalizeAmcContract = (customerType, amcContractInput) => {
  if (customerType !== "AMC") return null;
  if (
    !amcContractInput ||
    !amcContractInput.startDate ||
    !amcContractInput.endDate
  ) {
    return null;
  }

  const normalized = {
    startDate: new Date(amcContractInput.startDate),
    endDate: new Date(amcContractInput.endDate),
    status: amcContractInput.status || "ACTIVE",
    cancelledAt: null,
    cancellationReason: "",
    notes: amcContractInput.notes || "",
    totalAmcAmount: Number(amcContractInput.totalAmcAmount) || 0,
    paidAmcAmount: Number(amcContractInput.paidAmcAmount) || 0,
  };

  if (normalized.status === "CANCELLED") {
    normalized.cancelledAt = amcContractInput.cancelledAt
      ? new Date(amcContractInput.cancelledAt)
      : new Date();
    normalized.cancellationReason = amcContractInput.cancellationReason || "";
  }

  normalized.status = resolveAmcStatus(normalized);

  return normalized;
};

export const createCustomer = async (req, res) => {
  try {
    const userId = req.userId;

    const {
      name,
      phone,
      address,
      roModel,
      roBodyType,
      customerType = "REGULAR",
      amcContract,
      amcPaymentAmount,
      amcPaymentStatus = "PAID",
      installationDate,
      filterPrice = 0,
      initialPaidAmount = 0,
      lastServiceDate,
      filters,
      serviceCycleMonthsOverride,
      location,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name and phone are required for all customer types",
      });
    }

    if (customerType === "REGULAR") {
      if (!roModel) {
        return res.status(400).json({
          success: false,
          message: "RO model is required for Regular customers",
        });
      }
      if (!installationDate) {
        return res.status(400).json({
          success: false,
          message: "Installation date is required for Regular customers",
        });
      }
    }

    if (customerType === "AMC") {
      if (!amcContract || !amcContract.startDate || !amcContract.endDate) {
        return res.status(400).json({
          success: false,
          message: "AMC customers require contract startDate and endDate",
        });
      }
    }

    const installDateObj = installationDate ? new Date(installationDate) : null;
    const serviceDateObj = lastServiceDate ? new Date(lastServiceDate) : null;

    const price = customerType === "REGULAR" ? Number(filterPrice) || 0 : 0;
    const paid =
      customerType === "REGULAR" ? Number(initialPaidAmount) || 0 : 0;

    const normalizedServiceCycleOverride =
      serviceCycleMonthsOverride == null
        ? null
        : Number(serviceCycleMonthsOverride);

    if (
      normalizedServiceCycleOverride !== null &&
      (!Number.isFinite(normalizedServiceCycleOverride) ||
        normalizedServiceCycleOverride <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "serviceCycleMonthsOverride must be a positive number",
      });
    }

    const resolvedServiceCycleMonths = resolveServiceCycleMonths({
      customerCycleMonthsOverride: normalizedServiceCycleOverride,
      ownerDefaultCycleMonths: req.user?.defaultServiceCycleMonths,
    });

    if (customerType === "REGULAR" && roModel) {
      const roStock = await ROModelInventory.findOne({
        userId,
        modelName: roModel,
      });

      if (!roStock || roStock.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Selected RO model is out of stock",
        });
      }

      roStock.quantity -= 1;
      await roStock.save();
    }

    const baselineDate = serviceDateObj || installDateObj || new Date();

    const initializedFilters = (filters || []).map((f) => ({
      name: f.name,
      intervalMonths: f.intervalMonths,
      lastChangedDate: baselineDate,
    }));

    let nextServiceDate = null;

    if (serviceDateObj) {
      nextServiceDate = addMonths(serviceDateObj, resolvedServiceCycleMonths);
    } else if (installDateObj) {
      const diffDays = (new Date() - installDateObj) / (1000 * 60 * 60 * 24);
      if (diffDays <= 30) {
        nextServiceDate = addMonths(installDateObj, resolvedServiceCycleMonths);
      }
    }

    let paymentStatus = "UNPAID";
    if (price > 0) {
      if (paid >= price) paymentStatus = "PAID";
      else if (paid > 0) paymentStatus = "PARTIAL";
    }

    const customer = await Customer.create({
      userId,
      name,
      phone,
      address,
      roModel: roModel || "",
      roBodyType: roBodyType || "",
      customerType,
      amcContract: normalizeAmcContract(customerType, amcContract),
      installationDate: installDateObj,
      serviceCycleMonthsOverride: normalizedServiceCycleOverride,
      filterPrice: price,
      filterPaidAmount: paid,
      filterPaymentStatus: paymentStatus,
      lastServiceDate: serviceDateObj,
      nextServiceDate,
      filters: initializedFilters,
      location,
    });

    // FILTER_SALE invoice for Regular customers
    if (customerType === "REGULAR" && price > 0) {
      await Invoice.create({
        userId,
        customerId: customer._id,
        type: "FILTER_SALE",
        referenceId: customer._id,
        invoiceDate: installDateObj,
        items: [
          {
            name: `RO Filter (${roModel})`,
            quantity: 1,
            rate: price,
            price,
          },
        ],
        totalAmount: price,
        paidAmount: paid,
        paymentStatus,
      });
    }

    // AMC_PAYMENT invoice if payment was collected at registration
    const amcPaid = Number(amcPaymentAmount) || 0;
    if (customerType === "AMC" && amcPaid > 0) {
      // Map PENDING → UNPAID for invoice schema
      const invoicePaymentStatus =
        amcPaymentStatus === "PENDING" ? "UNPAID" : amcPaymentStatus;

      await Invoice.create({
        userId,
        customerId: customer._id,
        type: "AMC_PAYMENT",
        referenceId: customer._id,
        invoiceDate: new Date(),
        items: [
          {
            name: "AMC Registration Payment",
            quantity: 1,
            rate: amcPaid,
            price: amcPaid,
          },
        ],
        totalAmount: amcPaid,
        paidAmount: amcPaymentStatus === "PAID" ? amcPaid : 0,
        paymentStatus: invoicePaymentStatus,
      });

      await Customer.findByIdAndUpdate(customer._id, {
        "amcContract.lastPaymentAmount": amcPaid,
        "amcContract.lastPaymentDate": new Date(),
      });
    }

    return res.status(201).json({
      success: true,
      message: "Customer created successfully",
      customer,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to create customer",
    });
  }
};

export const updateCustomerPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { paidAmount } = req.body;

    if (!paidAmount || paidAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid paid amount",
      });
    }

    const customer = await Customer.findById(id);

    if (!customer || !customer.isActive) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    customer.filterPaidAmount += paidAmount;

    if (customer.filterPaidAmount >= customer.filterPrice) {
      customer.filterPaidAmount = customer.filterPrice;
      customer.filterPaymentStatus = "PAID";
    } else if (customer.filterPaidAmount > 0) {
      customer.filterPaymentStatus = "PARTIAL";
    } else {
      customer.filterPaymentStatus = "UNPAID";
    }

    await customer.save();

    const invoice = await Invoice.findOne({
      customerId: customer._id,
      type: "FILTER_SALE",
    });

    if (invoice) {
      invoice.paidAmount = customer.filterPaidAmount;
      invoice.paymentStatus = customer.filterPaymentStatus;
      await invoice.save();
    }

    return res.status(200).json({
      success: true,
      message: "Payment updated successfully",
      customer,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to update payment",
    });
  }
};

export const recordAmcPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      amount,
      totalAmcAmount,
      startDate,
      endDate,
      paymentDate,
      notes = "",
      paymentStatus = "PAID",
    } = req.body;

    const paidNow = Number(amount) || 0;
    const totalFee = Number(totalAmcAmount) || paidNow;

    // if (paidNow <= 0) {
    //   return res
    //     .status(400)
    //     .json({ success: false, message: "amount must be positive" });
    // }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required",
      });
    }

    const normalizedStartDate = new Date(startDate);
    const normalizedEndDate = new Date(endDate);
    const normalizedPaymentDate = paymentDate
      ? new Date(paymentDate)
      : new Date();

    if (
      Number.isNaN(normalizedStartDate.getTime()) ||
      Number.isNaN(normalizedEndDate.getTime()) ||
      Number.isNaN(normalizedPaymentDate.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid startDate, endDate, or paymentDate",
      });
    }

    if (normalizedEndDate <= normalizedStartDate) {
      return res.status(400).json({
        success: false,
        message: "endDate must be greater than startDate",
      });
    }

    const customer = await Customer.findOne({
      _id: id,
      userId: req.userId,
      isActive: true,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    if (customer.customerType === "REGULAR") {
      customer.customerType = "AMC";
    }

    customer.amcContract = {
      ...(customer.amcContract ? customer.amcContract.toObject() : {}),
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      status: "ACTIVE",
      cancelledAt: null,
      cancellationReason: "",
      notes: String(notes || customer.amcContract?.notes || ""),
      lastPaymentDate: normalizedPaymentDate,
      lastPaymentAmount: paidNow,
      totalAmcAmount: totalFee,
      // Start fresh paid tracking for this new AMC period
      paidAmcAmount: paidNow,
    };
    customer.amcContract.status = resolveAmcStatus(customer.amcContract);
    await customer.save();

    // Map paymentStatus: PENDING → UNPAID (invoice schema only knows PAID/PARTIAL/UNPAID)
    const invoicePaymentStatus =
      totalFee > 0 && paidNow >= totalFee
        ? "PAID"
        : paidNow > 0
          ? "PARTIAL"
          : "UNPAID";

    const invoice =
      paidNow > 0 || totalFee > 0
        ? await Invoice.create({
            userId: req.userId,
            customerId: customer._id,
            type: "AMC_PAYMENT",
            referenceId: customer._id,
            invoiceDate: normalizedPaymentDate,
            items: [
              {
                name: "AMC Payment",
                quantity: 1,
                rate: totalFee,
                price: totalFee,
              },
            ],
            totalAmount: totalFee,
            paidAmount: paidNow,
            paymentStatus: invoicePaymentStatus,
          })
        : null;

    return res.status(201).json({
      success: true,
      message: "AMC payment recorded successfully",
      customer: {
        ...customer.toObject(),
        amcContract: customer.amcContract
          ? {
              ...customer.amcContract.toObject(),
              status: resolveAmcStatus(customer.amcContract),
            }
          : null,
      },
      invoice,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to record AMC payment",
    });
  }
};

export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const existingCustomer = await Customer.findById(id);

    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const allowedUpdates = [
      "name",
      "phone",
      "address",
      "roModel",
      "roBodyType",
      "customerType",
      "location",
      "isActive",
      "serviceCycleMonthsOverride",
    ];

    const updates = {};

    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        if (key === "serviceCycleMonthsOverride") {
          if (req.body[key] === null) {
            updates[key] = null;
            continue;
          }

          const parsed = Number(req.body[key]);
          if (!Number.isFinite(parsed) || parsed <= 0) {
            return res.status(400).json({
              success: false,
              message: "serviceCycleMonthsOverride must be a positive number",
            });
          }
          updates[key] = parsed;
          continue;
        }
        updates[key] = req.body[key];
      }
    }

    if (
      req.body.amcContract !== undefined ||
      req.body.customerType !== undefined
    ) {
      const effectiveType =
        updates.customerType ||
        req.body.customerType ||
        existingCustomer.customerType;
      const inputContract =
        req.body.amcContract !== undefined
          ? req.body.amcContract
          : existingCustomer.amcContract;

      if (
        effectiveType === "AMC" &&
        (!inputContract || !inputContract.startDate || !inputContract.endDate)
      ) {
        return res.status(400).json({
          success: false,
          message: "AMC customers require contract startDate and endDate",
        });
      }

      updates.amcContract = normalizeAmcContract(effectiveType, inputContract);
    }

    const customer = await Customer.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true },
    );

    res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      customer,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to update customer",
    });
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    const mode = String(
      req.query?.mode || req.body?.mode || "soft",
    ).toLowerCase();

    if (!["soft", "hard"].includes(mode)) {
      return res.status(400).json({
        success: false,
        message: "mode must be either 'soft' or 'hard'",
      });
    }

    const customer = await Customer.findOne({
      _id: id,
      userId: req.userId,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    if (mode === "soft") {
      if (!customer.isActive) {
        return res.status(200).json({
          success: true,
          message: "Customer already inactive",
          mode,
        });
      }

      await Customer.findByIdAndUpdate(id, { $set: { isActive: false } });

      return res.status(200).json({
        success: true,
        message: "Customer marked inactive",
        mode,
      });
    }

    const [servicesResult, invoicesResult] = await Promise.all([
      Service.deleteMany({
        userId: req.userId,
        customerId: customer._id,
      }),
      Invoice.deleteMany({
        userId: req.userId,
        customerId: customer._id,
      }),
    ]);

    if (customer.roModel && customer.customerType !== "SERVICE_ONLY") {
      await ROModelInventory.findOneAndUpdate(
        {
          userId: req.userId,
          modelName: customer.roModel,
        },
        {
          $inc: { quantity: 1 },
          $setOnInsert: { isActive: true },
        },
        {
          upsert: true,
          new: true,
        },
      );
    }

    await Customer.deleteOne({ _id: customer._id });

    return res.status(200).json({
      success: true,
      message: "Customer permanently deleted",
      mode,
      deleted: {
        services: servicesResult.deletedCount || 0,
        invoices: invoicesResult.deletedCount || 0,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete customer",
    });
  }
};

export const getCustomers = async (req, res) => {
  try {
    const {
      search,
      status = "active",
      paymentStatus,
      serviceStatus,
      customerType,
      amcStatus,
      page = 1,
      limit = 20,
    } = req.query;

    const currentPage = parseInt(page) || 1;
    const perPage = Math.min(parseInt(limit) || 20, 500);
    const skip = (currentPage - 1) * perPage;

    const query = { userId: req.userId };

    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;

    if (paymentStatus) query.filterPaymentStatus = paymentStatus;
    if (customerType) query.customerType = customerType;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    if (serviceStatus) {
      const today = new Date();
      const tenDaysFromNow = new Date(
        today.getTime() + 10 * 24 * 60 * 60 * 1000,
      );

      if (serviceStatus === "OVERDUE") {
        query.nextServiceDate = { $lt: today };
      } else if (serviceStatus === "UPCOMING") {
        query.nextServiceDate = { $gte: today, $lte: tenDaysFromNow };
      } else if (serviceStatus === "OK") {
        query.nextServiceDate = { $gt: tenDaysFromNow };
      } else if (serviceStatus === "NONE") {
        query.nextServiceDate = { $exists: false };
      }
    }

    if (amcStatus) {
      const today = new Date();
      if (amcStatus === "ACTIVE") {
        query["amcContract.status"] = "ACTIVE";
        query["amcContract.endDate"] = { $gte: today };
      } else if (amcStatus === "EXPIRED") {
        query["amcContract.endDate"] = { $lt: today };
      } else if (amcStatus === "CANCELLED") {
        query["amcContract.status"] = "CANCELLED";
      }
    }

    const totalItems = await Customer.countDocuments(query);
    const totalPages = Math.ceil(totalItems / perPage);

    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage);

    const today = new Date();
    const tenDaysFromNow = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000);

    const formattedCustomers = customers.map((c) => {
      let serviceStatusComputed = "NONE";
      let daysRemaining = null;
      const amcStatusComputed = resolveAmcStatus(c.amcContract);

      if (c.nextServiceDate) {
        const diff =
          (new Date(c.nextServiceDate) - today) / (1000 * 60 * 60 * 24);
        daysRemaining = Math.ceil(diff);

        if (daysRemaining < 0) serviceStatusComputed = "OVERDUE";
        else if (new Date(c.nextServiceDate) <= tenDaysFromNow)
          serviceStatusComputed = "UPCOMING";
        else serviceStatusComputed = "OK";
      }

      return {
        id: c._id,
        name: c.name,
        phone: c.phone,
        address: c.address,
        roModel: c.roModel,
        serviceCycleMonthsOverride: c.serviceCycleMonthsOverride,
        customerType: c.customerType,
        amcContract: c.amcContract
          ? { ...c.amcContract.toObject(), status: amcStatusComputed }
          : null,
        filterPaymentStatus: c.filterPaymentStatus,
        filterPrice: c.filterPrice,
        filterPaidAmount: c.filterPaidAmount,
        nextServiceDate: c.nextServiceDate,
        serviceStatus: serviceStatusComputed,
        daysRemaining,
        location: c.location,
        isActive: c.isActive,
      };
    });

    res.status(200).json({
      success: true,
      totalItems,
      totalPages,
      currentPage,
      perPage,
      count: formattedCustomers.length,
      customers: formattedCustomers,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
    });
  }
};

export const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const customer = await Customer.findOne({ _id: id, userId });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    let serviceStatus = "NONE";
    let daysRemaining = null;

    if (customer.nextServiceDate) {
      const diff =
        (new Date(customer.nextServiceDate) - new Date()) /
        (1000 * 60 * 60 * 24);

      daysRemaining = Math.ceil(diff);

      if (daysRemaining < 0) serviceStatus = "OVERDUE";
      else if (daysRemaining <= 10) serviceStatus = "UPCOMING";
      else serviceStatus = "OK";
    }

    const services = await Service.find({ customerId: customer._id })
      .sort({ serviceDate: -1 })
      .select("serviceDate serviceType totalServiceAmount")
      .limit(20);

    res.status(200).json({
      success: true,
      customer: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        isActive: customer.isActive,
        roModel: customer.roModel,
        roBodyType: customer.roBodyType,
        serviceCycleMonthsOverride: customer.serviceCycleMonthsOverride,
        customerType: customer.customerType,
        amcContract: customer.amcContract
          ? {
              ...customer.amcContract.toObject(),
              status: resolveAmcStatus(customer.amcContract),
            }
          : null,
        installationDate: customer.installationDate,
        location: customer.location,
        payment: {
          filterPrice: customer.filterPrice,
          paidAmount: customer.filterPaidAmount,
          pendingAmount: customer.filterPrice - customer.filterPaidAmount,
          status: customer.filterPaymentStatus,
        },
        service: {
          lastServiceDate: customer.lastServiceDate,
          nextServiceDate: customer.nextServiceDate,
          serviceStatus,
          daysRemaining,
        },
        filters: customer.filters,
        serviceHistory: services,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer details",
    });
  }
};

export const updateAmcPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { additionalPaidAmount } = req.body;

    const extra = Number(additionalPaidAmount);
    if (!Number.isFinite(extra) || extra <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid amount" });
    }

    const customer = await Customer.findOne({
      _id: id,
      userId: req.userId,
      isActive: true,
    });
    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }
    if (!customer.amcContract) {
      return res
        .status(400)
        .json({ success: false, message: "No AMC contract found" });
    }

    const currentPaid = customer.amcContract.paidAmcAmount || 0;
    const totalFee = customer.amcContract.totalAmcAmount || 0;
    const newPaid =
      totalFee > 0
        ? Math.min(currentPaid + extra, totalFee)
        : currentPaid + extra;

    customer.amcContract.paidAmcAmount = newPaid;
    customer.amcContract.lastPaymentAmount = extra;
    customer.amcContract.lastPaymentDate = new Date();
    await customer.save();

    // ── Find the existing unpaid/partial AMC invoice and UPDATE it ──
    // This mirrors how Regular filter payment works (one invoice, updated in place)
    const existingInvoice = await Invoice.findOne({
      userId: req.userId,
      customerId: customer._id,
      type: "AMC_PAYMENT",
      paymentStatus: { $in: ["PARTIAL", "UNPAID"] },
    }).sort({ invoiceDate: -1 }); // most recent outstanding invoice

    if (existingInvoice) {
      const newInvoicePaid = Math.min(
        (existingInvoice.paidAmount || 0) + extra,
        existingInvoice.totalAmount,
      );
      existingInvoice.paidAmount = newInvoicePaid;
      existingInvoice.paymentStatus =
        newInvoicePaid >= existingInvoice.totalAmount ? "PAID" : "PARTIAL";
      await existingInvoice.save();
    }

    const remaining = Math.max(0, totalFee - newPaid);

    return res.status(200).json({
      success: true,
      message: "AMC payment updated",
      amcContract: {
        ...customer.amcContract.toObject(),
        status: resolveAmcStatus(customer.amcContract),
        remainingAmount: remaining,
      },
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update AMC payment" });
  }
};
