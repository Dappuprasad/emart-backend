// Middleware that protects routes: it requires a valid login token.
// Put it in front of any route that should only work when logged in.
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/token";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // The frontend sends the token like:  Authorization: Bearer <token>
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = verifyToken(token);
    // Attach the user's id so the route can know who is making the request.
    req.userId = payload.userId;
    next(); // token is valid → continue to the actual route
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
