import express from "express";
import {
  login,
  logout,
  register,
  updateOwnerProfile,
  updateProfile,
} from "../controllers/auth.controller.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.patch("/profile", isAuthenticated, updateProfile);
router.patch("/owner/profile", isAuthenticated, updateOwnerProfile);
router.get("/me", isAuthenticated, (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

export default router;
