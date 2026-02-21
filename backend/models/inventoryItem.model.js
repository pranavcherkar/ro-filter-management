import mongoose from "mongoose";

const inventoryItemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      enum: ["FILTER", "ELECTRICAL", "PIPE", "OTHER"],
      default: "OTHER",
    },

    quantity: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// One inventory item per user per name
inventoryItemSchema.index({ userId: 1, name: 1 }, { unique: true });

export const InventoryItem = mongoose.model(
  "InventoryItem",
  inventoryItemSchema,
);
