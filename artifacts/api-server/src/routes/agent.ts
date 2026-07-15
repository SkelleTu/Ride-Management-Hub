import { Router, type Request, type Response, type NextFunction } from "express";
import { db, usersTable, ridesTable, activityLogTable, driverProfilesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { computeAvailability } from "../lib/scheduling";
import {
  sendRideScheduledConfirmation,
  sendRideCancelledNotification,
  sendRideDirectedToDriver,
  sendAsync,
} from "../lib/whatsapp";

/**
 * Este router expõe uma visão em tempo real da agenda da plataforma para
 * sistemas externos confiáveis — em especial o agente de IA do WhatsApp.
 * Cada resposta é computada diretamente do banco de dados no momento da
 * requisição. Não existe cópia sincronizada ou em cache em lugar nenhum,
 * portanto os dados são sempre precisos no instante em que um agendamento é
 * criado, confirmado ou cancelado.
 *
 * Substituição do Google Drive: o endpoint GET /agenda/file gera o mesmo
 * conteúdo que um arquivo sincronizado do Drive entregaria, mas de forma
 * nativa e sempre atualizada — sem custo de integração externo.
 *
 * Autenticação: segredo compartilhado enviado via header `x-agent-api-key`,
 * comparado com a variável de ambiente AGENT_API_KEY.
 */

export const agentRouter = Router();

/**
 * Normaliza um número de telefone para dígitos apenas, sem o código de país
 * brasileiro (55). Usado para comparação exata entre números armazenados e
 * números fornecidos pelo agente — evita ambiguidade de sufixo.
 *
 * Ex: "+55 (19) 99723-8298" → "19997238298"
 *     "5519997238298"       → "19997238298"
 *     "19997238298"         → "19997238298"
 */
function normalizePhoneDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  // Remove o código do país brasileiro (55) se presente
  if (d.startsWith("55") && d.length >= 12) return d.slice(2);
  return d;
}

/**
 * Busca um único usuário pelo telefone normalizado.
 * Retorna { user } se encontrado exatamente um, { ambiguous: true } se houver
 * múltiplos, ou { user: undefined } se não encontrado.
 */
async function findUserByPhone(
  phone: string,
  roleFilter?: string,
): Promise<{ user?: typeof usersTable.$inferSelect; ambiguous?: boolean }> {
  const normalized = normalizePhoneDigits(phone);
  const all = roleFilter
    ? await db.select().from(usersTable).where(eq(usersTable.role, roleFilter))
    : await db.select().from(usersTable);
  const matches = all.filter(u => normalizePhoneDigits(u.phone) === normalized);
  if (matches.length === 0) return { user: undefined };
  if (matches.length > 1) return { ambiguous: true };
  return { user: matches[0] };
}

function requireAgentAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.AGENT_API_KEY;
  if (!expected) {
    res.status(500).json({ error: "AGENT_API_KEY não está configurado no servidor" });
    return;
  }
  const provided = req.headers["x-agent-api-key"];
  if (typeof provided !== "string" || provided !== expected) {
    res.status(401).json({ error: "Header x-agent-api-key inválido ou ausente" });
    return;
  }
  next();
}

agentRouter.use(requireAgentAuth);

type ScheduledRideSummary = {
  id: number;
  status: string;
  scheduledStatus: string | null;
  schedulingType: string | null;
  scheduledFor: string | null;
  scheduledNote: string | null;
  originAddress: string;
  destinationAddress: string;
  offeredPrice: number;
  agreedPrice: number | null;
  passenger: { name: string; phone: string };
  driver: { name: string; phone: string } | null;
};

