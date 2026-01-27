import express from "express";
import {
  createCustomer,
  updateCustomerPayment,
  updateCustomer,
  getCustomers,
  getCustomerById,
} from "../controllers/customer.controller.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", isAuthenticated, createCustomer);
//
router.get("/:id", isAuthenticated, getCustomerById);
/* GENERIC UPDATE (address, phone, roModel, location, etc.) */
router.patch("/:id", isAuthenticated, updateCustomer);
router.patch("/:id/payment", isAuthenticated, updateCustomerPayment);

router.get("/", isAuthenticated, getCustomers);
export default router;
