import express from "express";
import { deleteInvoice, getInvoices } from "../controllers/invoice.controller.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", isAuthenticated, getInvoices);
router.delete("/:id", isAuthenticated, deleteInvoice);

export default router;
