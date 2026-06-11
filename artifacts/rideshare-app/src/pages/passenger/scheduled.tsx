import { useLocation } from "wouter";
import { useGetScheduledRides, getGetScheduledRidesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, MapPin, Navigation, Clock, User2, Globe, ChevronRight, ArrowLeft, RefreshCw, AlertCircle } from "lucide-react";
import type { Ride } from "@workspace/api-client-react";

const SCHEDULED_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_acceptance: { label: "Aguardando Motorista", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  confirmed: { label: "Confirmada", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  driver_declined: { label: "Motorista Recusou", color: "bg-destructive/20 text-destructive border-destructive/30" },
  cancelled: { label: "Cancelada", color: "bg-muted/40 text-muted-foreground border-muted/30" },
};

function formatScheduledDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("pt-BR", {
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

function ScheduledRideCard({ ride }: { ride: Ride }) {
  const [, setLocation] = useLocation();
  const status = SCHEDULED_STATUS_LABELS[ride.scheduledStatus ?? ""] ?? { label: ride.scheduledStatus ?? "—", color: "bg-muted/40 text-muted-foreground border-muted/30" };

  return (
    <Card className="border border-border bg-card/80 hover:border-primary/30 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Agendada para</div>
              <div className="text-sm font-semibold text-primary">{formatScheduledDate(ride.scheduledFor)}</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className={`text-xs border ${status.color}`}>{status.label}</Badge>
            <Badge variant="outline" className="text-xs">
              {ride.schedulingType === "directed" ? (
                <span className="flex items-center gap-1"><User2 className="w-3 h-3" />Direcionada</span>
              ) : (
                <span className="flex items-center gap-1"><Globe className="w-3 h-3" />Pública</span>
              )}
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
            <div className="text-sm text-foreground line-clamp-1">{ride.originAddress}</div>
          </div>
          <div className="flex items-start gap-2">
            <Navigation className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
            <div className="text-sm text-foreground line-clamp-1">{ride.destinationAddress}</div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-base font-bold text-primary">R$ {ride.offeredPrice?.toFixed(2)}</div>
          {ride.driver && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User2 className="w-3.5 h-3.5" />
              <span>{ride.driver.name}</span>
            </div>
          )}
        </div>

        {ride.scheduledNote && (
          <div className="text-xs text-muted-foreground bg-secondary rounded-lg px-2.5 py-1.5">
            📝 {ride.scheduledNote}
          </div>
        )}

        {ride.scheduledStatus !== "cancelled" && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => setLocation(`/passenger/ride/${ride.id}`)}
          >
            Ver detalhes <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function PassengerScheduled() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: rides, isLoading, error } = useGetScheduledRides({
    query: { refetchInterval: 30000 },
  });

  const upcoming = rides?.filter(r => r.scheduledStatus !== "cancelled") ?? [];
  const cancelled = rides?.filter(r => r.scheduledStatus === "cancelled") ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/passenger")} className="p-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Meus Agendamentos</h1>
            <p className="text-sm text-muted-foreground">Corridas pré-agendadas</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: getGetScheduledRidesQueryKey() })}
            className="p-2"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <Button
          className="w-full h-12 text-base font-semibold rounded-xl"
          onClick={() => setLocation("/passenger")}
        >
          <Calendar className="w-4 h-4 mr-2" />
          Agendar Nova Corrida
        </Button>

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
        ) : upcoming.length === 0 && cancelled.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Calendar className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="font-medium">Nenhum agendamento ainda</p>
              <p className="text-sm text-muted-foreground mt-1">
                Agende sua corrida com antecedência e viaje sem pressa.
              </p>
            </div>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Próximas ({upcoming.length})
                </h2>
                {upcoming.map(r => <ScheduledRideCard key={r.id} ride={r} />)}
              </div>
            )}
            {cancelled.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Canceladas ({cancelled.length})
                </h2>
                {cancelled.map(r => <ScheduledRideCard key={r.id} ride={r} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
