import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
        success: false,
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        message: "User Don't Exist",
        success: false,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
        success: false,
      });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: true, // true in production (https)
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    // res.cookie("token", token, {
    //   httpOnly: true,
    //   secure: false,
    //   sameSite: "lax",
    //   maxAge: 7 * 24 * 60 * 60 * 1000,
    // });
    res.status(200).json({
      message: "Login successful",
      success: true,
      user: {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        businessName: user.businessName,
        defaultServiceCycleMonths: user.defaultServiceCycleMonths,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Login failed",
      success: false,
    });
  }
};

export const register = async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      email,
      password,
      phone,
      businessName,
      defaultServiceCycleMonths,
    } =
      req.body;

    if (!firstname || !lastname || !email || !password) {
      return res.status(400).json({
        message: "Required fields missing",
        success: false,
      });
    }

    // check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        message: "User already exists",
        success: false,
      });
    }

    const parsedDefaultCycleMonths =
      defaultServiceCycleMonths === undefined
        ? undefined
        : Number(defaultServiceCycleMonths);

    if (
      parsedDefaultCycleMonths !== undefined &&
      (!Number.isFinite(parsedDefaultCycleMonths) || parsedDefaultCycleMonths <= 0)
    ) {
      return res.status(400).json({
        message: "defaultServiceCycleMonths must be a positive number",
        success: false,
      });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      firstname,
      lastname,
      email,
      phone,
      businessName,
      defaultServiceCycleMonths: parsedDefaultCycleMonths,
      password: hashedPassword,
    });

    res.status(201).json({
      message: "User created successfully",
      success: true,
      user: {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        defaultServiceCycleMonths: user.defaultServiceCycleMonths,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create user",
      success: false,
    });
  }
};

export const logout = async (req, res) => {
  try {
    res.cookie("token", "", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      expires: new Date(0), // expire immediately
    });

    res.status(200).json({
      message: "Logged out successfully",
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Logout failed",
      success: false,
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const allowedUpdates = [
      "firstname",
      "lastname",
      "phone",
      "businessName",
      "defaultServiceCycleMonths",
    ];

    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (updates.defaultServiceCycleMonths !== undefined) {
      const parsedDefaultCycleMonths = Number(updates.defaultServiceCycleMonths);
      if (!Number.isFinite(parsedDefaultCycleMonths) || parsedDefaultCycleMonths <= 0) {
        return res.status(400).json({
          success: false,
          message: "defaultServiceCycleMonths must be a positive number",
        });
      }
      updates.defaultServiceCycleMonths = parsedDefaultCycleMonths;
    }

    const user = await User.findByIdAndUpdate(req.userId, { $set: updates }, {
      new: true,
    }).select("-password");

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};
