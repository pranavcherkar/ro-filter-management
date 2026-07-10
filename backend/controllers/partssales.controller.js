import mongoose from "mongoose";
import { Invoice } from "../models/invoice.model.js";
import { Customer } from "../models/customer.model.js";
import { InventoryItem } from "../models/inventoryItem.model.js";

// ── Ensure walk-in customer exists for this user ──────────────────────────
// Option B: one shared "Walk-in Customer" document per user.
// Created once and reused for all walk-in sales.
const getOrCreateWalkInCustomer = async (userId) => {
  let walkIn = await Customer.findOne({
    userId,
    customerType: "SERVICE_ONLY",
    name: "__WALK_IN__",
  });

  if (!walkIn) {
    walkIn = await Customer.create({
      userId,
      name: "__WALK_IN__",
      phone: "0000000000",
      customerType: "SERVICE_ONLY",
      isActive: false, // never shows in customer list
    });
  }

  return walkIn;
};

// ── Create Parts Sale ─────────────────────────────────────────────────────
export const createPartsSale = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      customerId, // null if walk-in
      walkInName,
      walkInPhone,
      cart, // [{ inventoryItemId, name, price, qty }]
      paymentStatus = "PAID",
      paidAmount,
    } = req.body;

    // ── Validate cart ────────────────────────────────────────────────────
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    for (const item of cart) {
      if (!item.inventoryItemId || !item.name || !item.price || !item.qty) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid cart item" });
      }
      if (Number(item.price) <= 0 || Number(item.qty) <= 0) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Price and quantity must be positive",
          });
      }
    }

    // ── Resolve customer ─────────────────────────────────────────────────
    let resolvedCustomerId;

    if (customerId) {
      // Registered customer
      if (!mongoose.Types.ObjectId.isValid(customerId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid customer ID" });
      }
      const customer = await Customer.findOne({ _id: customerId, userId });
      if (!customer) {
        return res
          .status(404)
          .json({ success: false, message: "Customer not found" });
      }
      resolvedCustomerId = customer._id;
    } else {
      // Walk-in — use shared walk-in customer document
      const walkIn = await getOrCreateWalkInCustomer(userId);
      resolvedCustomerId = walkIn._id;
    }

    // ── Validate stock and prepare items ─────────────────────────────────
    const invoiceItems = [];
    const stockUpdates = [];

    for (const item of cart) {
      if (!mongoose.Types.ObjectId.isValid(item.inventoryItemId)) {
        return res
          .status(400)
          .json({
            success: false,
            message: `Invalid inventory item: ${item.name}`,
          });
      }

      const invItem = await InventoryItem.findOne({
        _id: item.inventoryItemId,
        userId,
      });
      if (!invItem) {
        return res
          .status(404)
          .json({
            success: false,
            message: `Inventory item not found: ${item.name}`,
          });
      }

      const qty = Number(item.qty);
      if (invItem.quantity < qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${invItem.name}. Available: ${invItem.quantity}`,
        });
      }

      invoiceItems.push({
        name: invItem.name,
        price: Number(item.price) * qty,
      });

      stockUpdates.push({ item: invItem, qty });
    }

    // ── Calculate totals ─────────────────────────────────────────────────
    const totalAmount = invoiceItems.reduce((sum, i) => sum + i.price, 0);

    let resolvedPaid = totalAmount;
    if (paymentStatus === "PARTIAL") {
      resolvedPaid = Math.min(Number(paidAmount) || 0, totalAmount);
    } else if (paymentStatus === "PENDING" || paymentStatus === "UNPAID") {
      resolvedPaid = 0;
    }

    // ── Create invoice ───────────────────────────────────────────────────
    const invoice = await Invoice.create({
      userId,
      customerId: resolvedCustomerId,
      type: "PARTS_SALE",
      referenceId: resolvedCustomerId,
      walkInName: customerId ? null : walkInName?.trim() || "Walk-in",
      walkInPhone: customerId ? null : walkInPhone?.trim() || null,
      items: invoiceItems,
      totalAmount,
      paidAmount: resolvedPaid,
      paymentStatus: paymentStatus === "PENDING" ? "UNPAID" : paymentStatus,
      invoiceDate: new Date(),
    });

    // ── Deduct inventory (after invoice created successfully) ────────────
    for (const { item, qty } of stockUpdates) {
      item.quantity -= qty;
      await item.save();
    }

    return res.status(201).json({
      success: true,
      message: "Parts sale recorded successfully",
      invoiceId: invoice._id,
      totalAmount,
      paidAmount: resolvedPaid,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to record parts sale" });
  }
};

// ── Get inventory items for parts sale page ───────────────────────────────
export const getPartsForSale = async (req, res) => {
  try {
    const { search } = req.query;

    const query = { userId: req.userId, isActive: true, quantity: { $gt: 0 } };
    if (search) query.name = { $regex: search, $options: "i" };

    const items = await InventoryItem.find(query).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      items: items.map((i) => ({
        id: i._id,
        name: i.name,
        category: i.category,
        stock: i.quantity,
      })),
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch parts" });
  }
};

// ── Customer search for parts sale (registered customers) ────────────────
export const searchCustomersForSale = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(200).json({ success: true, customers: [] });
    }

    const customers = await Customer.find({
      userId: req.userId,
      isActive: true,
      name: { $ne: "__WALK_IN__" },
      $or: [
        { name: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ],
    })
      .select("name phone address customerType")
      .limit(10)
      .lean();

    return res.status(200).json({
      success: true,
      customers: customers.map((c) => ({
        id: c._id,
        name: c.name,
        phone: c.phone,
        address: c.address || "",
        customerType: c.customerType,
      })),
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to search customers" });
  }
};
