import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Fingerprint, Loader2, CheckCircle, X, MonitorSmartphone } from "lucide-react";
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
        setTimeout(onDone, 1500);
      }
    } catch (err: any) {
      if (!isSilentBiometricError(err)) {
        toast({
          title: "Biometria não cadastrada",
          description: err?.message || "Tente novamente mais tarde.",
          variant: "destructive",
        });
      }
      onDone();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !loading) onDone(); }}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            {done ? (
              <CheckCircle className="w-14 h-14 text-green-400" />
            ) : hasBiometric ? (
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Fingerprint className="w-8 h-8 text-primary" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <MonitorSmartphone className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
          </div>
          <DialogTitle className="text-xl">
            {done ? "Biometria cadastrada!" : "Segurança biométrica"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            {done
              ? "Agora você pode entrar com sua digital ou reconhecimento facial."
              : hasBiometric
              ? "Use sua digital ou reconhecimento facial para entrar mais rápido e com mais segurança."
              : "Seu navegador ou dispositivo não suporta biometria neste momento. Você poderá ativar depois nas configurações do app, em um celular ou computador com leitor biométrico."}
          </DialogDescription>
        </DialogHeader>

        {!done && (
          <div className="flex flex-col gap-3 mt-4">
            {hasBiometric && (
              <Button
                className="w-full gap-2 h-12"
                onClick={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Fingerprint className="w-5 h-5" />
                )}
                {loading ? "Aguardando biometria..." : "Cadastrar digital / Face ID"}
              </Button>
            )}
            <Button
              variant={hasBiometric ? "ghost" : "default"}
              className="w-full gap-2"
              onClick={onDone}
              disabled={loading}
            >
              {hasBiometric ? (
                <>
                  <X className="w-4 h-4" />
                  Agora não
                </>
              ) : (
                "Continuar sem biometria"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
