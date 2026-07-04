// Load environment variables from the .env file into process.env
import "dotenv/config";

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";

import productsRouter from "./routes/products";
import authRouter from "./routes/auth";
import cartRouter from "./routes/cart";
import ordersRouter from "./routes/orders";

// Create the Express application
const app = express();

// --- Middleware ---
// Middleware are functions that run on every request before it reaches our routes.

// Allow our frontend(s) to call this backend. FRONTEND_URL can be a single
// URL or a comma-separated list (e.g. localhost + the live Vercel site).
const allowedOrigins = (process.env.FRONTEND_URL ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
  })
);

// Automatically parse incoming JSON request bodies into JavaScript objects.
app.use(express.json());

// --- Routes ---
// A "route" maps a URL + HTTP method to a function that produces a response.

// A simple health-check route so we can confirm the server is alive.
app.get("/", (req, res) => {
  res.json({ message: "EMart backend is running 🚀" });
});

// All product-related routes live under /api/products
app.use("/api/products", productsRouter);

// All auth routes live under /api/auth
app.use("/api/auth", authRouter);

// All cart routes live under /api/cart (protected — login required)
app.use("/api/cart", cartRouter);

// All order routes live under /api/orders (protected — login required)
app.use("/api/orders", ordersRouter);

// --- Error handler (must be last) ---
// Any error thrown in a route ends up here, so the server replies with
// clean JSON instead of crashing.
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

// --- Start the server ---
const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});
