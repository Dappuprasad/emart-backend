import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Every route in this file requires a logged-in user.
// This one line protects ALL routes below it.
router.use(authMiddleware);

// --- Validation ---
const addSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive().optional(), // defaults to 1
});

const updateSchema = z.object({
  quantity: z.number().int(), // 0 or less removes the item
});

// Helper: load a user's cart and compute totals, in one consistent shape.
// We reuse this so every endpoint returns the full, updated cart.
async function getCartForUser(userId: string) {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: { product: true },
    orderBy: { id: "asc" },
  });

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce(
    (sum, i) => sum + i.product.price * i.quantity,
    0
  );

  return {
    items, // each: { id, quantity, userId, productId, product: {...} }
    totalItems,
    totalPrice: Math.round(totalPrice * 100) / 100, // round to 2 decimals
  };
}

// -------------------------------------------------------------------
// GET /api/cart  — the current user's cart
// -------------------------------------------------------------------
router.get("/", async (req, res) => {
  const cart = await getCartForUser(req.userId!);
  res.json(cart);
});

// -------------------------------------------------------------------
// POST /api/cart  — add a product (or bump its quantity)
// body: { productId, quantity? }
// -------------------------------------------------------------------
router.post("/", async (req, res) => {
  const parsed = addSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { productId, quantity = 1 } = parsed.data;

  // Make sure the product actually exists before adding it.
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  // Upsert: if this user already has this product in the cart, increment;
  // otherwise create a new cart row.
  await prisma.cartItem.upsert({
    where: { userId_productId: { userId: req.userId!, productId } },
    update: { quantity: { increment: quantity } },
    create: { userId: req.userId!, productId, quantity },
  });

  const cart = await getCartForUser(req.userId!);
  res.status(201).json(cart);
});

// -------------------------------------------------------------------
// PATCH /api/cart/:productId  — set an item's quantity
// body: { quantity }   (quantity <= 0 removes it)
// -------------------------------------------------------------------
router.patch("/:productId", async (req, res) => {
  const productId = Number(req.params.productId);
  if (Number.isNaN(productId)) {
    return res.status(400).json({ error: "Invalid product id" });
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { quantity } = parsed.data;

  const where = {
    userId_productId: { userId: req.userId!, productId },
  };

  if (quantity <= 0) {
    // Setting quantity to 0 (or less) means: remove it from the cart.
    // deleteMany won't error if the row doesn't exist.
    await prisma.cartItem.deleteMany({ where: { userId: req.userId!, productId } });
  } else {
    const existing = await prisma.cartItem.findUnique({ where });
    if (!existing) {
      return res.status(404).json({ error: "Item not in cart" });
    }
    await prisma.cartItem.update({ where, data: { quantity } });
  }

  const cart = await getCartForUser(req.userId!);
  res.json(cart);
});

// -------------------------------------------------------------------
// DELETE /api/cart/:productId  — remove one item
// -------------------------------------------------------------------
router.delete("/:productId", async (req, res) => {
  const productId = Number(req.params.productId);
  if (Number.isNaN(productId)) {
    return res.status(400).json({ error: "Invalid product id" });
  }

  await prisma.cartItem.deleteMany({
    where: { userId: req.userId!, productId },
  });

  const cart = await getCartForUser(req.userId!);
  res.json(cart);
});

// -------------------------------------------------------------------
// DELETE /api/cart  — empty the whole cart
// -------------------------------------------------------------------
router.delete("/", async (req, res) => {
  await prisma.cartItem.deleteMany({ where: { userId: req.userId! } });
  const cart = await getCartForUser(req.userId!);
  res.json(cart);
});

export default router;
