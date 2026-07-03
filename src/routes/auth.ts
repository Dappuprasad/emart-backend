import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/token";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// --- Input validation rules (Zod) ---
const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("A valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().email("A valid email is required"),
  password: z.string().min(1, "Password is required"),
});

// -------------------------------------------------------------------
// POST /api/auth/register
// Create a new account and return a login token.
// -------------------------------------------------------------------
router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, email, password } = parsed.data;

  // Don't allow two accounts with the same email.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  // Hash the password before storing it. "10" is the strength/cost factor.
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword },
  });

  const token = signToken(user.id);

  // Never send the password (even hashed) back to the client.
  res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
});

// -------------------------------------------------------------------
// POST /api/auth/login
// Check credentials and return a login token.
// -------------------------------------------------------------------
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });

  // Use the same vague message whether the email or password is wrong,
  // so attackers can't tell which emails are registered.
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  // Compare the typed password against the stored hash.
  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken(user.id);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
});

// -------------------------------------------------------------------
// GET /api/auth/me
// Return the currently logged-in user. Protected by authMiddleware.
// -------------------------------------------------------------------
router.get("/me", authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(user);
});

export default router;
