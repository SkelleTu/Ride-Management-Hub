import { useEffect, useRef, useState } from "react";
import { MessageCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UPcarLogo } from "@/components/ui/UPcarLogo";

interface Props {
  name: string;
  phone: string;
  role: "passenger" | "driver";
  token: string;
  userId: number;
  onDone: () => void;
}

type Stage = "idle" | "waiting" | "sending" | "done" | "error";

export function WhatsAppActivation({ name, phone, role, token, userId, onDone }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const hasReturned = useRef(false);

  useEffect(() => {
    fetch("/api/auth/whatsapp-info")
      .then((r) => r.json())
      .then(({ ownerNumber }) => {
        const roleLabel = role === "driver" ? "motorista" : "passageiro";
        const msg =
          `🚗 *Novo cadastro no UPcar!*\n\n` +
          `👤 Nome: ${name}\n` +
          `📱 Telefone: ${phone}\n` +
          `🏷️ Perfil: ${role === "driver" ? "Motorista" : "Passageiro"}`;
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const url = isMobile
          ? `https://wa.me/${ownerNumber}?text=${encodeURIComponent(msg)}`
          : `https://web.whatsapp.com/send/?phone=${ownerNumber}&text=${encodeURIComponent(msg)}&type=phone_number&app_absent=0`;
        setWhatsappUrl(url);
      })
      .catch(() => setWhatsappUrl("https://wa.me/5519997238298"));
  }, [name, phone, role]);

  const activate = async () => {
    if (hasReturned.current) return;
    hasReturned.current = true;
    setStage("sending");
    try {
      const res = await fetch("/api/auth/send-welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, phone, role, userId }),
      });
      if (!res.ok) throw new Error("Erro ao ativar");
      setStage("done");
      setTimeout(() => onDone(), 2000);
    } catch (err: any) {
      hasReturned.current = false;
      setErrorMsg(err.message ?? "Tente novamente");
      setStage("error");
    }
  };

  const handleOpenWhatsApp = () => {
    if (!whatsappUrl) return;
    window.open(whatsappUrl, "_blank");
    setStage("waiting");
  };

  const roleLabel = role === "driver" ? "motorista" : "passageiro";

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <UPcarLogo size={48} />

        {stage === "done" ? (
          <div className="flex flex-col items-center gap-3 animate-in zoom-in duration-300">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <h2 className="text-2xl font-bold">Conta ativada!</h2>
            <p className="text-muted-foreground text-sm">
              Sua mensagem foi enviada e sua conta está pronta. 🎉
            </p>
          </div>

        ) : stage === "sending" ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <h2 className="text-xl font-semibold">Ativando conta...</h2>
            <p className="text-muted-foreground text-sm">Só um segundo.</p>
          </div>

        ) : stage === "waiting" ? (
          <div className="flex flex-col items-center gap-5 w-full">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center animate-pulse">
              <MessageCircle className="w-8 h-8 text-green-500" />
            </div>
            <div className="space-y-1 text-center">
              <h2 className="text-xl font-bold">Quase lá!</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Toque <strong>Enviar</strong> no WhatsApp e depois clique no botão abaixo para confirmar.
              </p>
            </div>
            <Button
              size="lg"
              className="w-full h-14 text-base font-semibold gap-2"
              onClick={activate}
            >
              <CheckCircle2 className="w-5 h-5" />
              Já enviei a mensagem ✓
            </Button>
            <button
              className="text-xs text-muted-foreground underline underline-offset-2"
              onClick={handleOpenWhatsApp}
            >
              Reabrir WhatsApp
            </button>
          </div>

        ) : (
          <>
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold">Último passo</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Para ativar seu cadastro como <strong>{roleLabel}</strong>, nos envie uma mensagem pelo WhatsApp. É só tocar no botão!
              </p>
            </div>

            {/* Preview of the message that will be sent */}
            <div className="w-full bg-green-500/5 border border-green-500/20 rounded-2xl p-4 text-left space-y-1">
              <p className="text-xs text-muted-foreground font-medium mb-2">Mensagem que será enviada:</p>
              <p className="text-sm font-semibold">🚗 Novo cadastro no UPcar!</p>
              <p className="text-sm text-muted-foreground">👤 Nome: {name}</p>
              <p className="text-sm text-muted-foreground">📱 Telefone: {phone}</p>
              <p className="text-sm text-muted-foreground">🏷️ Perfil: {role === "driver" ? "Motorista" : "Passageiro"}</p>
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
                  Enviar pelo WhatsApp
                </>
              )}
            </Button>

            {stage === "error" && (
              <div className="w-full bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-sm text-destructive text-left">
                {errorMsg}
                <button
                  className="block mt-1 underline text-xs"
                  onClick={() => { hasReturned.current = false; setStage("idle"); }}
                >
                  Tentar de novo
                </button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              O WhatsApp abrirá com a mensagem pronta — só toque <strong>Enviar</strong> e volte aqui.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
