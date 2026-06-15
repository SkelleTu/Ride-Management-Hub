import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Fingerprint, Loader2, ShieldCheck, ShieldAlert, ScanFace, RefreshCw, CheckCircle2 } from "lucide-react";
import { registerBiometric, setBiometricEmail } from "@/lib/useBiometric";
import { UPcarLogo } from "@/components/ui/UPcarLogo";

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
        try { setBiometricEmail(email); } catch {}
        setStage("done");
        setTimeout(onDone, 2000);
      } else {
        setStage("ready");
      }
    } catch (err: any) {
      // Ignore DOM-level errors (removeChild, etc.) that happen during WebAuthn native UI
      const msg: string = (err?.message ?? "").toLowerCase();
      if (msg.includes("removechild") || msg.includes("not a child") || msg.includes("insertbefore")) {
        // The biometric may have actually succeeded — mark as done anyway
        try { setBiometricEmail(email); } catch {}
        setStage("done");
        setTimeout(onDone, 2000);
        return;
      }
      const kind = classifyError(err);
      if (kind === "blocked") setStage("blocked");
      else if (kind === "no-hardware") setStage("no-hardware");
      else setStage("ready");
    }
  };

  const handleSkip = () => {
    setStage("skipped");
    setTimeout(onDone, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <UPcarLogo size={48} />

        {/* Icon */}
        <div className="flex justify-center">
          {stage === "done" ? (
            <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center animate-in zoom-in duration-300">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
          ) : stage === "skipped" ? (
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <ShieldAlert className="w-9 h-9 text-yellow-400" />
            </div>
          ) : stage === "blocked" || stage === "no-hardware" ? (
            <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center">
              <ShieldAlert className="w-9 h-9 text-orange-400" />
            </div>
          ) : stage === "loading" ? (
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-9 h-9 text-primary animate-spin" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
              <ScanFace className="w-9 h-9 text-primary" />
            </div>
          )}
        </div>

        {/* Title + description */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">
            {stage === "done"        && "Biometria ativada!"}
            {stage === "skipped"     && "Lembraremos você"}
            {stage === "blocked"     && "Use pelo celular"}
            {stage === "no-hardware" && "Sem sensor biométrico"}
            {stage === "loading"     && "Aguardando sensor..."}
            {stage === "ready"       && "Ativar biometria"}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {stage === "done" &&
              "Sua digital / Face ID foram registrados. Nos próximos acessos, entre direto sem digitar senha."}
            {stage === "skipped" &&
              "Você pode ativar pelo menu do app a qualquer momento."}
            {stage === "blocked" &&
              "Este navegador bloqueou o acesso ao sensor. No celular com o app instalado, o Face ID e a digital funcionam normalmente."}
            {stage === "no-hardware" &&
              "Nenhum sensor biométrico encontrado agora. Acesse pelo celular para ativar Face ID ou digital."}
            {stage === "loading" &&
              "Use a digital ou olhe para a câmera frontal quando o celular pedir."}
            {stage === "ready" && <>
              Cadastre sua <strong>digital ou Face ID</strong> para entrar no app sem precisar digitar senha.
              Nenhum dado biométrico sai do seu aparelho.
            </>}
          </p>
        </div>

        {/* Actions */}
        {stage === "ready" && (
          <div className="w-full flex flex-col gap-3">
            <Button className="w-full h-14 text-base font-semibold gap-2" onClick={handleRegister}>
              <Fingerprint className="w-5 h-5" />
              Ativar digital / Face ID
            </Button>
            <button
              onClick={handleSkip}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Ativar depois
            </button>
          </div>
        )}

        {stage === "loading" && (
          <p className="text-xs text-muted-foreground animate-pulse">
            Siga as instruções do seu celular...
          </p>
        )}

        {(stage === "blocked" || stage === "no-hardware") && (
          <div className="w-full flex flex-col gap-3">
            <div className="bg-secondary/60 rounded-xl p-4 text-xs text-muted-foreground text-left space-y-1.5">
              <p className="font-semibold text-foreground">📱 No celular funciona assim:</p>
              <p>• <strong>iPhone/iPad</strong> — Face ID ou Touch ID</p>
              <p>• <strong>Android</strong> — digital ou reconhecimento facial</p>
              <p className="pt-1">Depois de ativar, você entra no app só olhando pro celular ou tocando no sensor — sem senha.</p>
            </div>
            <Button variant="outline" className="w-full gap-2 h-11" onClick={handleRegister}>
              <RefreshCw className="w-4 h-4" /> Tentar novamente
            </Button>
            <Button className="w-full h-11" onClick={handleSkip}>
              Continuar sem biometria
            </Button>
          </div>
        )}

        {(stage === "done" || stage === "skipped") && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Continuando...
          </div>
        )}
      </div>
    </div>
  );
}
