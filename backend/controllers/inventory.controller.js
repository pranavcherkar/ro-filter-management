import { InventoryItem } from "../models/inventoryItem.model.js";
import { DEFAULT_PARTS } from "../utils/defaultInventory.js";

export const getInventoryParts = async (req, res) => {
  try {
    const userId = req.userId;

    let items = await InventoryItem.find({ userId, isActive: true }).sort({
      name: 1,
    });

    // ✅ Seed defaults if empty (check across ALL items, not just active,
    // so we don't reseed after every part gets discontinued)
    const anyItemsExist = await InventoryItem.exists({ userId });
    if (!anyItemsExist) {
      const seedData = DEFAULT_PARTS.map((part) => ({
        userId,
        name: part.name,
        category: part.category,
        quantity: 0,
        isActive: true,
      }));

      await InventoryItem.insertMany(seedData);

      items = await InventoryItem.find({ userId, isActive: true }).sort({
        name: 1,
      });
    }

    return res.status(200).json({
      success: true,
      count: items.length,
      items,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch inventory",
    });
  }
};

export const deletePart = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const part = await InventoryItem.findOne({ _id: id, userId });

    if (!part) {
      return res.status(404).json({
        success: false,
        message: "Part not found",
      });
    }

    // Soft delete — same pattern as RO model discontinue.
    // Hard delete avoided because past service records still reference
    // this part by name; removing it would orphan that history.
    part.isActive = false;
    await part.save();

    return res.status(200).json({
      success: true,
      message: `${part.name} removed from inventory`,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete part",
    });
  }
};

export const updatePartQuantity = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { change } = req.body; // +1, -1, +10, etc

    if (typeof change !== "number") {
      return res.status(400).json({
        success: false,
        message: "Invalid quantity change",
      });
    }

    const item = await InventoryItem.findOne({ _id: id, userId });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    item.quantity += change;
    await item.save();

    return res.status(200).json({
      success: true,
      item,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to update quantity",
    });
  }
};
export const createInventoryPart = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, category = "OTHER", quantity = 0 } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Part name is required",
      });
    }

    const existing = await InventoryItem.findOne({
      userId,
      name,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Part already exists",
      });
    }

    const item = await InventoryItem.create({
      userId,
      name,
      category,
      quantity,
    });

    return res.status(201).json({
      success: true,
      item,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to create part",
    });
  }
};