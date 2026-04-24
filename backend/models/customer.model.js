import mongoose from "mongoose";

const filterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true, // Sediment, Carbon, Membrane
    },
    lastChangedDate: {
      type: Date,
      required: true,
    },
    intervalMonths: {
      type: Number,
      required: true, // usually 6
    },
  },
  { _id: false }
);

const amcContractSchema = new mongoose.Schema(
  {
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRED", "CANCELLED"],
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      default: "",
    },

    roModel: {
      type: String,
      required: true,
    },
    roBodyType: {
      type: String,
      default: "",
    },
    customerType: {
      type: String,
      enum: ["REGULAR", "AMC"],
      default: "REGULAR",
    },
    amcContract: {
      type: amcContractSchema,
      default: null,
    },

    installationDate: {
      type: Date,
      required: true,
    },

    filterPrice: {
      type: Number,
      default: 0,
    },
    filterPaidAmount: {
      type: Number,
      default: 0,
    },
    filterPaymentStatus: {
      type: String,
      enum: ["PAID", "PARTIAL", "UNPAID"],
      default: "UNPAID",
    },

    filters: {
      type: [filterSchema],
      default: [],
    },
    lastServiceDate: {
      type: Date,
      default: null,
    },

    nextServiceDate: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    location: {
      lat: { type: Number },
      lng: { type: Number },
      mapLink: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

export const Customer = mongoose.model("Customer", customerSchema);
