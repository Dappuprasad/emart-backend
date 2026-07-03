// Extends Express's Request type so TypeScript knows about `req.userId`,
// which our auth middleware attaches after verifying a login token.
import "express";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};
