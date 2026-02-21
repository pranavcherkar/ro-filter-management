import express from "express";
import {
  createInventoryPart,
  getInventoryParts,
  updatePartQuantity,
} from "../controllers/inventory.controller.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";
import {
  createROModel,
  getROModels,
  updateROModelQuantity,
} from "../controllers/roInventory.controller.js";

const router = express.Router();

router.get("/parts", isAuthenticated, getInventoryParts);
router.post("/parts", isAuthenticated, createInventoryPart);
router.patch("/parts/:id", isAuthenticated, updatePartQuantity);
//
router.post("/ro-models", isAuthenticated, createROModel);
router.get("/ro-models", isAuthenticated, getROModels);
router.patch("/ro-models/:id", isAuthenticated, updateROModelQuantity);
export default router;
