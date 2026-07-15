import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, XCircle, CheckCircle, FileText, ChevronRight, Wifi, WifiOff } from "lucide-react";

async function fetchMyDriverProfile() {
  const token = localStorage.getItem("token");
  const r = await fetch("/api/drivers/me", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (r.status === 404) return null;
  if (!r.ok) return null;
  return r.json();
}

async function toggleOnlineStatus(isOnline: boolean) {
  const token = localStorage.getItem("token");
  const r = await fetch("/api/drivers/me/status", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ isOnline }),
  });
  if (!r.ok) throw new Error("Falha ao atualizar status");
  return r.json();
}

export function DriverStatusBanner() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["driver-profile-me", user?.id],
    queryFn: fetchMyDriverProfile,
    enabled: !!user?.id,
  });

  const { mutate: setOnline, isPending } = useMutation({
    mutationFn: toggleOnlineStatus,
    onSuccess: (updated) => {
      queryClient.setQueryData(["driver-profile-me", user?.id], (old: any) => ({
        ...old,
        isOnline: updated.isOnline,
      }));
    },
  });

  if (isLoading || !user) return null;

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
            {reasons.map((r: string, i: number) => (
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
    const online = profile.isOnline ?? false;
    return (
      <div className="mx-4 mt-3 space-y-2">
        {/* Approval badge */}
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
          <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-green-400">Cadastro aprovado</div>
            <div className="text-xs text-muted-foreground">Você está habilitado para aceitar corridas</div>
          </div>
        </div>

        {/* Online / Offline toggle */}
        <button
          disabled={isPending}
          onClick={() => setOnline(!online)}
          className={`w-full flex items-center justify-between gap-3 rounded-xl p-4 border transition-all active:scale-[0.98] ${
            online
              ? "bg-primary/15 border-primary/40 hover:bg-primary/20"
              : "bg-secondary border-border hover:bg-secondary/80"
          } ${isPending ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <div className="flex items-center gap-3">
            {online ? (
              <Wifi className="w-5 h-5 text-primary shrink-0" />
            ) : (
              <WifiOff className="w-5 h-5 text-muted-foreground shrink-0" />
            )}
            <div className="text-left">
              <div className={`text-sm font-bold ${online ? "text-primary" : "text-foreground"}`}>
                {online ? "Online — recebendo corridas" : "Offline — não recebendo corridas"}
              </div>
              <div className="text-xs text-muted-foreground">
                {online ? "Toque para ficar offline" : "Toque para ficar online e começar"}
              </div>
            </div>
          </div>

          {/* Toggle visual */}
          <div className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${online ? "bg-primary" : "bg-muted-foreground/30"}`}>
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${online ? "left-6" : "left-0.5"}`} />
          </div>
        </button>
      </div>
    );
  }

  return null;
}
