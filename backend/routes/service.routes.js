import express from "express";
import {
  createService,
  getAllServices,
  getServiceById,
  getServicesByCustomer,
} from "../controllers/service.controller.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", isAuthenticated, createService);
router.get("/", isAuthenticated, getAllServices);
router.get("/:id", isAuthenticated, getServiceById);
router.get("/customer/:customerId", isAuthenticated, getServicesByCustomer);
export default router;
