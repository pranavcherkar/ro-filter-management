import express from "express";
import { getDashboardSummary } from "../controllers/dashboard.controller.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/summary", isAuthenticated, getDashboardSummary);

export default router;
