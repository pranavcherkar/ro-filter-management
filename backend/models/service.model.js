import mongoose from "mongoose";

const replacedPartSchema = new mongoose.Schema(
  {
    partName: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const serviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    serviceDate: {
      type: Date,
      required: true,
    },

    serviceType: {
      type: String,
      enum: ["SCHEDULED", "EARLY", "EMERGENCY"],
      default: "SCHEDULED",
    },

    affectsServiceCycle: {
      type: Boolean,
      default: true,
    },

    replacedParts: {
      type: [replacedPartSchema],
      default: [],
    },

    serviceCharge: {
      type: Number,
      default: 0,
    },

    totalServiceAmount: {
      type: Number,
      default: 0,
    },

    nextServiceDate: {
      type: Date,
    },

    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
    },
  },
  { timestamps: true }
);

export const Service = mongoose.model("Service", serviceSchema);
