import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// All order routes require a logged-in user.
router.use(authMiddleware);

// The shipping address the customer provides at checkout.
const checkoutSchema = z.object({
  shippingAddress: z.object({
    name: z.string().min(1),
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zipCode: z.string().min(1),
    country: z.string().min(1),
    phone: z.string().optional(),
  }),
});

// -------------------------------------------------------------------
// POST /api/orders  — checkout
// Turns the current user's cart into a saved order, decrements stock,
// and empties the cart. All of this happens in ONE transaction.
// -------------------------------------------------------------------
router.post("/", async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { shippingAddress } = parsed.data;
  const userId = req.userId!;

  // Load the cart with product details so we can snapshot prices/titles.
  const cartItems = await prisma.cartItem.findMany({
    where: { userId },
    include: { product: true },
  });

  if (cartItems.length === 0) {
    return res.status(400).json({ error: "Your cart is empty" });
  }

  // Make sure every item is still in stock before charging anything.
  for (const item of cartItems) {
    if (item.product.stock < item.quantity) {
      return res.status(400).json({
        error: `Not enough stock for "${item.product.title}" (only ${item.product.stock} left)`,
      });
    }
  }

  const total =
    Math.round(
      cartItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0) * 100
    ) / 100;

  // Estimate delivery 5 days out.
  const estimatedDelivery = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

  // --- The transaction: all steps succeed together, or none do. ---
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId,
        total,
        status: "pending",
        shippingAddress: shippingAddress as Prisma.InputJsonValue,
        estimatedDelivery,
        // Snapshot each purchased item so history stays correct even if
        // the product later changes price or is removed.
        items: {
          create: cartItems.map((i) => ({
            productId: i.productId,
            title: i.product.title,
            price: i.product.price,
            quantity: i.quantity,
            thumbnail: i.product.thumbnail,
          })),
        },
      },
      include: { items: true },
    });

    // Reduce stock for each product.
    for (const i of cartItems) {
      await tx.product.update({
        where: { id: i.productId },
        data: { stock: { decrement: i.quantity } },
      });
    }

    // Empty the cart.
    await tx.cartItem.deleteMany({ where: { userId } });

    return created;
  });

  res.status(201).json(order);
});

// -------------------------------------------------------------------
// GET /api/orders  — the current user's order history (newest first)
// -------------------------------------------------------------------
router.get("/", async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.userId! },
    include: { items: true },
    orderBy: { orderDate: "desc" },
  });
  res.json(orders);
});

// -------------------------------------------------------------------
// GET /api/orders/:id  — a single order (only if it belongs to the user)
// -------------------------------------------------------------------
router.get("/:id", async (req, res) => {
  const order = await prisma.order.findFirst({
    // findFirst with userId ensures a user can't read someone else's order.
    where: { id: req.params.id, userId: req.userId! },
    include: { items: true },
  });

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  res.json(order);
});

export default router;
