// Helpers for creating and verifying JWT login tokens.
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

// Fail fast on startup if the secret is missing, rather than at request time.
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set in .env");
}

// Create a signed token that proves "this request is user <userId>".
// It expires after 7 days, after which the user must log in again.
export function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET as string, { expiresIn: "7d" });
}

// Verify a token is valid and not tampered with; returns its contents.
// Throws if the token is invalid or expired.
export function verifyToken(token: string): { userId: string } {
  return jwt.verify(token, JWT_SECRET as string) as { userId: string };
}
