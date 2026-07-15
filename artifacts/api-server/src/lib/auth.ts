import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET =
  process.env.JWT_SECRET ?? "upcar_dev_secret_change_in_production";
const JWT_EXPIRES = "7d";

export function hashPassword(password: string): string {
  return crypto
    .createHash("sha256")
    .update(password + "upcar_salt_2024")
    .digest("hex");
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function getUserIdFromToken(token: string): number | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    return typeof payload.userId === "number" ? payload.userId : null;
  } catch {
    return null;
  }
}

export function storeToken(_token: string, _userId: number): void {}

export function removeToken(_token: string): void {}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
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
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  (req as any).user = user;
  next();
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuth(req, res, () => {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}
