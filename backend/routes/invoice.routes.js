import express from "express";
import {
  deleteInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoicePayment,
} from "../controllers/invoice.controller.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", isAuthenticated, getInvoices);
router.get("/:id", isAuthenticated, getInvoiceById);
router.delete("/:id", isAuthenticated, deleteInvoice);
router.patch("/:id/payment", isAuthenticated, updateInvoicePayment);

export default router;   