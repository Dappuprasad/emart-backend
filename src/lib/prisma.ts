// A single shared PrismaClient instance for the whole app.
// Import this everywhere instead of creating new clients (which would
// open too many database connections).

import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
