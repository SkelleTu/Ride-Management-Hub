import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Fingerprint, Loader2, CheckCircle, ShieldCheck, ShieldAlert, MonitorSmartphone } from "lucide-react";
import { registerBiometric, setBiometricEmail, deviceHasBiometric } from "@/lib/useBiometric";
import { useToast } from "@/hooks/use-toast";

interface BiometricSetupProps {
  token: string;
  email: string;
  onDone: () => void;
}

function isSilentBiometricError(err: any): boolean {
  const msg: string = (err?.message ?? err?.name ?? "").toLowerCase();
  return (
    msg.includes("not allowed") ||
    msg.includes("notallowederror") ||
    msg.includes("cancelled") ||
    msg.includes("canceled") ||
    msg.includes("not enabled in this document") ||
    msg.includes("permissions policy") ||
    msg.includes("publickey-credentials") ||
    msg.includes("cross-origin") ||
    msg.includes("security error") ||
    err?.name === "NotAllowedError" ||
    err?.name === "SecurityError"
  );
}

export function BiometricSetup({ token, email, onDone }: BiometricSetupProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    deviceHasBiometric().then((has) => {
      setHasBiometric(has);
      setChecking(false);
    });
  }, []);

  if (checking) return null;

  const handleRegister = async () => {
    setLoading(true);
    try {
      const ok = await registerBiometric(token);
      if (ok) {
        setBiometricEmail(email);
        setDone(true);
        setTimeout(onDone, 2000);
      }
    } catch (err: any) {
      if (!isSilentBiometricError(err)) {
        toast({
          title: "Verificação não concluída",
          description: err?.message || "Tente novamente ou pule por agora.",
          variant: "destructive",
        });
      }
      onDone();
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    setSkipped(true);
    setTimeout(onDone, 1500);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !loading && !done) handleSkip(); }}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <div className="flex justify-center mb-3">
            {done ? (
              <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
                <ShieldCheck className="w-9 h-9 text-green-400" />
              </div>
            ) : skipped ? (
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <ShieldAlert className="w-9 h-9 text-yellow-400" />
              </div>
            ) : hasBiometric ? (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                <Fingerprint className="w-9 h-9 text-primary" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <MonitorSmartphone className="w-9 h-9 text-muted-foreground" />
              </div>
            )}
          </div>

          <DialogTitle className="text-xl font-bold">
            {done
              ? "Identidade verificada!"
              : skipped
              ? "Verificação pendente"
              : "Verificação de identidade"}
          </DialogTitle>

          <DialogDescription className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            {done
              ? "Sua digital e/ou Face ID foram registrados. Você pode entrar a qualquer momento com biometria."
              : skipped
              ? "Você ainda não verificou sua identidade. Recomendamos ativar nas configurações do app assim que possível."
              : hasBiometric
              ? "Por segurança, todos os usuários precisam registrar digital ou Face ID. Isso protege sua conta e confirma sua identidade."
              : "Seu dispositivo não suporta biometria neste momento. Você poderá ativar depois pelo celular ou computador com leitor biométrico."}
          </DialogDescription>
        </DialogHeader>

        {!done && !skipped && (
          <div className="flex flex-col gap-3 mt-5">
            {hasBiometric && (
              <>
                <Button
                  className="w-full gap-2 h-12 text-base font-semibold"
                  onClick={handleRegister}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Fingerprint className="w-5 h-5" />
                  )}
                  {loading ? "Aguardando biometria..." : "Verificar com digital / Face ID"}
                </Button>
                <div className="text-xs text-muted-foreground">
                  Pressione o leitor biométrico ou olhe para a câmera quando solicitado
                </div>
                <button
                  onClick={handleSkip}
                  disabled={loading}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 disabled:opacity-40"
                >
                  Pular verificação por agora
                </button>
              </>
            )}
            {!hasBiometric && (
              <Button
                className="w-full h-12"
                onClick={handleSkip}
              >
                Continuar sem biometria
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
