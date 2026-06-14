import { useEffect, useState } from "react";
import { MessageCircle, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UPcarLogo } from "@/components/ui/UPcarLogo";

interface Props {
  name: string;
  phone: string;
  role: "passenger" | "driver";
  token: string;
  onDone: () => void;
}

export function WhatsAppActivation({ name, phone, role, token, onDone }: Props) {
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/whatsapp-info")
      .then((r) => r.json())
      .then(({ number, sandboxCode }) => {
        const msg = sandboxCode
          ? `join ${sandboxCode}`
          : `Olá! Acabei de me cadastrar no UPcar como ${role === "driver" ? "motorista" : "passageiro"}.`;
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const url = isMobile
          ? `https://wa.me/${number}?text=${encodeURIComponent(msg)}`
          : `https://web.whatsapp.com/send/?phone=${number}&text=${encodeURIComponent(msg)}&type=phone_number&app_absent=0`;
        setWhatsappUrl(url);
      })
      .catch(() => {
        setWhatsappUrl(`https://web.whatsapp.com/send/?phone=14155238886`);
      });
  }, [role]);

  const handleOpenWhatsApp = () => {
    if (!whatsappUrl) return;
    window.open(whatsappUrl, "_blank");
    setOpened(true);
  };

  const handleContinue = async () => {
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/send-welcome", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, phone, role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao enviar mensagem");
      }
      setSent(true);
      setTimeout(() => onDone(), 1500);
    } catch (err: any) {
      setError(err.message ?? "Erro ao enviar mensagem de boas-vindas");
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <UPcarLogo size={48} />

        {sent ? (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="w-16 h-16 text-green-500 animate-in zoom-in duration-300" />
            <h2 className="text-2xl font-bold">Tudo pronto!</h2>
            <p className="text-muted-foreground">Você receberá uma mensagem de boas-vindas no WhatsApp agora. 🎉</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold">Ative seu WhatsApp</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Para receber atualizações da sua conta, abra o WhatsApp abaixo e toque em <strong>Enviar</strong>. É só isso!
              </p>
            </div>

            <div className="w-full flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full h-14 text-base font-semibold bg-green-600 hover:bg-green-700 text-white gap-2"
                onClick={handleOpenWhatsApp}
                disabled={!whatsappUrl}
              >
                {!whatsappUrl ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <MessageCircle className="w-5 h-5" />
                    Abrir WhatsApp
                  </>
                )}
              </Button>

              {opened && (
                <Button
                  size="lg"
                  variant="default"
                  className="w-full h-12 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  onClick={handleContinue}
                  disabled={sending}
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Já enviei, continuar
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <div className="bg-secondary/50 rounded-xl p-4 text-left w-full">
              <p className="text-xs text-muted-foreground leading-relaxed">
                📱 O WhatsApp será aberto com a mensagem já preenchida. Você só precisa tocar em <strong>Enviar</strong> e voltar para o app.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
