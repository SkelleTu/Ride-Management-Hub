import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Fingerprint, Loader2, ShieldCheck, ShieldAlert, ScanFace, RefreshCw } from "lucide-react";
import { registerBiometric, setBiometricEmail } from "@/lib/useBiometric";

interface BiometricSetupProps {
  token: string;
  email: string;
  onDone: () => void;
}

type Stage = "ready" | "loading" | "done" | "blocked" | "no-hardware" | "skipped";

function classifyError(err: any): "blocked" | "no-hardware" | "other" {
  const msg: string = (err?.message ?? err?.name ?? "").toLowerCase();
  const name: string = err?.name ?? "";

  if (
    msg.includes("not allowed") ||
    msg.includes("permissions policy") ||
    msg.includes("publickey-credentials") ||
    msg.includes("cross-origin") ||
    msg.includes("security error") ||
    msg.includes("not enabled in this document") ||
    name === "NotAllowedError" ||
    name === "SecurityError"
  ) return "blocked";

  if (
    msg.includes("not supported") ||
    msg.includes("no credentials") ||
    msg.includes("authenticator") ||
    name === "NotSupportedError"
  ) return "no-hardware";

  return "other";
}

export function BiometricSetup({ token, email, onDone }: BiometricSetupProps) {
  const [stage, setStage] = useState<Stage>("ready");

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
      }
    } catch (err: any) {
      const kind = classifyError(err);
      if (kind === "blocked") setStage("blocked");
      else if (kind === "no-hardware") setStage("no-hardware");
      else setStage("ready");
    }
  };

  const handleSkip = () => {
    setStage("skipped");
    setTimeout(onDone, 1000);
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
            ) : stage === "blocked" || stage === "no-hardware" || stage === "skipped" ? (
              <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center">
                <ShieldAlert className="w-9 h-9 text-orange-400" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20 animate-pulse">
                <ScanFace className="w-9 h-9 text-primary" />
              </div>
            )}
          </div>

          <DialogTitle className="text-xl font-bold">
            {stage === "done"       && "Biometria cadastrada!"}
            {stage === "blocked"    && "Use pelo celular"}
            {stage === "no-hardware"&& "Sem sensor biométrico"}
            {stage === "skipped"    && "Lembraremos você"}
            {(stage === "ready" || stage === "loading") && "Cadastrar biometria"}
          </DialogTitle>

          <DialogDescription className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {stage === "done" &&
              "Sua identidade foi verificada. Nos próximos acessos, entre direto com a digital ou Face ID — sem digitar senha."}

            {stage === "blocked" && <>
              Este navegador não permite biometria por segurança (ambiente restrito).<br /><br />
              <strong>Acesse pelo celular</strong> — no app você usará a digital ou o Face ID no cadastro e não precisará de senha para entrar.
            </>}

            {stage === "no-hardware" && <>
              Seu dispositivo não tem sensor biométrico disponível no momento.<br /><br />
              No <strong>celular</strong> você poderá ativar a digital ou o reconhecimento facial.
            </>}

            {stage === "skipped" &&
              "Ative a biometria pelo menu do app quando quiser. Enquanto isso, use email e senha."}

            {(stage === "ready" || stage === "loading") && <>
              Para entrar no app <strong>sem senha</strong> nas próximas vezes, cadastre sua digital ou Face ID agora.<br /><br />
              Nenhum dado biométrico sai do seu aparelho.
            </>}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-4">
          {stage === "ready" && (
            <>
              <Button className="w-full gap-2 h-12 text-base font-semibold" onClick={handleRegister}>
                <Fingerprint className="w-5 h-5" />
                Ativar digital / Face ID agora
              </Button>
              <button
                onClick={handleSkip}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Ativar depois
              </button>
            </>
          )}

          {stage === "loading" && (
            <div className="flex items-center justify-center gap-2 py-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Aguardando sensor...</span>
            </div>
          )}

          {(stage === "blocked" || stage === "no-hardware") && (
            <>
              <div className="bg-secondary/60 rounded-xl p-3 text-xs text-muted-foreground text-left space-y-1.5">
                <p className="font-semibold text-foreground">📱 No celular será assim:</p>
                <p>• <strong>iPhone/iPad</strong> — Face ID ou Touch ID</p>
                <p>• <strong>Android</strong> — Digital ou reconhecimento facial</p>
                <p className="pt-1">Depois de ativar, você entra no app só olhando pro celular ou tocando no sensor.</p>
              </div>
              <Button variant="outline" className="w-full gap-2 h-11" onClick={handleRegister}>
                <RefreshCw className="w-4 h-4" /> Tentar novamente
              </Button>
              <Button className="w-full h-11" onClick={handleSkip}>
                Continuar sem biometria
              </Button>
            </>
          )}

          {(stage === "done" || stage === "skipped") && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground py-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Continuando...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
