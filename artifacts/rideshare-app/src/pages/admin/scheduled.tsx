import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  useGetAdminScheduledRides,
  useAdminCancelScheduledRide,
  useAdminReassignScheduledRide,
  getGetAdminScheduledRidesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Calendar, Navigation, Clock, User2, Globe, ArrowLeft,
  RefreshCw, AlertCircle, Route, Filter, XCircle, ArrowRightLeft, Loader2,
} from "lucide-react";
import type { Ride } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

type StatusFilter = "all" | "pending_acceptance" | "confirmed" | "driver_declined" | "cancelled";
type TypeFilter = "all" | "public" | "directed";

interface DriverOption { id: number; name: string; vehicleModel: string | null; vehiclePlate: string | null; }

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

function AdminRideCard({
  ride,
  onCancel,
  onReassign,
}: {
  ride: Ride;
  onCancel: (id: number) => void;
  onReassign: (ride: Ride) => void;
}) {
  const s = STATUS_LABELS[ride.scheduledStatus ?? ""] ?? { label: ride.scheduledStatus ?? "—", color: "" };
  const isDirected = ride.schedulingType === "directed";
  const canAct = ride.scheduledStatus !== "cancelled";

  return (
    <Card className={`border transition-colors ${isDirected ? "border-primary/30 bg-primary/5" : "border-border"}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
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

        {canAct && (
          <div className="flex gap-2 pt-1 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => onReassign(ride)}
            >
              <ArrowRightLeft className="w-3 h-3 mr-1" />
              Redirecionar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => onCancel(ride.id)}
            >
              <XCircle className="w-3 h-3 mr-1" />
              Cancelar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminScheduled() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");

  const [reassignRide, setReassignRide] = useState<Ride | null>(null);
  const [reassignDriverSearch, setReassignDriverSearch] = useState("");
  const [reassignDriverOptions, setReassignDriverOptions] = useState<DriverOption[]>([]);
  const [reassignDriverLoading, setReassignDriverLoading] = useState(false);
  const [selectedReassignDriver, setSelectedReassignDriver] = useState<DriverOption | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<number | null>(null);

  const cancelMutation = useAdminCancelScheduledRide();
  const reassignMutation = useAdminReassignScheduledRide();

  const adminScheduledParams = {
    scheduledStatus: statusFilter !== "all" ? statusFilter : undefined,
    schedulingType: typeFilter !== "all" ? typeFilter : undefined,
  };

  const { data: allRides, isLoading, error } = useGetAdminScheduledRides(
    adminScheduledParams,
    { query: { queryKey: getGetAdminScheduledRidesQueryKey(adminScheduledParams), refetchInterval: 30000 } }
  );

  const rides = useMemo(() => {
    if (!allRides) return [];
    return allRides.filter(r => {
      if (dateFilter) {
        const rideDate = r.scheduledFor ? new Date(r.scheduledFor).toLocaleDateString("en-CA") : "";
        if (rideDate !== dateFilter) return false;
      }
      if (driverFilter.trim()) {
        const q = driverFilter.toLowerCase();
        const dName = r.driver?.name?.toLowerCase() ?? "";
        if (!dName.includes(q)) return false;
      }
      return true;
    });
  }, [allRides, dateFilter, driverFilter]);

  const stats = {
    pending: allRides?.filter(r => r.scheduledStatus === "pending_acceptance").length ?? 0,
    confirmed: allRides?.filter(r => r.scheduledStatus === "confirmed").length ?? 0,
    declined: allRides?.filter(r => r.scheduledStatus === "driver_declined").length ?? 0,
    total: allRides?.length ?? 0,
  };

  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: "all", label: "Todos" },
    { value: "pending_acceptance", label: "Aguardando" },
    { value: "confirmed", label: "Confirmadas" },
    { value: "driver_declined", label: "Recusadas" },
    { value: "cancelled", label: "Canceladas" },
  ];

  async function searchReassignDrivers(q: string) {
    if (q.length < 2) { setReassignDriverOptions([]); return; }
    setReassignDriverLoading(true);
    try {
      const token = localStorage.getItem("token");
      const r = await fetch(`/api/drivers?status=approved`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return;
      const drivers: any[] = await r.json();
      const lq = q.toLowerCase();
      setReassignDriverOptions(
        drivers
          .filter(d => d.user?.name?.toLowerCase().includes(lq) || d.vehiclePlate?.toLowerCase().includes(lq))
          .slice(0, 8)
          .map(d => ({ id: d.userId, name: d.user?.name ?? `#${d.userId}`, vehicleModel: d.vehicleModel ?? null, vehiclePlate: d.vehiclePlate ?? null }))
      );
    } catch {} finally { setReassignDriverLoading(false); }
  }

  function handleCancelConfirm(id: number) {
    cancelMutation.mutate(
      { id, data: { reason: "Cancelado pelo administrador" } },
      {
        onSuccess: () => {
          toast({ title: "Agendamento cancelado" });
          setCancelConfirmId(null);
          queryClient.invalidateQueries({ queryKey: getGetAdminScheduledRidesQueryKey({}) });
        },
        onError: () => toast({ title: "Erro ao cancelar", variant: "destructive" }),
      }
    );
  }

  function handleReassignConfirm() {
    if (!reassignRide || !selectedReassignDriver) return;
    reassignMutation.mutate(
      { id: reassignRide.id, data: { driverId: selectedReassignDriver.id } },
      {
        onSuccess: () => {
          toast({ title: `Corrida #${reassignRide.id} redirecionada para ${selectedReassignDriver.name}` });
          setReassignRide(null);
          setSelectedReassignDriver(null);
          setReassignDriverSearch("");
          setReassignDriverOptions([]);
          queryClient.invalidateQueries({ queryKey: getGetAdminScheduledRidesQueryKey({}) });
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? "Erro ao redirecionar";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
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
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="w-3 h-3" /> Filtros
          </div>

          {/* Status filter */}
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

          {/* Type filter */}
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

          {/* Date + Driver filters */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2 border border-border focus-within:border-primary transition-colors">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="flex-1 bg-transparent text-xs outline-none text-foreground [color-scheme:dark]"
                placeholder="Filtrar data"
              />
              {dateFilter && (
                <button onClick={() => setDateFilter("")} className="text-muted-foreground hover:text-foreground">
                  <XCircle className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2 border border-border focus-within:border-primary transition-colors">
              <User2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <Input
                placeholder="Filtrar motorista"
                value={driverFilter}
                onChange={e => setDriverFilter(e.target.value)}
                className="border-none bg-transparent p-0 h-auto text-xs focus-visible:ring-0"
              />
              {driverFilter && (
                <button onClick={() => setDriverFilter("")} className="text-muted-foreground hover:text-foreground">
                  <XCircle className="w-3 h-3" />
                </button>
              )}
            </div>
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
            {rides.map(r => (
              <AdminRideCard
                key={r.id}
                ride={r}
                onCancel={(id) => setCancelConfirmId(id)}
                onReassign={(ride) => {
                  setReassignRide(ride);
                  setSelectedReassignDriver(null);
                  setReassignDriverSearch("");
                  setReassignDriverOptions([]);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Cancel confirmation modal */}
      {cancelConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="bg-card border border-border rounded-t-2xl p-5 w-full max-w-md space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="font-semibold">Cancelar agendamento #{cancelConfirmId}?</p>
                <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setCancelConfirmId(null)} disabled={cancelMutation.isPending}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => handleCancelConfirm(cancelConfirmId)}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Cancelamento"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign modal */}
      {reassignRide !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="bg-card border border-border rounded-t-2xl p-5 w-full max-w-md space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Redirecionar corrida #{reassignRide.id}</p>
                <p className="text-sm text-muted-foreground">Escolha um motorista aprovado</p>
              </div>
            </div>

            {selectedReassignDriver ? (
              <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <User2 className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{selectedReassignDriver.name}</div>
                  {selectedReassignDriver.vehicleModel && (
                    <div className="text-xs text-muted-foreground">{selectedReassignDriver.vehicleModel}{selectedReassignDriver.vehiclePlate ? ` · ${selectedReassignDriver.vehiclePlate}` : ""}</div>
                  )}
                </div>
                <button onClick={() => { setSelectedReassignDriver(null); setReassignDriverSearch(""); setReassignDriverOptions([]); }} className="text-xs text-muted-foreground hover:text-foreground">
                  Trocar
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2.5 border border-border focus-within:border-primary transition-colors">
                  <User2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Input
                    placeholder="Buscar motorista por nome ou placa..."
                    value={reassignDriverSearch}
                    onChange={e => {
                      setReassignDriverSearch(e.target.value);
                      searchReassignDrivers(e.target.value);
                    }}
                    className="border-none bg-transparent p-0 h-auto text-sm focus-visible:ring-0"
                  />
                  {reassignDriverLoading && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />}
                </div>
                {reassignDriverOptions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                    {reassignDriverOptions.map(d => (
                      <button
                        key={d.id}
                        onMouseDown={e => {
                          e.preventDefault();
                          setSelectedReassignDriver(d);
                          setReassignDriverSearch(d.name);
                          setReassignDriverOptions([]);
                        }}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-secondary transition-colors border-b border-border last:border-0"
                      >
                        <div className="font-medium">{d.name}</div>
                        {d.vehicleModel && <div className="text-xs text-muted-foreground">{d.vehicleModel}{d.vehiclePlate ? ` · ${d.vehiclePlate}` : ""}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setReassignRide(null); setSelectedReassignDriver(null); setReassignDriverSearch(""); setReassignDriverOptions([]); }}
                disabled={reassignMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleReassignConfirm}
                disabled={!selectedReassignDriver || reassignMutation.isPending}
              >
                {reassignMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
