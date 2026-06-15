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

// Sends a welcome message to the new user via Twilio (best-effort, non-blocking)
export async function sendWelcome(params: {
  name: string;
  phone: string;
  role: "passenger" | "driver";
}): Promise<void> {
  const { name, phone, role } = params;
  const roleLabel = role === "driver" ? "Motorista" : "Passageiro";
  const userPhone = normalizePhone(phone);

  const client = getClient();
  const from = getFromNumber();

  await client.messages.create({
    from,
    to: userPhone,
    body:
      `Olá, *${name}*! 👋\n\n` +
      `Bem-vindo(a) ao *UPcar*! 🚗\n\n` +
      `Seu cadastro como *${roleLabel}* foi recebido com sucesso.\n\n` +
      `Em breve nossa equipe entrará em contato por aqui para *ativar sua conta*. Fique de olho neste chat!\n\n` +
      `Qualquer dúvida, é só responder esta mensagem. 😊`,
  });

  logger.info({ name, role, userPhone }, "Mensagem de boas-vindas enviada ao usuário via WhatsApp");
}
