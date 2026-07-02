import { Router } from "express";
import { prisma } from "../lib/prisma";

// A Router is a mini-app that groups related routes together.
// In index.ts we'll mount this at "/api/products".
const router = Router();

// -------------------------------------------------------------------
// GET /api/products/categories
// Returns the list of distinct category names.
// NOTE: this must be defined BEFORE "/:id", otherwise Express would
// think "categories" is an id.
// -------------------------------------------------------------------
router.get("/categories", async (req, res) => {
  try {
    const grouped = await prisma.product.groupBy({ by: ["category"] });
    const categories = grouped.map((g) => g.category);
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load categories" });
  }
});

// -------------------------------------------------------------------
// GET /api/products
// Supports optional query params:
//   ?search=lipstick        text search in title/description/category
//   ?category=beauty        filter by category
//   ?sort=asc | desc        sort by price
//   ?page=1&limit=10        pagination
// Returns: { products, total, page, totalPages }
// -------------------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const search = (req.query.search as string) || "";
    const category = (req.query.category as string) || "";
    const sort = req.query.sort as "asc" | "desc" | undefined;

    const page = Math.max(1, Number(req.query.page) || 1);
    // If no limit is given, return everything (limit = 0 means "no limit").
    const limit = Math.max(0, Number(req.query.limit) || 0);

    // Build the filter ("where") clause dynamically.
    const where: any = {};
    if (category) {
      where.category = { equals: category, mode: "insensitive" };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderBy =
      sort === "asc"
        ? { price: "asc" as const }
        : sort === "desc"
        ? { price: "desc" as const }
        : undefined;

    // Count total matching rows (for pagination info).
    const total = await prisma.product.count({ where });

    const products = await prisma.product.findMany({
      where,
      orderBy,
      include: { reviews: true },
      ...(limit > 0
        ? { skip: (page - 1) * limit, take: limit }
        : {}),
    });

    res.json({
      products,
      total,
      page,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load products" });
  }
});

// -------------------------------------------------------------------
// GET /api/products/:id
// Returns a single product (with its reviews).
// -------------------------------------------------------------------
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid product id" });
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: { reviews: true },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load product" });
  }
});

export default router;
