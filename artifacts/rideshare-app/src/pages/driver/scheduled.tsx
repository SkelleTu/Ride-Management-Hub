import { useState } from "react";
import { useLocation } from "wouter";
import {
  useGetScheduledRides,
  useAcceptScheduledRide,
  useDeclineScheduledRide,
  getGetScheduledRidesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Calendar, MapPin, Navigation, Clock, User2, Globe, ArrowLeft,
  RefreshCw, CheckCircle, XCircle, AlertCircle, Car, Route,
} from "lucide-react";
import type { Ride } from "@workspace/api-client-react";

const SCHED_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_acceptance: { label: "Aguardando Aceitação", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  confirmed: { label: "Confirmada", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  driver_declined: { label: "Recusada", color: "bg-destructive/20 text-destructive border-destructive/30" },
  cancelled: { label: "Cancelada", color: "bg-muted/40 text-muted-foreground border-muted/30" },
};

function formatScheduledDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return null;
  const min = Math.round(seconds / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}min`;
}

type Tab = "available" | "confirmed";

export default function DriverScheduled() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("available");
  const [declineRide, setDeclineRide] = useState<Ride | null>(null);

  const accept = useAcceptScheduledRide();
  const decline = useDeclineScheduledRide();

  const { data: rides, isLoading, error } = useGetScheduledRides({
    query: { refetchInterval: 20000 },
  });

  const available = rides?.filter(r => r.scheduledStatus === "pending_acceptance") ?? [];
  const confirmed = rides?.filter(r => r.scheduledStatus === "confirmed") ?? [];

  const handleAccept = (ride: Ride) => {
    accept.mutate({ id: ride.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetScheduledRidesQueryKey() });
        toast({
          title: "Agendamento aceito!",
          description: `Corrida confirmada para ${formatScheduledDate(ride.scheduledFor)}`,
        });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? "Erro ao aceitar agendamento";
        toast({ title: msg, variant: "destructive" });
      },
    });
  };

  const handleDeclineConfirm = () => {
    if (!declineRide) return;
    decline.mutate({ id: declineRide.id, data: { reason: "Motorista recusou" } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetScheduledRidesQueryKey() });
        setDeclineRide(null);
        toast({ title: "Agendamento recusado" });
      },
      onError: () => {
        toast({ title: "Erro ao recusar agendamento", variant: "destructive" });
      },
    });
  };

  const currentList = activeTab === "available" ? available : confirmed;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/driver")} className="p-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Agendamentos</h1>
            <p className="text-sm text-muted-foreground">Corridas pré-agendadas disponíveis</p>
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

        {/* Tabs */}
        <div className="flex bg-secondary rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab("available")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === "available"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Disponíveis
            {available.length > 0 && (
              <span className={`ml-1 text-xs rounded-full px-1.5 py-0.5 font-bold ${
                activeTab === "available" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/20 text-primary"
              }`}>{available.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("confirmed")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === "confirmed"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Confirmadas
            {confirmed.length > 0 && (
              <span className={`ml-1 text-xs rounded-full px-1.5 py-0.5 font-bold ${
                activeTab === "confirmed" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-green-500/20 text-green-400"
              }`}>{confirmed.length}</span>
            )}
          </button>
        </div>

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
        ) : currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              {activeTab === "available" ? <Calendar className="w-8 h-8 text-primary" /> : <CheckCircle className="w-8 h-8 text-primary" />}
            </div>
            <div>
              <p className="font-medium">
                {activeTab === "available" ? "Nenhum agendamento disponível" : "Nenhuma corrida confirmada"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {activeTab === "available"
                  ? "Novas solicitações aparecem aqui automaticamente."
                  : "Aceite agendamentos para vê-los aqui."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {currentList.map((ride) => {
              const status = SCHED_STATUS_LABELS[ride.scheduledStatus ?? ""] ?? { label: "—", color: "" };
              const isDirected = ride.schedulingType === "directed";

              return (
                <Card key={ride.id} className={`border transition-colors ${
                  isDirected
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-card/80"
                }`}>
                  <CardContent className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          isDirected ? "bg-primary/20" : "bg-secondary"
                        }`}>
                          {isDirected ? <User2 className="w-4 h-4 text-primary" /> : <Globe className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {isDirected ? "Corrida direcionada a você" : "Corrida pública"}
                          </div>
                          <Badge variant="outline" className={`text-xs border mt-0.5 ${status.color}`}>{status.label}</Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">R$ {ride.offeredPrice?.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">oferta</div>
                      </div>
                    </div>

                    {/* Date/time */}
                    <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2.5">
                      <Clock className="w-4 h-4 text-primary shrink-0" />
                      <div>
                        <div className="text-xs text-muted-foreground">Agendada para</div>
                        <div className="text-sm font-semibold">{formatScheduledDate(ride.scheduledFor)}</div>
                      </div>
                    </div>

                    {/* Route */}
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div>
                          <div className="text-xs text-muted-foreground">Origem</div>
                          <div className="text-sm">{ride.originAddress}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Navigation className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs text-muted-foreground">Destino</div>
                          <div className="text-sm">{ride.destinationAddress}</div>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    {(ride.estimatedDistance || ride.estimatedDuration) && (
                      <div className="flex gap-3">
                        {ride.estimatedDistance && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Route className="w-3 h-3" />
                            {ride.estimatedDistance?.toFixed(1)} km
                          </div>
                        )}
                        {ride.estimatedDuration && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatDuration(ride.estimatedDuration)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Passenger */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{ride.passenger?.name ?? "Passageiro"}</span>
                    </div>

                    {/* Note */}
                    {ride.scheduledNote && (
                      <div className="text-xs text-muted-foreground bg-secondary rounded-lg px-2.5 py-1.5">
                        📝 {ride.scheduledNote}
                      </div>
                    )}

                    {/* Actions */}
                    {ride.scheduledStatus === "pending_acceptance" && (
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                          onClick={() => setDeclineRide(ride)}
                          disabled={decline.isPending || accept.isPending}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Recusar
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-primary hover:bg-primary/90"
                          onClick={() => handleAccept(ride)}
                          disabled={accept.isPending || decline.isPending}
                        >
                          {accept.isPending ? (
                            <span className="w-3.5 h-3.5 border border-primary-foreground border-t-transparent rounded-full animate-spin mr-1" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          )}
                          Aceitar
                        </Button>
                      </div>
                    )}

                    {ride.scheduledStatus === "confirmed" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setLocation(`/driver/ride/${ride.id}`)}
                      >
                        <Car className="w-3.5 h-3.5 mr-1" />
                        Ver corrida
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Decline Confirmation Dialog */}
      <Dialog open={!!declineRide} onOpenChange={(o) => !o && setDeclineRide(null)}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>Recusar Agendamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja recusar este agendamento?
            {declineRide?.schedulingType === "directed" && (
              <span className="block mt-1 text-destructive/80">
                Esta é uma corrida direcionada especificamente a você.
              </span>
            )}
          </p>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeclineRide(null)} className="flex-1">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeclineConfirm}
              className="flex-1"
              disabled={decline.isPending}
            >
              {decline.isPending ? "Recusando..." : "Confirmar Recusa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
