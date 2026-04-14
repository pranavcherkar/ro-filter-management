import { Customer } from "../models/customer.model.js";
import { addMonths } from "../utils/date.utils.js";
import { Invoice } from "../models/invoice.model.js";
import { ROModelInventory } from "../models/roModelInventory.model.js";
import { Service } from "../models/service.model.js";
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
      installationDate,
      filterPrice = 0,
      initialPaidAmount = 0, // ✅ match frontend
      lastServiceDate,
      filters,
      location,
    } = req.body;

    // 1️⃣ Basic validation
    if (!name || !phone || !roModel || !installationDate) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    // Convert safely
    const price = Number(filterPrice) || 0;
    const paid = Number(initialPaidAmount) || 0;

    const installDateObj = new Date(installationDate);
    const serviceDateObj = lastServiceDate ? new Date(lastServiceDate) : null;

    // 2️⃣ Check RO model stock
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

    // 3️⃣ Initialize filters
    const initializedFilters = (filters || []).map((f) => ({
      name: f.name,
      intervalMonths: f.intervalMonths,
      lastChangedDate: serviceDateObj || installDateObj,
    }));

    // 4️⃣ Decide nextServiceDate
    let nextServiceDate = null;

    if (serviceDateObj) {
      nextServiceDate = addMonths(serviceDateObj, 6);
    } else {
      const now = new Date();
      const diffDays = (now - installDateObj) / (1000 * 60 * 60 * 24);

      if (diffDays <= 30) {
        nextServiceDate = addMonths(installDateObj, 6);
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
      installationDate: installDateObj,
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

export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedUpdates = [
      "name",
      "phone",
      "address",
      "roModel",
      "roBodyType",
      "location",
      "isActive",
    ];

    const updates = {};

    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const customer = await Customer.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true },
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

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
    const finalCustomers = serviceStatus
      ? formattedCustomers.filter((c) => c.serviceStatus === serviceStatus)
      : formattedCustomers;

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
