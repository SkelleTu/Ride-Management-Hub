import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Fingerprint, Loader2, CheckCircle, ShieldCheck, ShieldAlert, MonitorSmartphone, ScanFace } from "lucide-react";
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

type Stage = "checking" | "ready" | "no-device" | "loading" | "blocked" | "done" | "skipped";

export function BiometricSetup({ token, email, onDone }: BiometricSetupProps) {
  const [stage, setStage] = useState<Stage>("checking");
  const { toast } = useToast();

  useEffect(() => {
    deviceHasBiometric().then((has) => {
      setStage(has ? "ready" : "no-device");
    });
  }, []);

  if (stage === "checking") return null;

  const handleRegister = async () => {
    setStage("loading");
    try {
      const ok = await registerBiometric(token);
      if (ok) {
        setBiometricEmail(email);
        setStage("done");
        setTimeout(onDone, 2000);
      } else {
        setStage("ready");
        toast({ title: "Não foi possível verificar", description: "Tente novamente.", variant: "destructive" });
      }
    } catch (err: any) {
      if (isSilentBiometricError(err)) {
        // Blocked by environment (iframe, cross-origin, etc.) — show explanation instead of silently skipping
        setStage("blocked");
      } else {
        setStage("ready");
        toast({
          title: "Verificação não concluída",
          description: err?.message || "Tente novamente ou pule por agora.",
          variant: "destructive",
        });
      }
    }
  };

  const handleSkip = () => {
    setStage("skipped");
    setTimeout(onDone, 1200);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && stage !== "loading" && stage !== "done") handleSkip(); }}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <div className="flex justify-center mb-3">
            {stage === "done" ? (
              <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
                <ShieldCheck className="w-9 h-9 text-green-400" />
              </div>
            ) : stage === "skipped" ? (
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <ShieldAlert className="w-9 h-9 text-yellow-400" />
              </div>
            ) : stage === "no-device" ? (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <MonitorSmartphone className="w-9 h-9 text-muted-foreground" />
              </div>
            ) : stage === "blocked" ? (
              <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center">
                <ShieldAlert className="w-9 h-9 text-orange-400" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                <ScanFace className="w-9 h-9 text-primary" />
              </div>
            )}
          </div>

          <DialogTitle className="text-xl font-bold">
            {stage === "done" && "Identidade verificada!"}
            {stage === "skipped" && "Verificação pendente"}
            {stage === "no-device" && "Dispositivo sem biometria"}
            {stage === "blocked" && "Biometria indisponível aqui"}
            {(stage === "ready" || stage === "loading") && "Verificação de identidade"}
          </DialogTitle>

          <DialogDescription className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            {stage === "done" &&
              "Sua digital e/ou Face ID foram registrados com sucesso. Você pode entrar com biometria nos próximos acessos."}
            {stage === "skipped" &&
              "Você ainda não verificou sua identidade. Ative nas configurações do app pelo celular quando quiser."}
            {stage === "no-device" &&
              "Este dispositivo não tem leitor biométrico disponível. Acesse pelo celular para cadastrar Face ID ou digital."}
            {stage === "blocked" &&
              "A biometria não pode ser usada aqui porque você está acessando via navegador de mesa ou num ambiente restrito. No celular, Face ID e digital funcionam normalmente."}
            {(stage === "ready" || stage === "loading") &&
              "Por segurança, cadastre sua digital ou Face ID. O sistema usa o sensor do seu dispositivo — nenhum dado biométrico é enviado ao servidor."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-5">
          {stage === "ready" && (
            <>
              <Button className="w-full gap-2 h-12 text-base font-semibold" onClick={handleRegister}>
                <Fingerprint className="w-5 h-5" />
                Verificar com digital / Face ID
              </Button>
              <p className="text-xs text-muted-foreground">
                Quando solicitado, toque no sensor ou olhe para a câmera frontal
              </p>
              <button
                onClick={handleSkip}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Pular por agora
              </button>
            </>
          )}

          {stage === "loading" && (
            <div className="flex items-center justify-center gap-2 py-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Aguardando biometria...</span>
            </div>
          )}

          {(stage === "no-device" || stage === "blocked") && (
            <>
              <div className="bg-secondary/60 rounded-xl p-3 text-xs text-muted-foreground text-left space-y-1">
                <p className="font-medium text-foreground">📱 No celular funciona assim:</p>
                <p>• <strong>iPhone/iPad</strong> — Face ID ou Touch ID</p>
                <p>• <strong>Android</strong> — Digital ou reconhecimento facial</p>
              </div>
              <Button className="w-full h-12" onClick={handleSkip}>
                Continuar e ativar depois
              </Button>
            </>
          )}

          {stage === "done" && (
            <div className="flex items-center justify-center gap-2 text-green-500 py-2">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Redirecionando...</span>
            </div>
          )}

          {stage === "skipped" && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Continuando...</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
