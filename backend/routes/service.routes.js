import express from "express";
import {
  createService,
  deleteService,
  getAllServices,
  getServiceById,
  getServicesByCustomer,
} from "../controllers/service.controller.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", isAuthenticated, createService);
router.get("/", isAuthenticated, getAllServices);
router.get("/customer/:customerId", isAuthenticated, getServicesByCustomer);
router.get("/:id", isAuthenticated, getServiceById);
router.delete("/:id", isAuthenticated, deleteService);
export default router;
