import express from "express";
import { getInvoices } from "../controllers/invoice.controller.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", isAuthenticated, getInvoices);

export default router;
