// Seed script: fills the database with the initial product catalog.
// Run with:  npm run seed
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import productsData from "./products.json";

async function main() {
  console.log("🌱 Seeding database...");

  // Start clean so re-running this script doesn't create duplicates.
  // Reviews are deleted automatically via the cascade rule in the schema.
  await prisma.review.deleteMany();
  await prisma.product.deleteMany();

  for (const p of productsData.products) {
    await prisma.product.create({
      data: {
        id: p.id, // keep the original id so frontend links still work
        title: p.title,
        description: p.description,
        category: p.category,
        price: p.price,
        discountPercentage: p.discountPercentage ?? 0,
        rating: p.rating ?? 0,
        stock: p.stock ?? 0,
        tags: p.tags ?? [],
        brand: p.brand ?? null,
        sku: p.sku ?? "",
        weight: p.weight ?? 0,
        dimensions: p.dimensions ?? undefined,
        warrantyInformation: p.warrantyInformation ?? "",
        shippingInformation: p.shippingInformation ?? "",
        availabilityStatus: p.availabilityStatus ?? "",
        returnPolicy: p.returnPolicy ?? "",
        minimumOrderQuantity: p.minimumOrderQuantity ?? 1,
        meta: p.meta ?? undefined,
        images: p.images ?? [],
        thumbnail: p.thumbnail ?? "",
        reviews: {
          create: (p.reviews ?? []).map((r) => ({
            rating: r.rating,
            comment: r.comment,
            date: new Date(r.date),
            reviewerName: r.reviewerName,
            reviewerEmail: r.reviewerEmail,
          })),
        },
      },
    });
  }

  // Because we inserted explicit ids, tell Postgres to continue
  // auto-numbering from the highest id (so new products don't collide).
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Product"', 'id'), (SELECT MAX(id) FROM "Product"))`
  );

  const count = await prisma.product.count();
  console.log(`✅ Seeded ${count} products.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
