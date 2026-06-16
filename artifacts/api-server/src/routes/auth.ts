import { Router } from "express";
import { db, usersTable, driverProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { hashPassword, generateToken, storeToken, removeToken, requireAuth } from "../lib/auth";
import { activityLogTable } from "@workspace/db";
import { sendWelcome, OWNER_WHATSAPP_NUMBER } from "../lib/whatsapp";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", details: parsed.error.issues });
    return;
  }
  const { name, email, password, phone, role, cpf, address } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));

  // If account exists but WhatsApp wasn't activated yet, resume the flow
  if (existing.length > 0) {
    const user = existing[0];
    if (!user.whatsappActivated) {
      const token = generateToken(user.id);
      storeToken(token, user.id);
      const { passwordHash: _, ...safeUser } = user;
      res.status(200).json({ user: { ...safeUser, driverProfile: null }, token, resuming: true });
      return;
    }
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const [user] = await db.insert(usersTable).values({
    name,
    email,
    passwordHash: hashPassword(password),
    phone,
    role,
    accountStatus: "pending",
    ...(cpf ? { cpf } : {}),
    ...(address ? { address } : {}),
  }).returning();

  // Log activity
  await db.insert(activityLogTable).values({
    type: role === "driver" ? "driver_registered" : "new_passenger",
    description: `${role === "driver" ? "Novo motorista" : "Novo passageiro"} cadastrado: ${name}`,
    userId: user.id,
    userName: user.name,
  });

  const token = generateToken(user.id);
  storeToken(token, user.id);
  const { passwordHash: _, ...safeUser } = user;
  res.status(201).json({ user: { ...safeUser, driverProfile: null }, token });
});

authRouter.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error" });
    return;
  }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || user.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: "Email ou senha inválidos" });
    return;
  }
  if (user.isSuspended) {
    res.status(403).json({ error: "Sua conta foi suspensa. Entre em contato com o suporte." });
    return;
  }
  // Load driver profile if driver
  let driverProfile = null;
  if (user.role === "driver") {
    const profiles = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, user.id));
    driverProfile = profiles[0] ?? null;
  }
  const token = generateToken(user.id);
  storeToken(token, user.id);
  const { passwordHash: _, ...safeUser } = user;
  res.json({ user: { ...safeUser, driverProfile }, token });
});

// Returns info needed for WhatsApp activation screen
authRouter.get("/whatsapp-info", (_req, res) => {
  res.json({ ownerNumber: OWNER_WHATSAPP_NUMBER });
});

// Marks WhatsApp as activated and optionally sends a welcome message to the user
authRouter.post("/send-welcome", async (req, res) => {
  const { name, phone, role, userId } = req.body;
  if (!name || !phone || !role || !userId) {
    res.status(400).json({ error: "name, phone, role e userId são obrigatórios" });
    return;
  }
  // Mark whatsapp as activated immediately
  await db.update(usersTable)
    .set({ whatsappActivated: true })
    .where(eq(usersTable.id, userId));

  // Best-effort: send a welcome message via Twilio (non-blocking, does not affect activation)
  sendWelcome({ name, phone, role }).catch(() => {});

  res.json({ ok: true });
});

authRouter.post("/logout", requireAuth, (req, res) => {
  const auth = req.headers["authorization"];
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token) removeToken(token);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = (req as any).user;
  let driverProfile = null;
  if (user.role === "driver") {
    const profiles = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, user.id));
    driverProfile = profiles[0] ?? null;
  }
  const { passwordHash: _, ...safeUser } = user;
  res.json({ ...safeUser, driverProfile });
});
