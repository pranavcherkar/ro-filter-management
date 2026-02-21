import mongoose from "mongoose";

const roModelInventorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    modelName: {
      type: String,
      required: true,
      trim: true,
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

// One RO model per user
roModelInventorySchema.index({ userId: 1, modelName: 1 }, { unique: true });

export const ROModelInventory = mongoose.model(
  "ROModelInventory",
  roModelInventorySchema,
);
