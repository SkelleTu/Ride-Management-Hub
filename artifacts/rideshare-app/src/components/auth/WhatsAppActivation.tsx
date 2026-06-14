import { useEffect, useRef, useState } from "react";
import { MessageCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UPcarLogo } from "@/components/ui/UPcarLogo";

interface Props {
  name: string;
  phone: string;
  role: "passenger" | "driver";
  token: string;
  onDone: () => void;
}

type Stage = "idle" | "opening" | "waiting" | "sending" | "done" | "error";

export function WhatsAppActivation({ name, phone, role, token, onDone }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const hasReturned = useRef(false);

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
      .catch(() => setWhatsappUrl(`https://web.whatsapp.com/send/?phone=14155238886`));
  }, [role]);

  const sendWelcome = async () => {
    if (hasReturned.current) return;
    hasReturned.current = true;
    setStage("sending");
    try {
      const res = await fetch("/api/auth/send-welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, phone, role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao enviar mensagem");
      }
      setStage("done");
      setTimeout(() => onDone(), 2000);
    } catch (err: any) {
      hasReturned.current = false;
      setErrorMsg(err.message ?? "Erro ao enviar mensagem");
      setStage("error");
    }
  };

  const handleOpenWhatsApp = () => {
    if (!whatsappUrl) return;
    setStage("opening");

    window.open(whatsappUrl, "_blank");

    setTimeout(() => setStage("waiting"), 800);

    const onReturn = () => {
      if (document.visibilityState === "visible" && stage !== "done" && stage !== "sending") {
        document.removeEventListener("visibilitychange", onReturn);
        window.removeEventListener("focus", onFocus);
        setTimeout(() => sendWelcome(), 600);
      }
    };

    const onFocus = () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onFocus);
      setTimeout(() => sendWelcome(), 600);
    };

    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onFocus);
  };

  const roleLabel = role === "driver" ? "motorista" : "passageiro";

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <UPcarLogo size={48} />

        {stage === "done" ? (
          <div className="flex flex-col items-center gap-3 animate-in zoom-in duration-300">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <h2 className="text-2xl font-bold">Tudo pronto!</h2>
            <p className="text-muted-foreground">
              Sua boas-vindas chegará agora no WhatsApp. 🎉
            </p>
          </div>

        ) : stage === "sending" ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <h2 className="text-xl font-semibold">Ativando sua conta...</h2>
            <p className="text-muted-foreground text-sm">Aguarde só um momento.</p>
          </div>

        ) : stage === "waiting" ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center animate-pulse">
              <MessageCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold">Enviou a mensagem?</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Toque em <strong>Enviar</strong> no WhatsApp e volte aqui.<br />
              O app continuará automaticamente assim que você voltar.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Aguardando seu retorno...
            </p>
          </div>

        ) : (
          <>
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold">Um último passo</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Para ativar sua conta como <strong>{roleLabel}</strong>, confirme pelo WhatsApp. É só tocar no botão abaixo!
              </p>
            </div>

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
                  Confirmar pelo WhatsApp
                </>
              )}
            </Button>

            {stage === "error" && (
              <div className="w-full bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-sm text-destructive text-left">
                {errorMsg} — tente novamente.
                <button
                  className="block mt-1 underline text-xs"
                  onClick={() => { hasReturned.current = false; setStage("idle"); }}
                >
                  Tentar de novo
                </button>
              </div>
            )}

            <div className="bg-secondary/50 rounded-xl p-4 text-left w-full">
              <p className="text-xs text-muted-foreground leading-relaxed">
                📱 O WhatsApp abrirá com a mensagem pronta. Toque <strong>Enviar</strong> e volte — o restante é automático.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
