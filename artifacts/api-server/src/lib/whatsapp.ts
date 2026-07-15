import twilio from "twilio";
import { logger } from "./logger";

// Owner number for direct wa.me notification (sent by the new user directly)
export const OWNER_WHATSAPP_NUMBER = "5519997238298";

function getClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN são obrigatórios");
  }
  return twilio(accountSid, authToken);
}

function getFromNumber() {
  const raw = process.env.TWILIO_WHATSAPP_FROM;
  if (!raw) throw new Error("TWILIO_WHATSAPP_FROM é obrigatório");
  const from = raw.trim();
  if (!from.startsWith("whatsapp:")) {
    return `whatsapp:${from.startsWith("+") ? from : `+${from}`}`;
  }
  return from;
}

function normalizePhone(phone: string): string {
  if (phone.startsWith("whatsapp:")) return phone;
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return `whatsapp:+${digits}`;
  return `whatsapp:+55${digits}`;
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

async function send(to: string, body: string, context: Record<string, unknown>): Promise<void> {
  const client = getClient();
  const from = getFromNumber();
  await client.messages.create({ from, to: normalizePhone(to), body });
  logger.info({ ...context, to }, "WhatsApp enviado");
}

// ──────────────────────────────────────────────────────────────────────────────
// Welcome message sent to new users on registration
// ──────────────────────────────────────────────────────────────────────────────
export async function sendWelcome(params: {
  name: string;
  phone: string;
  role: "passenger" | "driver";
}): Promise<void> {
  const { name, phone, role } = params;
  const roleLabel = role === "driver" ? "Motorista" : "Passageiro";

  await send(
    phone,
    `Olá, *${name}*! 👋\n\n` +
    `Bem-vindo(a) ao *UPcar*! 🚗\n\n` +
    `Seu cadastro como *${roleLabel}* foi recebido com sucesso.\n\n` +
    `Em breve nossa equipe entrará em contato por aqui para *ativar sua conta*. Fique de olho neste chat!\n\n` +
    `Qualquer dúvida, é só responder esta mensagem. 😊`,
    { event: "welcome", name, role },
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Notifica o PASSAGEIRO quando um agendamento é criado (via agente ou plataforma)
// ──────────────────────────────────────────────────────────────────────────────
export async function sendRideScheduledConfirmation(params: {
  passenger: { name: string; phone: string };
  scheduledFor: Date;
  originAddress: string;
  destinationAddress: string;
  offeredPrice: number;
  rideId: number;
  note?: string | null;
}): Promise<void> {
  const { passenger, scheduledFor, originAddress, destinationAddress, offeredPrice, rideId, note } = params;

  const lines = [
    `📅 *Agendamento Confirmado — UPcar*`,
    ``,
    `Olá, *${passenger.name}*! Sua corrida foi agendada com sucesso.`,
    ``,
    `🗓 *Data/hora:* ${formatDateTime(scheduledFor)}`,
    `📍 *Origem:* ${originAddress}`,
    `🏁 *Destino:* ${destinationAddress}`,
    `💰 *Valor:* R$ ${offeredPrice.toFixed(2)}`,
  ];
  if (note) lines.push(`📝 *Observação:* ${note}`);
  lines.push(``);
  lines.push(`Em breve um motorista irá confirmar sua corrida. Você receberá uma notificação aqui! 🚗`);
  lines.push(`Pedido #${rideId}`);

  await send(passenger.phone, lines.join("\n"), { event: "ride_scheduled", rideId });
}

// ──────────────────────────────────────────────────────────────────────────────
// Notifica o PASSAGEIRO quando o motorista confirma o agendamento
// ──────────────────────────────────────────────────────────────────────────────
export async function sendRideConfirmedByDriver(params: {
  passenger: { name: string; phone: string };
  driver: { name: string; phone: string };
  scheduledFor: Date;
  originAddress: string;
  destinationAddress: string;
  rideId: number;
}): Promise<void> {
  const { passenger, driver, scheduledFor, originAddress, destinationAddress, rideId } = params;

  const lines = [
    `✅ *Motorista Confirmado — UPcar*`,
    ``,
    `Boa notícia, *${passenger.name}*!`,
    ``,
    `O motorista *${driver.name}* confirmou sua corrida agendada.`,
    ``,
    `🗓 *Data/hora:* ${formatDateTime(scheduledFor)}`,
    `📍 *Origem:* ${originAddress}`,
    `🏁 *Destino:* ${destinationAddress}`,
    ``,
    `Fique tranquilo(a)! Está tudo certo para o dia da corrida. 😊`,
    `Pedido #${rideId}`,
  ];

  await send(passenger.phone, lines.join("\n"), { event: "ride_confirmed_by_driver", rideId });
}

// ──────────────────────────────────────────────────────────────────────────────
// Notifica o MOTORISTA quando uma corrida é direcionada/atribuída a ele
// ──────────────────────────────────────────────────────────────────────────────
export async function sendRideDirectedToDriver(params: {
  driver: { name: string; phone: string };
  passenger: { name: string; phone: string };
  scheduledFor: Date;
  originAddress: string;
  destinationAddress: string;
  offeredPrice: number;
  rideId: number;
  note?: string | null;
}): Promise<void> {
  const { driver, passenger, scheduledFor, originAddress, destinationAddress, offeredPrice, rideId, note } = params;

  const lines = [
    `🚗 *Nova Corrida Direcionada — UPcar*`,
    ``,
    `Olá, *${driver.name}*! Uma corrida agendada foi direcionada especialmente para você.`,
    ``,
    `👤 *Passageiro:* ${passenger.name}`,
    `🗓 *Data/hora:* ${formatDateTime(scheduledFor)}`,
    `📍 *Origem:* ${originAddress}`,
    `🏁 *Destino:* ${destinationAddress}`,
    `💰 *Valor oferecido:* R$ ${offeredPrice.toFixed(2)}`,
  ];
  if (note) lines.push(`📝 *Observação:* ${note}`);
  lines.push(``);
  lines.push(`Acesse o aplicativo para *confirmar ou recusar* este agendamento.`);
  lines.push(`Pedido #${rideId}`);

  await send(driver.phone, lines.join("\n"), { event: "ride_directed_to_driver", rideId });
}

// ──────────────────────────────────────────────────────────────────────────────
// Notifica o PASSAGEIRO quando seu agendamento é cancelado
// ──────────────────────────────────────────────────────────────────────────────
export async function sendRideCancelledNotification(params: {
  passenger: { name: string; phone: string };
  scheduledFor: Date;
  rideId: number;
  reason?: string | null;
}): Promise<void> {
  const { passenger, scheduledFor, rideId, reason } = params;

  const lines = [
    `❌ *Agendamento Cancelado — UPcar*`,
    ``,
    `Olá, *${passenger.name}*.`,
    ``,
    `Infelizmente o seu agendamento para *${formatDateTime(scheduledFor)}* foi cancelado.`,
  ];
  if (reason) lines.push(`📝 *Motivo:* ${reason}`);
  lines.push(``);
  lines.push(`Se precisar reagendar ou tiver dúvidas, entre em contato conosco pelo WhatsApp. 😊`);
  lines.push(`Pedido #${rideId}`);

  await send(passenger.phone, lines.join("\n"), { event: "ride_cancelled", rideId });
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: dispara uma notificação de forma não-bloqueante (best-effort).
// Erros são logados mas NÃO propagados — jamais devem falhar a operação principal.
// ──────────────────────────────────────────────────────────────────────────────
export function sendAsync<T>(
  fn: () => Promise<T>,
  context: Record<string, unknown> = {},
): void {
  fn().catch((err: unknown) => {
    logger.warn({ ...context, err }, "Falha ao enviar notificação WhatsApp (não crítico)");
  });
}
