import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Clock, XCircle, CheckCircle, FileText, ChevronRight } from "lucide-react";

async function fetchMyDriverProfile() {
  const r = await fetch("/api/drivers/me", { credentials: "include" });
  if (r.status === 404) return null;
  if (!r.ok) return null;
  return r.json();
}

export function DriverStatusBanner() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["driver-profile-me", user?.id],
    queryFn: fetchMyDriverProfile,
    enabled: !!user?.id,
  });

  if (isLoading || !user) return null;

  // No profile submitted yet
  if (!profile) {
    return (
      <div
        className="mx-4 mt-3 flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 cursor-pointer hover:bg-yellow-500/15 transition-colors"
        onClick={() => setLocation("/driver/profile")}
      >
        <FileText className="w-5 h-5 text-yellow-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-yellow-400">Cadastro incompleto</div>
          <div className="text-xs text-muted-foreground">Envie sua documentação para começar a aceitar corridas</div>
        </div>
        <ChevronRight className="w-4 h-4 text-yellow-400 shrink-0" />
      </div>
    );
  }

  if (profile.status === "pending") {
    return (
      <div className="mx-4 mt-3 flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
        <Clock className="w-5 h-5 text-blue-400 shrink-0 animate-pulse" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-blue-400">Cadastro em análise</div>
          <div className="text-xs text-muted-foreground">Seus documentos estão sendo revisados. Você será notificado assim que houver uma decisão.</div>
        </div>
      </div>
    );
  }

  if (profile.status === "denied") {
    const reasons = profile.adminNote ? profile.adminNote.split("\n").filter(Boolean) : [];
    return (
      <div
        className="mx-4 mt-3 bg-destructive/10 border border-destructive/30 rounded-xl p-3 cursor-pointer hover:bg-destructive/15 transition-colors"
        onClick={() => setLocation("/driver/profile")}
      >
        <div className="flex items-center gap-3 mb-2">
          <XCircle className="w-5 h-5 text-destructive shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-destructive">Cadastro não aprovado</div>
            <div className="text-xs text-muted-foreground">Corrija os problemas abaixo e reenvie sua documentação</div>
          </div>
          <ChevronRight className="w-4 h-4 text-destructive shrink-0" />
        </div>
        {reasons.length > 0 && (
          <ul className="mt-2 space-y-1 ml-8">
            {reasons.map((r, i) => (
              <li key={i} className="text-xs text-destructive/80 flex items-start gap-1">
                <span className="mt-0.5 shrink-0">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (profile.status === "approved") {
    return (
      <div className="mx-4 mt-3 flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
        <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
        <div>
          <div className="text-sm font-semibold text-green-400">Cadastro aprovado</div>
          <div className="text-xs text-muted-foreground">Você está habilitado para aceitar corridas</div>
        </div>
      </div>
    );
  }

  return null;
}
