import { Router } from "express";
import { db, usersTable, driverProfilesTable, activityLogTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";
import { CreateDriverProfileBody, ListDriversQueryParams, ApproveDriverBody, DenyDriverBody } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../lib/auth";

export const driversRouter = Router();

driversRouter.get("/", requireAuth, async (req, res) => {
  const parsed = ListDriversQueryParams.safeParse(req.query);
  const { status, search } = parsed.success ? parsed.data : { status: undefined, search: undefined };

  let profiles = await db.select().from(driverProfilesTable);

  if (status) profiles = profiles.filter(p => p.status === status);

  // Join user info
  const result = await Promise.all(profiles.map(async (profile) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, profile.userId));
    if (!user) return null;
    if (search) {
      const s = search.toLowerCase();
      if (!user.name.toLowerCase().includes(s) && !user.email.toLowerCase().includes(s)) return null;
    }
    const { passwordHash: _, ...safeUser } = user;
    return { ...profile, user: { ...safeUser, driverProfile: null } };
  }));

  res.json(result.filter(Boolean));
});

driversRouter.post("/", requireAuth, async (req, res) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== "driver") {
    res.status(403).json({ error: "Only drivers can submit a profile" }); return;
  }

  const parsed = CreateDriverProfileBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error", details: parsed.error.issues }); return; }

  const existing = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, currentUser.id));
  if (existing.length > 0) {
    // Update existing
    const [updated] = await db.update(driverProfilesTable)
      .set({ ...parsed.data, status: "pending", adminNote: null, reviewedAt: null })
      .where(eq(driverProfilesTable.userId, currentUser.id))
      .returning();
    const { passwordHash: _, ...safeUser } = currentUser;
    res.status(201).json({ ...updated, user: { ...safeUser, driverProfile: null } });
    return;
  }

  const [profile] = await db.insert(driverProfilesTable).values({
    userId: currentUser.id,
    ...parsed.data,
  }).returning();

  await db.insert(activityLogTable).values({
    type: "driver_registered",
    description: `Motorista enviou documentação para aprovação: ${currentUser.name}`,
    userId: currentUser.id,
    userName: currentUser.name,
  });

  const { passwordHash: _, ...safeUser } = currentUser;
  res.status(201).json({ ...profile, user: { ...safeUser, driverProfile: null } });
});

driversRouter.get("/me", requireAuth, async (req, res) => {
  const currentUser = (req as any).user;
  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, currentUser.id));
  if (!profile) { res.status(404).json({ error: "Driver profile not found" }); return; }
  const { passwordHash: _, ...safeUser } = currentUser;
  res.json({ ...profile, user: { ...safeUser, driverProfile: null } });
});

driversRouter.get("/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.id, id));
  if (!profile) { res.status(404).json({ error: "Driver profile not found" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, profile.userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const { passwordHash: _, ...safeUser } = user;
  res.json({ ...profile, user: { ...safeUser, driverProfile: null } });
});

driversRouter.patch("/:id/approve", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const parsed = ApproveDriverBody.safeParse(req.body);
  const adminNote = parsed.success ? parsed.data.adminNote ?? null : null;

  const [profile] = await db.update(driverProfilesTable)
    .set({ status: "approved", adminNote, reviewedAt: new Date() })
    .where(eq(driverProfilesTable.id, id))
    .returning();

  if (!profile) { res.status(404).json({ error: "Driver profile not found" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, profile.userId));
  await db.insert(activityLogTable).values({
    type: "driver_approved",
    description: `Motorista aprovado: ${user?.name ?? "N/A"}`,
    userId: user?.id ?? null,
    userName: user?.name ?? null,
  });

  const { passwordHash: _, ...safeUser } = user!;
  res.json({ ...profile, user: { ...safeUser, driverProfile: null } });
});

driversRouter.patch("/:id/deny", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const parsed = DenyDriverBody.safeParse(req.body);
  const adminNote = parsed.success ? parsed.data.adminNote ?? null : null;

  const [profile] = await db.update(driverProfilesTable)
    .set({ status: "denied", adminNote, reviewedAt: new Date() })
    .where(eq(driverProfilesTable.id, id))
    .returning();

  if (!profile) { res.status(404).json({ error: "Driver profile not found" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, profile.userId));
  await db.insert(activityLogTable).values({
    type: "driver_denied",
    description: `Motorista negado: ${user?.name ?? "N/A"}`,
    userId: user?.id ?? null,
    userName: user?.name ?? null,
  });

  const { passwordHash: _, ...safeUser } = user!;
  res.json({ ...profile, user: { ...safeUser, driverProfile: null } });
});
