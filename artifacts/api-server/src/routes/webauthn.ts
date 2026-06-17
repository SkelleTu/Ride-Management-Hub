import { Router } from "express";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { db, usersTable, webauthnCredentialsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, generateToken } from "../lib/auth";

export const webauthnRouter = Router();

function getRpInfo() {
  const devDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
  const allDomains = (process.env.REPLIT_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);

  const primaryDomain = devDomain ?? allDomains[0] ?? "localhost";
  const rpID = primaryDomain;

  const origins: string[] = [];
  if (devDomain) origins.push(`https://${devDomain}`);
  for (const d of allDomains) {
    const o = `https://${d}`;
    if (!origins.includes(o)) origins.push(o);
  }
  if (origins.length === 0) origins.push("http://localhost:5000");

  return { rpID, origins };
}

const challengeStore = new Map<number, string>();

webauthnRouter.post("/register-options", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { rpID } = getRpInfo();

  const options = await generateRegistrationOptions({
    rpName: "UPcar",
    rpID,
    userName: user.email,
    userDisplayName: user.name,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  challengeStore.set(user.id, options.challenge);
  res.json(options);
});

webauthnRouter.post("/register-verify", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { rpID, origin } = getRpInfo();
  const expectedChallenge = challengeStore.get(user.id);

  if (!expectedChallenge) {
    res.status(400).json({ error: "Desafio não encontrado. Tente novamente." });
    return;
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: "Verificação falhou" });
      return;
    }

    const { credential } = verification.registrationInfo;

    await db.insert(webauthnCredentialsTable).values({
      userId: user.id,
      credentialId: Buffer.from(credential.id).toString("base64url"),
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
    }).onConflictDoUpdate({
      target: webauthnCredentialsTable.credentialId,
      set: {
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
      },
    });

    challengeStore.delete(user.id);
    res.json({ verified: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? "Erro ao registrar biometria" });
  }
});

const authChallengeStore = new Map<string, string>();

webauthnRouter.post("/authenticate-options", async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    res.status(400).json({ error: "Email obrigatório" });
    return;
  }

  const { rpID } = getRpInfo();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  const creds = await db
    .select()
    .from(webauthnCredentialsTable)
    .where(eq(webauthnCredentialsTable.userId, user.id));

  if (creds.length === 0) {
    res.status(404).json({ error: "Nenhuma biometria cadastrada para este usuário" });
    return;
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    timeout: 60000,
    allowCredentials: creds.map((c) => ({
      id: c.credentialId,
    })),
  });

  authChallengeStore.set(email, options.challenge);
  res.json(options);
});

webauthnRouter.post("/authenticate-verify", async (req, res) => {
  const { email, credential } = req.body ?? {};
  if (!email || !credential) {
    res.status(400).json({ error: "Dados incompletos" });
    return;
  }

  const { rpID, origin } = getRpInfo();
  const expectedChallenge = authChallengeStore.get(email);

  if (!expectedChallenge) {
    res.status(400).json({ error: "Desafio expirado. Tente novamente." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || user.isSuspended) {
    res.status(401).json({ error: "Acesso negado" });
    return;
  }

  const credentialId = credential.id as string;

  const [storedCred] = await db
    .select()
    .from(webauthnCredentialsTable)
    .where(eq(webauthnCredentialsTable.credentialId, credentialId));

  if (!storedCred) {
    res.status(404).json({ error: "Biometria não reconhecida" });
    return;
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
      credential: {
        id: storedCred.credentialId,
        publicKey: Buffer.from(storedCred.publicKey, "base64url"),
        counter: storedCred.counter,
      },
    });

    if (!verification.verified) {
      res.status(401).json({ error: "Verificação biométrica falhou" });
      return;
    }

    await db
      .update(webauthnCredentialsTable)
      .set({ counter: verification.authenticationInfo.newCounter })
      .where(eq(webauthnCredentialsTable.id, storedCred.id));

    authChallengeStore.delete(email);

    const token = generateToken(user.id);
    const { passwordHash: _, ...safeUser } = user;
    res.json({ token, user: { ...safeUser, driverProfile: null } });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? "Erro na autenticação biométrica" });
  }
});
