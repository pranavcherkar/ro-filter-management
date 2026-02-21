import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import invoiceRoutes from "./routes/invoice.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import cookieParser from "cookie-parser";
import connectDB from "./database/db.js";
import inventoryRoutes from "./routes/inventory.routes.js";
// import roinventoryRoutes from "./routes/roInventory.routes.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.set("etag", false);
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/inventory", inventoryRoutes);
// app.use("/api/roinventory", roinventoryRoutes);

// Routes
app.get("/", (req, res) => {
  res.send("Hello World with ESM!");
});

await connectDB();
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
