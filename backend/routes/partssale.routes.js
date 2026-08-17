import express from "express";
import {
  createPartsSale,
  getPartsForSale,
  searchCustomersForSale,
} from "../controllers/partssales.controller.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/parts", isAuthenticated, getPartsForSale);
router.get("/customers", isAuthenticated, searchCustomersForSale);
router.post("/", isAuthenticated, createPartsSale);

export default router;