async function buildScheduleSnapshot(): Promise<{
  generatedAt: string;
  totalAgendamentos: number;
  agendamentos: ScheduledRideSummary[];
}> {
  const rides = await db.select().from(ridesTable).where(eq(ridesTable.isScheduled, true));

  rides.sort((a, b) => {
    const ta = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0;
    const tb = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0;
    return ta - tb;
  });

  // Exibe apenas corridas relevantes: não canceladas, e no futuro (ou até 1h atrás).
  const relevant = rides.filter(r => {
    if (r.scheduledStatus === "cancelled") return false;
    if (r.status === "cancelled") return false;
    if (r.scheduledFor && new Date(r.scheduledFor).getTime() < Date.now() - 60 * 60 * 1000) return false;
    return true;
  });

  const agendamentos: ScheduledRideSummary[] = await Promise.all(relevant.map(async (r) => {
    const [passenger] = await db.select().from(usersTable).where(eq(usersTable.id, r.passengerId));
    let driver: { name: string; phone: string } | null = null;
    if (r.driverId) {
      const [d] = await db.select().from(usersTable).where(eq(usersTable.id, r.driverId));
      if (d) driver = { name: d.name, phone: d.phone };
    }
    return {
      id: r.id,
      status: r.status,
      scheduledStatus: r.scheduledStatus,
      schedulingType: r.schedulingType,
      scheduledFor: r.scheduledFor ? new Date(r.scheduledFor).toISOString() : null,
      scheduledNote: r.scheduledNote,
      originAddress: r.originAddress,
      destinationAddress: r.destinationAddress,
      offeredPrice: r.offeredPrice,
      agreedPrice: r.agreedPrice,
      passenger: { name: passenger?.name ?? "?", phone: passenger?.phone ?? "?" },
      driver,
    };
  }));

  return {
    generatedAt: new Date().toISOString(),
    totalAgendamentos: agendamentos.length,
    agendamentos,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent/agenda — snapshot JSON ao vivo da agenda.
// ─────────────────────────────────────────────────────────────────────────────
agentRouter.get("/agenda", async (_req, res) => {
  res.json(await buildScheduleSnapshot());
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent/agenda/file — mesmo conteúdo em texto simples legível por IA.
// Substitui o papel que um arquivo sincronizado do Google Drive teria, mas
// gerado de forma nativa e sempre atualizado a cada requisição.
// ─────────────────────────────────────────────────────────────────────────────
agentRouter.get("/agenda/file", async (_req, res) => {
  const snapshot = await buildScheduleSnapshot();

  const lines: string[] = [];
  lines.push("AGENDA UPCAR — atualizada em tempo real");
  lines.push(`Gerado em: ${new Date(snapshot.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);
  lines.push(`Total de agendamentos ativos: ${snapshot.totalAgendamentos}`);
  lines.push("");

  if (snapshot.agendamentos.length === 0) {
    lines.push("Nenhum agendamento ativo no momento.");
  }

  for (const a of snapshot.agendamentos) {
    const dt = a.scheduledFor
      ? new Date(a.scheduledFor).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
      : "sem data";
    lines.push(`#${a.id} — ${dt}`);
    lines.push(`  Status: ${a.scheduledStatus ?? a.status}`);
    lines.push(`  Passageiro: ${a.passenger.name} (${a.passenger.phone})`);
    lines.push(`  Origem: ${a.originAddress}`);
    lines.push(`  Destino: ${a.destinationAddress}`);
    lines.push(`  Motorista: ${a.driver ? `${a.driver.name} (${a.driver.phone})` : "ainda não atribuído"}`);
    if (a.scheduledNote) lines.push(`  Observação: ${a.scheduledNote}`);
    lines.push("");
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(lines.join("\n"));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent/availability?date=YYYY-MM-DD&duration=N
// Slots de 30min com contagem de motoristas disponíveis.
// ─────────────────────────────────────────────────────────────────────────────
agentRouter.get("/availability", async (req, res) => {
  const { date, duration } = req.query as { date?: string; duration?: string };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "date obrigatório no formato YYYY-MM-DD" }); return;
  }
  const durationMin = parseInt(duration ?? "60");
  if (isNaN(durationMin) || durationMin < 5) {
    res.status(400).json({ error: "duration deve ser >= 5 minutos" }); return;
  }
  res.json(await computeAvailability(date, durationMin));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent/drivers — lista motoristas aprovados para o agente referenciar
// ao direcionar corridas ou responder perguntas sobre disponibilidade.
// ─────────────────────────────────────────────────────────────────────────────
agentRouter.get("/drivers", async (_req, res) => {
  const profiles = await db.select().from(driverProfilesTable)
    .where(eq(driverProfilesTable.status, "approved"));

  const drivers = await Promise.all(profiles.map(async (p) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, p.userId));
    if (!user || user.isSuspended) return null;
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      rating: user.rating,
      totalRides: user.totalRides,
      vehicleModel: p.vehicleModel,
      vehiclePlate: p.vehiclePlate,
      vehicleColor: p.vehicleColor,
      vehicleYear: p.vehicleYear,
    };
  }));

  res.json(drivers.filter(Boolean));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agent/agenda — cria um novo agendamento em nome de um passageiro
// existente, identificado por telefone. Usado pelo agente de WhatsApp quando
// um cliente solicita uma corrida com antecedência.
// ─────────────────────────────────────────────────────────────────────────────
agentRouter.post("/agenda", async (req, res) => {
  const body = req.body ?? {};
  const {
    passengerPhone,
    originAddress,
    originLat,
    originLng,
    destinationAddress,
    destinationLat,
    destinationLng,
    offeredPrice,
    scheduledFor,
    scheduledNote,
  } = body;

  if (typeof passengerPhone !== "string" || !passengerPhone.trim()) {
    res.status(400).json({ error: "passengerPhone é obrigatório" }); return;
  }
  for (const [key, val] of Object.entries({ originAddress, destinationAddress })) {
    if (typeof val !== "string" || !val.trim()) {
      res.status(400).json({ error: `${key} é obrigatório` }); return;
    }
  }
  for (const [key, val] of Object.entries({ originLat, originLng, destinationLat, destinationLng, offeredPrice })) {
    if (typeof val !== "number" || Number.isNaN(val)) {
      res.status(400).json({ error: `${key} deve ser um número` }); return;
    }
  }
  if (typeof scheduledFor !== "string") {
    res.status(400).json({ error: "scheduledFor é obrigatório (ISO date string)" }); return;
  }
  const scheduledDate = new Date(scheduledFor);
  if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
    res.status(400).json({ error: "scheduledFor deve ser uma data futura válida" }); return;
  }

  const { user: passenger, ambiguous: passengerAmbiguous } = await findUserByPhone(passengerPhone, "passenger");

  if (passengerAmbiguous) {
    res.status(409).json({ error: "Múltiplos passageiros encontrados com esse número. Contate o suporte." }); return;
  }
  if (!passenger) {
    res.status(404).json({
      error: "Passageiro não encontrado. O cliente precisa se cadastrar na plataforma antes de agendar.",
    });
    return;
  }

  const [ride] = await db.insert(ridesTable).values({
    passengerId: passenger.id,
    originAddress,
    originLat,
    originLng,
    destinationAddress,
    destinationLat,
    destinationLng,
    offeredPrice,
    status: "open",
    isScheduled: true,
    scheduledFor: scheduledDate,
    schedulingType: "public",
    scheduledStatus: "pending_acceptance",
    scheduledNote: typeof scheduledNote === "string" ? scheduledNote : null,
  }).returning();

  await db.insert(activityLogTable).values({
    type: "ride_scheduled",
    description: `Agendamento #${ride.id} criado via agente de WhatsApp para ${passenger.name} em ${scheduledDate.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    userId: passenger.id,
    userName: passenger.name,
  });

  // Notifica o passageiro via WhatsApp (best-effort, não bloqueia a resposta)
  sendAsync(
    () => sendRideScheduledConfirmation({
      passenger: { name: passenger.name, phone: passenger.phone },
      scheduledFor: scheduledDate,
      originAddress,
      destinationAddress,
      offeredPrice,
      rideId: ride.id,
      note: typeof scheduledNote === "string" ? scheduledNote : null,
    }),
    { event: "ride_scheduled", rideId: ride.id },
  );

  res.status(201).json({
    id: ride.id,
    scheduledFor: scheduledDate.toISOString(),
    status: ride.status,
    scheduledStatus: ride.scheduledStatus,
    passenger: { name: passenger.name, phone: passenger.phone },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/agent/agenda/:id/assign — atribui/direciona um agendamento a um
// motorista específico. O agente usa este endpoint quando o cliente pede um
// motorista específico ou quando o operador quer garantir o atendimento.
//
// Body: { driverPhone: string } OU { driverId: number }
// ─────────────────────────────────────────────────────────────────────────────
agentRouter.patch("/agenda/:id/assign", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "id inválido" }); return; }

  const { driverPhone, driverId: driverIdBody } = req.body ?? {};

  let driver: typeof usersTable.$inferSelect | undefined;

  if (typeof driverIdBody === "number") {
    const [d] = await db.select().from(usersTable).where(eq(usersTable.id, driverIdBody));
    driver = d;
  } else if (typeof driverPhone === "string" && driverPhone.trim()) {
    const { user, ambiguous } = await findUserByPhone(driverPhone, "driver");
    if (ambiguous) {
      res.status(409).json({ error: "Múltiplos motoristas encontrados com esse número. Use driverId." }); return;
    }
    driver = user;
  } else {
    res.status(400).json({ error: "driverPhone (string) ou driverId (number) é obrigatório" }); return;
  }

  if (!driver) {
    res.status(404).json({ error: "Motorista não encontrado na plataforma" }); return;
  }

  // Verifica se o motorista é aprovado
  const [profile] = await db.select().from(driverProfilesTable)
    .where(and(eq(driverProfilesTable.userId, driver.id), eq(driverProfilesTable.status, "approved")));
  if (!profile) {
    res.status(400).json({ error: "Motorista não está aprovado na plataforma" }); return;
  }

  const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, id));
  if (!ride || !ride.isScheduled) {
    res.status(404).json({ error: "Agendamento não encontrado" }); return;
  }
  if (ride.scheduledStatus === "cancelled") {
    res.status(409).json({ error: "Este agendamento já foi cancelado" }); return;
  }

  const [updated] = await db.update(ridesTable)
    .set({
      schedulingType: "directed",
      directedToDriverId: driver.id,
      scheduledStatus: "pending_acceptance",
      // Se já havia motorista, remove para que o novo aceite
      driverId: null,
      status: "open",
    })
    .where(eq(ridesTable.id, id))
    .returning();

  await db.insert(activityLogTable).values({
    type: "ride_scheduled",
    description: `Agendamento #${id} direcionado ao motorista ${driver.name} via agente de WhatsApp`,
    userId: driver.id,
    userName: driver.name,
  });

  // Notifica o motorista via WhatsApp (best-effort)
  const [passenger] = await db.select().from(usersTable).where(eq(usersTable.id, updated.passengerId));
  if (passenger && updated.scheduledFor) {
    sendAsync(
      () => sendRideDirectedToDriver({
        driver: { name: driver!.name, phone: driver!.phone },
        passenger: { name: passenger.name, phone: passenger.phone },
        scheduledFor: new Date(updated.scheduledFor!),
        originAddress: updated.originAddress,
        destinationAddress: updated.destinationAddress,
        offeredPrice: updated.offeredPrice,
        rideId: updated.id,
        note: updated.scheduledNote,
      }),
      { event: "ride_directed_to_driver", rideId: updated.id },
    );
  }

  res.json({
    id: updated.id,
    scheduledStatus: updated.scheduledStatus,
    schedulingType: updated.schedulingType,
    driver: { id: driver.id, name: driver.name, phone: driver.phone },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/agent/agenda/:id/cancel — cancela um agendamento existente.
// ─────────────────────────────────────────────────────────────────────────────
agentRouter.patch("/agenda/:id/cancel", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "id inválido" }); return; }
  const { reason } = req.body ?? {};

  const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, id));
  if (!ride || !ride.isScheduled) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }
  if (ride.scheduledStatus === "cancelled") {
    res.status(409).json({ error: "Este agendamento já foi cancelado" }); return;
  }

  const cancelReason = typeof reason === "string" && reason.trim()
    ? reason
    : "Cancelado via agente de WhatsApp";

  const [cancelled] = await db.update(ridesTable)
    .set({
      status: "cancelled",
      scheduledStatus: "cancelled",
      cancelReason,
    })
    .where(eq(ridesTable.id, id))
    .returning();

  await db.insert(activityLogTable).values({
    type: "ride_cancelled",
    description: `Agendamento #${id} cancelado via agente de WhatsApp${reason ? `: ${reason}` : ""}`,
    userId: cancelled.passengerId,
    userName: null,
  });

  // Notifica o passageiro via WhatsApp (best-effort)
  const [passenger] = await db.select().from(usersTable).where(eq(usersTable.id, cancelled.passengerId));
  if (passenger && cancelled.scheduledFor) {
    sendAsync(
      () => sendRideCancelledNotification({
        passenger: { name: passenger.name, phone: passenger.phone },
        scheduledFor: new Date(cancelled.scheduledFor!),
        rideId: cancelled.id,
        reason: cancelReason,
      }),
      { event: "ride_cancelled", rideId: cancelled.id },
    );
  }

  res.json({ id: cancelled.id, status: cancelled.status, scheduledStatus: cancelled.scheduledStatus });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agent/passengers — cadastra um novo passageiro diretamente pelo
// agente. Útil quando um cliente entra em contato pelo WhatsApp mas ainda não
// tem conta na plataforma.
//
// Body: { name, phone, email? }
// ─────────────────────────────────────────────────────────────────────────────
agentRouter.post("/passengers", async (req, res) => {
  const { name, phone, email } = req.body ?? {};

  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name é obrigatório" }); return;
  }
  if (typeof phone !== "string" || !phone.trim()) {
    res.status(400).json({ error: "phone é obrigatório" }); return;
  }

  // Verifica duplicata por telefone (match exato normalizado, em todos os roles)
  const { user: dupByPhone, ambiguous } = await findUserByPhone(phone);
  if (ambiguous) {
    res.status(409).json({ error: "Múltiplos usuários encontrados com esse número. Contate o suporte." }); return;
  }
  if (dupByPhone) {
    res.status(409).json({
      error: "Já existe um usuário cadastrado com este telefone",
      existing: { id: dupByPhone.id, name: dupByPhone.name, phone: dupByPhone.phone, role: dupByPhone.role },
    });
    return;
  }

  // E-mail fornecido ou sintético baseado no número normalizado
  const normalizedDigits = normalizePhoneDigits(phone);
  const resolvedEmail = typeof email === "string" && email.trim()
    ? email.trim().toLowerCase()
    : `passageiro.${normalizedDigits}@upcar.app`;

  // Verifica se o e-mail já está em uso (a coluna tem constraint UNIQUE)
  const [existingEmail] = await db.select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, resolvedEmail));
  if (existingEmail) {
    res.status(409).json({ error: "E-mail já está em uso. Forneça um e-mail diferente." }); return;
  }

  // Gera senha aleatória; NÃO é retornada na resposta — o passageiro deve
  // usar o fluxo de "esqueci minha senha" no aplicativo para definir a sua.
  const crypto = await import("crypto");
  const { hashPassword } = await import("../lib/auth");
  const passwordHash = hashPassword(crypto.randomBytes(16).toString("hex"));

  const [passenger] = await db.insert(usersTable).values({
    name: name.trim(),
    phone: phone.trim(),
    email: resolvedEmail,
    passwordHash,
    role: "passenger",
    accountStatus: "approved",
  }).returning();

  await db.insert(activityLogTable).values({
    type: "user_registered",
    description: `Passageiro ${passenger.name} cadastrado via agente de WhatsApp`,
    userId: passenger.id,
    userName: passenger.name,
  });

  res.status(201).json({
    id: passenger.id,
    name: passenger.name,
    phone: passenger.phone,
    email: passenger.email,
    message: "Passageiro cadastrado com sucesso. Oriente o cliente a acessar o aplicativo e usar 'Esqueci minha senha' para definir a senha com o e-mail cadastrado.",
  });
});
