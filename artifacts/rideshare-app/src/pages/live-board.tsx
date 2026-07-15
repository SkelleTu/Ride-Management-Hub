import { useState, useEffect } from "react";
import {
  useGetActiveRides,
  useGetScheduledRides,
  getGetActiveRidesQueryKey,
  getGetScheduledRidesQueryKey,
} from "@workspace/api-client-react";
import type { Ride } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Car, Clock, MapPin, Navigation, User2, Calendar,
  Radio, RefreshCw, Route, Zap,
} from "lucide-react";

const REFETCH_INTERVAL = 10_000;

const INSTANT_STATUS: Record<string, { label: string; dot: string; badge: string }> = {
  open:         { label: "Aguardando motorista", dot: "bg-yellow-400",  badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  negotiating:  { label: "Em negociação",        dot: "bg-blue-400",    badge: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  accepted:     { label: "Motorista a caminho",  dot: "bg-primary",     badge: "bg-primary/20 text-primary border-primary/30" },
  in_progress:  { label: "Em viagem",            dot: "bg-green-400",   badge: "bg-green-500/20 text-green-400 border-green-500/30" },
};

const SCHED_STATUS: Record<string, { label: string; dot: string; badge: string }> = {
  pending_acceptance: { label: "Aguardando",  dot: "bg-yellow-400", badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  confirmed:          { label: "Confirmada",  dot: "bg-green-400",  badge: "bg-green-500/20 text-green-400 border-green-500/30" },
  driver_declined:    { label: "Recusada",    dot: "bg-red-400",    badge: "bg-red-500/20 text-destructive border-destructive/30" },
  cancelled:          { label: "Cancelada",   dot: "bg-muted-foreground", badge: "bg-muted/30 text-muted-foreground border-muted/30" },
};

function PulsingDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-60`} />
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`} />
    </span>
  );
}

function formatTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatShortTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function InstantRideRow({ ride }: { ride: Ride }) {
  const s = INSTANT_STATUS[ride.status] ?? { label: ride.status, dot: "bg-muted-foreground", badge: "" };
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <PulsingDot color={s.dot} />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`text-xs border ${s.badge}`}>{s.label}</Badge>
          <span className="text-xs text-muted-foreground font-mono">#{ride.id}</span>
        </div>
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1 shrink-0" />
          <span className="line-clamp-1">{ride.originAddress}</span>
        </div>
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Navigation className="w-3 h-3 text-accent mt-0.5 shrink-0" />
          <span className="line-clamp-1">{ride.destinationAddress}</span>
        </div>
        <div className="flex items-center gap-3 text-xs mt-0.5">
          <span className="flex items-center gap-1 text-muted-foreground">
            <User2 className="w-3 h-3" />
            {ride.passenger?.name?.split(" ")[0] ?? "—"}
          </span>
          {ride.driver && (
            <span className="flex items-center gap-1 text-primary">
              <Car className="w-3 h-3" />
              {ride.driver.name?.split(" ")[0]}
            </span>
          )}
          {ride.estimatedDistance && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Route className="w-3 h-3" />
              {ride.estimatedDistance.toFixed(1)} km
            </span>
          )}
          <span className="ml-auto font-semibold text-foreground">
            R$ {(ride.agreedPrice ?? ride.offeredPrice)?.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

function ScheduledRideRow({ ride }: { ride: Ride }) {
  const s = SCHED_STATUS[ride.scheduledStatus ?? ""] ?? { label: ride.scheduledStatus ?? "—", dot: "bg-muted-foreground", badge: "" };
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <PulsingDot color={s.dot} />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`text-xs border ${s.badge}`}>{s.label}</Badge>
          <span className="text-xs font-semibold text-primary flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTime(ride.scheduledFor)}
          </span>
          <span className="text-xs text-muted-foreground font-mono">#{ride.id}</span>
        </div>
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1 shrink-0" />
          <span className="line-clamp-1">{ride.originAddress}</span>
        </div>
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Navigation className="w-3 h-3 text-accent mt-0.5 shrink-0" />
          <span className="line-clamp-1">{ride.destinationAddress}</span>
        </div>
        <div className="flex items-center gap-3 text-xs mt-0.5">
          <span className="flex items-center gap-1 text-muted-foreground">
            <User2 className="w-3 h-3" />
            {ride.passenger?.name?.split(" ")[0] ?? "—"}
          </span>
          {ride.driver ? (
            <span className="flex items-center gap-1 text-primary">
              <Car className="w-3 h-3" />
              {ride.driver.name?.split(" ")[0]}
            </span>
          ) : (
            <span className="text-muted-foreground italic text-xs">Sem motorista</span>
          )}
          <span className="ml-auto font-semibold text-foreground">
            R$ {ride.offeredPrice?.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LiveBoard() {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const { data: activeRides, isLoading: loadingActive, refetch: refetchActive } =
    useGetActiveRides({
      query: {
        queryKey: getGetActiveRidesQueryKey(),
        refetchInterval: REFETCH_INTERVAL,
      },
    });

  useEffect(() => {
    if (activeRides) setLastUpdated(new Date());
  }, [activeRides]);

  const { data: scheduledRides, isLoading: loadingScheduled, refetch: refetchScheduled } =
    useGetScheduledRides({
      query: {
        queryKey: getGetScheduledRidesQueryKey(),
        refetchInterval: REFETCH_INTERVAL,
      },
    });

  const inProgress = activeRides?.filter(r => r.status === "in_progress") ?? [];
  const waiting = activeRides?.filter(r => r.status !== "in_progress") ?? [];
  const upcoming = scheduledRides?.filter(r => r.scheduledStatus !== "cancelled") ?? [];

  function handleRefresh() {
    refetchActive();
    refetchScheduled();
    setLastUpdated(new Date());
  }

  const isLoading = loadingActive || loadingScheduled;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Radio className="w-5 h-5 text-primary" />
              Painel Ao Vivo
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Atualiza a cada 10 segundos · último: {formatShortTime(lastUpdated.toISOString())}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Summary chips */}
        <div className="flex gap-2 flex-wrap">
          {[
            { label: "Em viagem", value: inProgress.length, color: "text-green-400" },
            { label: "Aguardando", value: waiting.length, color: "text-yellow-400" },
            { label: "Agendados", value: upcoming.length, color: "text-primary" },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
              <span className={`text-lg font-bold ${c.color}`}>{c.value}</span>
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </div>
          ))}
        </div>

        {/* Em viagem agora */}
        {inProgress.length > 0 && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1 text-sm font-semibold text-green-400">
                <Zap className="w-4 h-4" />
                Em viagem agora ({inProgress.length})
              </div>
              <p className="text-xs text-muted-foreground mb-3">Corridas em andamento no momento</p>
              {inProgress.map(r => <InstantRideRow key={r.id} ride={r} />)}
            </CardContent>
          </Card>
        )}

        {/* Aguardando / Negociação / A caminho */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1 text-sm font-semibold">
              <MapPin className="w-4 h-4 text-primary" />
              Corridas Instantâneas
              {waiting.length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">{waiting.length} ativa{waiting.length !== 1 ? "s" : ""}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-3">Pedidos abertos, negociações e motoristas a caminho</p>

            {loadingActive ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : waiting.length === 0 ? (
              <div className="text-center py-8">
                <Car className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma corrida ativa no momento</p>
              </div>
            ) : (
              waiting.map(r => <InstantRideRow key={r.id} ride={r} />)
            )}
          </CardContent>
        </Card>

        {/* Agendamentos */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1 text-sm font-semibold">
              <Calendar className="w-4 h-4 text-primary" />
              Agendamentos
              {upcoming.length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">{upcoming.length} agendado{upcoming.length !== 1 ? "s" : ""}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-3">Corridas pré-agendadas por data e horário</p>

            {loadingScheduled ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : upcoming.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum agendamento pendente</p>
              </div>
            ) : (
              [...upcoming]
                .sort((a, b) => {
                  const ta = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0;
                  const tb = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0;
                  return ta - tb;
                })
                .map(r => <ScheduledRideRow key={r.id} ride={r} />)
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
