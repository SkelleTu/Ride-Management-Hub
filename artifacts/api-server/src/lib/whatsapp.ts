import twilio from "twilio";
import { logger } from "./logger";

const OWNER_PHONE = "whatsapp:+5519997238298";

function getClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN são obrigatórios");
  }
  return twilio(accountSid, authToken);
}

function getFromNumber() {
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) throw new Error("TWILIO_WHATSAPP_FROM é obrigatório");
  return from;
}

function normalizePhone(phone: string): string {
  if (phone.startsWith("whatsapp:")) return phone;
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return `whatsapp:+${digits}`;
  return `whatsapp:+55${digits}`;
}

export async function notifyOwner(params: {
  name: string;
  email: string;
  phone: string;
  role: "passenger" | "driver";
}): Promise<void> {
  const { name, email, phone, role } = params;
  const roleLabel = role === "driver" ? "Motorista" : "Passageiro";

  try {
    const client = getClient();
    const from = getFromNumber();
    await client.messages.create({
      from,
      to: OWNER_PHONE,
      body:
        `🔔 *Novo cadastro no UPcar!*\n\n` +
        `👤 Nome: ${name}\n` +
        `📧 Email: ${email}\n` +
        `📱 Telefone: ${phone}\n` +
        `🏷️ Perfil: ${roleLabel}\n\n` +
        `Acesse o painel para ativar ou revisar o cadastro.`,
    });
    logger.info({ name, role }, "Notificação WhatsApp enviada ao proprietário");
  } catch (err) {
    logger.warn({ err }, "Falha ao notificar proprietário via WhatsApp");
  }
}

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
