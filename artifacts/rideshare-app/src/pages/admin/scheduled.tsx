import { useState } from "react";
import { useLocation } from "wouter";
import { useGetAdminScheduledRides, getGetAdminScheduledRidesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar, Navigation, Clock, User2, Globe, ArrowLeft,
  RefreshCw, AlertCircle, Route, Filter,
} from "lucide-react";
import type { Ride } from "@workspace/api-client-react";

type StatusFilter = "all" | "pending_acceptance" | "confirmed" | "driver_declined" | "cancelled";
type TypeFilter = "all" | "public" | "directed";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_acceptance: { label: "Aguardando", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  confirmed: { label: "Confirmada", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  driver_declined: { label: "Recusada", color: "bg-destructive/20 text-destructive border-destructive/30" },
  cancelled: { label: "Cancelada", color: "bg-muted/40 text-muted-foreground border-muted/30" },
};

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("pt-BR", {
    weekday: "short", day: "2-digit", month: "short",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatDuration(s: number | null | undefined) {
  if (!s) return null;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}min` : `${Math.floor(m / 60)}h${m % 60}min`;
}

function AdminRideCard({ ride }: { ride: Ride }) {
  const s = STATUS_LABELS[ride.scheduledStatus ?? ""] ?? { label: ride.scheduledStatus ?? "—", color: "" };
  const isDirected = ride.schedulingType === "directed";

  return (
    <Card className={`border transition-colors ${isDirected ? "border-primary/30 bg-primary/5" : "border-border"}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-muted-foreground">#{ride.id}</span>
              <Badge variant="outline" className={`text-xs border ${s.color}`}>{s.label}</Badge>
              <Badge variant="outline" className="text-xs">
                {isDirected ? (
                  <span className="flex items-center gap-1"><User2 className="w-3 h-3" />Direcionada</span>
                ) : (
                  <span className="flex items-center gap-1"><Globe className="w-3 h-3" />Pública</span>
                )}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
              <Clock className="w-3.5 h-3.5" />
              {formatDate(ride.scheduledFor)}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-bold text-primary">R$ {ride.offeredPrice?.toFixed(2)}</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
            <span className="line-clamp-1 text-muted-foreground">{ride.originAddress}</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <Navigation className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
            <span className="line-clamp-1 text-muted-foreground">{ride.destinationAddress}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-secondary rounded-lg px-2.5 py-2">
            <div className="text-muted-foreground">Passageiro</div>
            <div className="font-medium truncate">{ride.passenger?.name ?? "—"}</div>
          </div>
          <div className="bg-secondary rounded-lg px-2.5 py-2">
            <div className="text-muted-foreground">Motorista</div>
            <div className="font-medium truncate">{ride.driver?.name ?? "Aguardando"}</div>
          </div>
        </div>

        {(ride.estimatedDistance || ride.estimatedDuration) && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            {ride.estimatedDistance && (
              <span className="flex items-center gap-1"><Route className="w-3 h-3" />{ride.estimatedDistance?.toFixed(1)} km</span>
            )}
            {ride.estimatedDuration && (
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(ride.estimatedDuration)}</span>
            )}
          </div>
        )}

        {ride.scheduledNote && (
          <div className="text-xs text-muted-foreground bg-secondary rounded-lg px-2.5 py-1.5">
            📝 {ride.scheduledNote}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminScheduled() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const { data: rides, isLoading, error } = useGetAdminScheduledRides(
    {
      scheduledStatus: statusFilter !== "all" ? statusFilter : undefined,
      schedulingType: typeFilter !== "all" ? typeFilter : undefined,
    },
    { query: { refetchInterval: 30000 } }
  );

  const stats = {
    pending: rides?.filter(r => r.scheduledStatus === "pending_acceptance").length ?? 0,
    confirmed: rides?.filter(r => r.scheduledStatus === "confirmed").length ?? 0,
    declined: rides?.filter(r => r.scheduledStatus === "driver_declined").length ?? 0,
    total: rides?.length ?? 0,
  };

  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: "all", label: "Todos" },
    { value: "pending_acceptance", label: "Aguardando" },
    { value: "confirmed", label: "Confirmadas" },
    { value: "driver_declined", label: "Recusadas" },
    { value: "cancelled", label: "Canceladas" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/admin")} className="p-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Agendamentos</h1>
            <p className="text-sm text-muted-foreground">Gerenciar corridas pré-agendadas</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: getGetAdminScheduledRidesQueryKey({}) })}
            className="p-2"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Total", value: stats.total, color: "text-foreground" },
            { label: "Aguardando", value: stats.pending, color: "text-yellow-400" },
            { label: "Confirmadas", value: stats.confirmed, color: "text-green-400" },
            { label: "Recusadas", value: stats.declined, color: "text-destructive" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="w-3 h-3" /> Filtros
          </div>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  statusFilter === opt.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(["all", "public", "directed"] as TypeFilter[]).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  typeFilter === t
                    ? "bg-secondary text-foreground border-primary/50"
                    : "border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                {t === "all" ? "Todos os tipos" : t === "public" ? "Pública" : "Direcionada"}
              </button>
            ))}
          </div>
        </div>

        {/* Rides list */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Carregando agendamentos...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <p className="text-sm text-muted-foreground">Erro ao carregar agendamentos</p>
          </div>
        ) : !rides || rides.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Calendar className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="font-medium">Nenhum agendamento encontrado</p>
              <p className="text-sm text-muted-foreground mt-1">Ajuste os filtros ou aguarde novas solicitações.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{rides.length} agendamento{rides.length !== 1 ? "s" : ""} encontrado{rides.length !== 1 ? "s" : ""}</p>
            {rides.map(r => <AdminRideCard key={r.id} ride={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}
