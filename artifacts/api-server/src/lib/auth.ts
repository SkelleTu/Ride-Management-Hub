import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "rideapp_salt_2024").digest("hex");
}

export function generateToken(userId: number): string {
  return crypto.createHash("sha256").update(`${userId}_${Date.now()}_rideapp`).digest("hex");
}

// Simple in-memory token store (production would use JWT or Redis)
const tokenStore = new Map<string, number>();

export function storeToken(token: string, userId: number): void {
  tokenStore.set(token, userId);
}

export function getUserIdFromToken(token: string): number | null {
  return tokenStore.get(token) ?? null;
}

export function removeToken(token: string): void {
  tokenStore.delete(token);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers["authorization"];
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = getUserIdFromToken(token);
  if (!userId) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  (req as any).user = user;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, () => {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}
