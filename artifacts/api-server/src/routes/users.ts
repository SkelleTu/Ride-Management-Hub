import { Router } from "express";
import { db, usersTable, driverProfilesTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";
import { UpdateUserBody, ListUsersQueryParams } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../lib/auth";

export const usersRouter = Router();

usersRouter.get("/", requireAdmin, async (req, res) => {
  const parsed = ListUsersQueryParams.safeParse(req.query);
  const { role, search } = parsed.success ? parsed.data : { role: undefined, search: undefined };

  let query = db.select().from(usersTable).$dynamic();

  if (role) {
    query = query.where(eq(usersTable.role, role));
  }
  if (search) {
    query = query.where(or(
      ilike(usersTable.name, `%${search}%`),
      ilike(usersTable.email, `%${search}%`),
      ilike(usersTable.phone, `%${search}%`)
    ));
  }

  const users = await query;
  res.json(users.map(({ passwordHash: _, ...u }) => ({ ...u, driverProfile: null })));
});

usersRouter.get("/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  let driverProfile = null;
  if (user.role === "driver") {
    const profiles = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, user.id));
    driverProfile = profiles[0] ?? null;
  }

  const { passwordHash: _, ...safeUser } = user;
  res.json({ ...safeUser, driverProfile });
});

usersRouter.patch("/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const currentUser = (req as any).user;
  if (currentUser.id !== id && currentUser.role !== "admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }

  const [updated] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }

  const { passwordHash: _, ...safeUser } = updated;
  res.json({ ...safeUser, driverProfile: null });
});

// Update own avatar (any authenticated user)
usersRouter.patch("/me/avatar", requireAuth, async (req, res) => {
  const currentUser = (req as any).user;
  const { avatarUrl } = req.body ?? {};
  if (!avatarUrl || typeof avatarUrl !== "string") {
    res.status(400).json({ error: "avatarUrl required" }); return;
  }
  const [updated] = await db.update(usersTable)
    .set({ avatarUrl })
    .where(eq(usersTable.id, currentUser.id))
    .returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  const { passwordHash: _, ...safe } = updated;
  res.json({ ...safe, driverProfile: null });
});

usersRouter.delete("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).end();
});
