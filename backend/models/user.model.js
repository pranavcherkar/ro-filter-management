import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstname: {
      type: String,
      required: true,
    },
    lastname: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    businessName: {
      type: String,
      default: "",
    },
    defaultServiceCycleMonths: {
      type: Number,
      default: 6,
      min: 1,
    },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
