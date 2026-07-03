// Load environment variables from the .env file into process.env
import "dotenv/config";

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";

import productsRouter from "./routes/products";
import authRouter from "./routes/auth";

// Create the Express application
const app = express();

// --- Middleware ---
// Middleware are functions that run on every request before it reaches our routes.

// Allow our frontend (a different origin) to call this backend.
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
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
