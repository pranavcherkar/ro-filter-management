import express from "express";
import {
  createService,
  getAllServices,
} from "../controllers/service.controller.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", isAuthenticated, createService);
router.get("/", isAuthenticated, getAllServices);
export default router;
