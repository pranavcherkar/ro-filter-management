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
// helper to add months safely
// const addMonths = (date, months) => {
//   const d = new Date(date);
//   d.setMonth(d.getMonth() + months);
//   return d;
// };

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
      installationDate,
      filterPrice = 0,
      initialPaidAmount = 0, // ✅ match frontend
      lastServiceDate,
      filters,
      serviceCycleMonthsOverride,
      location,
    } = req.body;

    //  Basic validation
    // SERVICE_ONLY customers own their machine — roModel is optional for them.

    const roModelRequired = customerType !== "SERVICE_ONLY";

    if (!name || !phone || !installationDate || (roModelRequired && !roModel)) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    if (
      customerType === "AMC" &&
      (!amcContract || !amcContract.startDate || !amcContract.endDate)
    ) {
      return res.status(400).json({
        success: false,
        message: "AMC customers require contract startDate and endDate",
      });
    }

    // Convert safely
    const price = Number(filterPrice) || 0;
    const paid = Number(initialPaidAmount) || 0;

    const installDateObj = new Date(installationDate);
    const serviceDateObj = lastServiceDate ? new Date(lastServiceDate) : null;
    const normalizedServiceCycleOverride =
      serviceCycleMonthsOverride === undefined ||
      serviceCycleMonthsOverride === null
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

    // 2️⃣ Check RO model stock (skip for SERVICE_ONLY — they own their machine)
    if (customerType !== "SERVICE_ONLY") {
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

    // 3️⃣ Initialize filters
    const initializedFilters = (filters || []).map((f) => ({
      name: f.name,
      intervalMonths: f.intervalMonths,
      lastChangedDate: serviceDateObj || installDateObj,
    }));

    // 4️⃣ Decide nextServiceDate
    let nextServiceDate = null;

    if (serviceDateObj) {
      nextServiceDate = addMonths(serviceDateObj, resolvedServiceCycleMonths);
    } else {
      const now = new Date();
      const diffDays = (now - installDateObj) / (1000 * 60 * 60 * 24);

      if (diffDays <= 30) {
        nextServiceDate = addMonths(installDateObj, resolvedServiceCycleMonths);
      }
    }

    // 5️⃣ Decide payment status
    let paymentStatus = "UNPAID";

    if (paid >= price && price > 0) {
      paymentStatus = "PAID";
    } else if (paid > 0 && paid < price) {
      paymentStatus = "PARTIAL";
    }

    // 6️⃣ Create customer
    const customer = await Customer.create({
      userId,
      name,
      phone,
      address,
      roModel,
      roBodyType,
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

    // 7️⃣ Create FILTER_SALE invoice
    if (price > 0) {
      await Invoice.create({
        userId,
        customerId: customer._id,
        type: "FILTER_SALE",
        referenceId: customer._id,
        invoiceDate: installDateObj, // ✅ correct business date
        items: [
          {
            name: `RO Filter (${roModel})`,
            price: price,
          },
        ],
        totalAmount: price,
        paidAmount: paid,
        paymentStatus,
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
// update payment of customer///////
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

    // 1. Update customer paid amount
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

    // 2. Update existing FILTER_SALE invoice (THIS WAS MISSING)
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
    const { amount, startDate, endDate, paymentDate, notes = "" } = req.body;

    const paidAmount = Number(amount);
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "amount must be a positive number",
      });
    }

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

    customer.customerType = "AMC";
    customer.amcContract = {
      ...(customer.amcContract ? customer.amcContract.toObject() : {}),
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      status: "ACTIVE",
      cancelledAt: null,
      cancellationReason: "",
      notes:
        notes !== undefined && notes !== null
          ? String(notes)
          : customer.amcContract?.notes || "",
      lastPaymentDate: normalizedPaymentDate,
      lastPaymentAmount: paidAmount,
    };

    customer.amcContract.status = resolveAmcStatus(customer.amcContract);

    await customer.save();

    const invoice = await Invoice.create({
      userId: req.userId,
      customerId: customer._id,
      type: "AMC_PAYMENT",
      referenceId: customer._id,
      invoiceDate: normalizedPaymentDate,
      items: [
        {
          name: "AMC Payment",
          price: paidAmount,
        },
      ],
      totalAmount: paidAmount,
      paidAmount,
      paymentStatus: "PAID",
    });

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

//////////////////////////////////////////
//////////////////////////////////////////
//////////////////////////////////////////
//////////////////////////////////////////

export const getCustomers = async (req, res) => {
  try {
    // console.log("getting all customers");
    const {
      search,
      status = "active",
      paymentStatus,
      serviceStatus,
      customerType,
      amcStatus,
    } = req.query;

    const query = {
      userId: req.userId,
    };

    // active / inactive filter
    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;

    // payment status filter
    if (paymentStatus) {
      query.filterPaymentStatus = paymentStatus;
    }

    if (customerType) {
      query.customerType = customerType;
    }

    // search by name or phone
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const customers = await Customer.find(query).sort({ createdAt: -1 });

    const today = new Date();

    const formattedCustomers = customers.map((c) => {
      let serviceStatusComputed = "NONE";
      let daysRemaining = null;
      const amcStatusComputed = resolveAmcStatus(c.amcContract);

      if (c.nextServiceDate) {
        const diff =
          (new Date(c.nextServiceDate) - today) / (1000 * 60 * 60 * 24);

        daysRemaining = Math.ceil(diff);

        if (daysRemaining < 0) serviceStatusComputed = "OVERDUE";
        else if (daysRemaining <= 10) serviceStatusComputed = "UPCOMING";
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

    // optional serviceStatus filter (after computation)
    let finalCustomers = serviceStatus
      ? formattedCustomers.filter((c) => c.serviceStatus === serviceStatus)
      : formattedCustomers;

    if (amcStatus) {
      finalCustomers = finalCustomers.filter(
        (c) => c.amcContract?.status === amcStatus,
      );
    }

    res.status(200).json({
      success: true,
      count: finalCustomers.length,
      customers: finalCustomers,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
    });
  }
};
///// get one customer
// import { Customer } from "../models/customer.model.js";

export const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // 1. Fetch customer
    const customer = await Customer.findOne({
      _id: id,
      userId,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // 2. Compute service status
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

    // 3. Fetch service history (latest first, lightweight)
    const services = await Service.find({
      customerId: customer._id,
    })
      .sort({ serviceDate: -1 })
      .select("serviceDate serviceType totalServiceAmount")
      .limit(20);

    // 4. Build response
    res.status(200).json({
      success: true,
      customer: {
        id: customer._id,

        // Basic info
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        isActive: customer.isActive,

        // RO info
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

        // Location (optional)
        location: customer.location,

        // Payment summary
        payment: {
          filterPrice: customer.filterPrice,
          paidAmount: customer.filterPaidAmount,
          pendingAmount: customer.filterPrice - customer.filterPaidAmount,
          status: customer.filterPaymentStatus,
        },

        // Service status
        service: {
          lastServiceDate: customer.lastServiceDate,
          nextServiceDate: customer.nextServiceDate,
          serviceStatus,
          daysRemaining,
        },

        // Filters status
        filters: customer.filters,

        // Service history (lightweight)
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
