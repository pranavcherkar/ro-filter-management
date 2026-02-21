import { ROModelInventory } from "../models/roModelInventory.model.js";

export const getROModels = async (req, res) => {
  try {
    const userId = req.userId;

    const models = await ROModelInventory.find({ userId }).sort({
      modelName: 1,
    });

    return res.status(200).json({
      success: true,
      models,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch RO models",
    });
  }
};

export const updateROModelQuantity = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { change } = req.body;

    if (typeof change !== "number") {
      return res.status(400).json({
        success: false,
        message: "Invalid quantity change",
      });
    }

    const model = await ROModelInventory.findOne({ _id: id, userId });

    if (!model) {
      return res.status(404).json({
        success: false,
        message: "Model not found",
      });
    }

    const newQuantity = model.quantity + change;

    if (newQuantity < 0) {
      return res.status(400).json({
        success: false,
        message: "Stock cannot go below 0",
      });
    }

    model.quantity = newQuantity;
    await model.save();

    res.status(200).json({
      success: true,
      model,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to update model quantity",
    });
  }
};

export const createROModel = async (req, res) => {
  try {
    const userId = req.userId;
    const { modelName, quantity = 0 } = req.body;

    if (!modelName) {
      return res.status(400).json({
        success: false,
        message: "Model name is required",
      });
    }

    const existing = await ROModelInventory.findOne({
      userId,
      modelName,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "RO model already exists",
      });
    }

    const model = await ROModelInventory.create({
      userId,
      modelName,
      quantity,
    });

    return res.status(201).json({
      success: true,
      model,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to create RO model",
    });
  }
};
