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

type Stage = "ready" | "loading" | "done" | "blocked" | "no-hardware" | "skipped" | "error";

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
  const [errorMsg, setErrorMsg] = useState<string>("");

  const handleRegister = async () => {
    setStage("loading");
    setErrorMsg("");
    try {
      const ok = await registerBiometric(token);
      if (ok) {
        try { setBiometricEmail(email); } catch {}
        setStage("done");
        setTimeout(onDone, 2000);
      } else {
        setErrorMsg("Verificação não confirmada. Tente novamente.");
        setStage("error");
      }
    } catch (err: any) {
      const msg: string = (err?.message ?? "").toLowerCase();
      // Ignore DOM-level errors that happen during WebAuthn native UI cleanup
      if (msg.includes("removechild") || msg.includes("not a child") || msg.includes("insertbefore")) {
        try { setBiometricEmail(email); } catch {}
        setStage("done");
        setTimeout(onDone, 2000);
        return;
      }
      // User cancelled — just go back to ready quietly
      if (msg.includes("cancelled") || msg.includes("abort") || msg.includes("not allowed") && msg.includes("user")) {
        setStage("ready");
        return;
      }
      const kind = classifyError(err);
      if (kind === "blocked") setStage("blocked");
      else if (kind === "no-hardware") setStage("no-hardware");
      else {
        setErrorMsg(err?.message || "Ocorreu um erro ao registrar biometria.");
        setStage("error");
      }
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
            <div className="w-20 h-20 rounded-full flex items-center justify-center animate-in zoom-in duration-300" style={{ background: "rgba(34,197,94,0.18)", boxShadow: "0 0 0 4px rgba(34,197,94,0.10)" }}>
              <CheckCircle2 className="w-11 h-11" strokeWidth={2.5} style={{ color: "#22c55e" }} />
            </div>
          ) : stage === "skipped" ? (
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(234,179,8,0.15)", boxShadow: "0 0 0 4px rgba(234,179,8,0.08)" }}>
              <ShieldAlert className="w-11 h-11" strokeWidth={2.5} style={{ color: "#eab308" }} />
            </div>
          ) : stage === "blocked" || stage === "no-hardware" || stage === "error" ? (
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(249,115,22,0.15)", boxShadow: "0 0 0 4px rgba(249,115,22,0.08)" }}>
              <ShieldAlert className="w-11 h-11" strokeWidth={2.5} style={{ color: "#fb923c" }} />
            </div>
          ) : stage === "loading" ? (
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(99,102,241,0.15)", boxShadow: "0 0 0 4px rgba(99,102,241,0.10)" }}>
              <Loader2 className="w-11 h-11 animate-spin" strokeWidth={2.5} style={{ color: "#818cf8" }} />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(99,102,241,0.15)", boxShadow: "0 0 0 4px rgba(99,102,241,0.12), 0 0 0 8px rgba(99,102,241,0.05)" }}>
              <ScanFace className="w-11 h-11" strokeWidth={2.5} style={{ color: "#818cf8" }} />
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
            {stage === "error"       && "Falha ao registrar"}
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
            {stage === "error" &&
              <span className="text-orange-400">{errorMsg}</span>}
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

        {stage === "error" && (
          <div className="w-full flex flex-col gap-3">
            <Button className="w-full h-12 gap-2 font-semibold" onClick={handleRegister}>
              <RefreshCw className="w-4 h-4" /> Tentar novamente
            </Button>
            <Button variant="outline" className="w-full h-11" onClick={handleSkip}>
              Continuar sem biometria
            </Button>
          </div>
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
