import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navigation, Clock, ChevronRight, Car, Lock, Star, MapPin, Zap, AlertCircle } from "lucide-react";
import { DriverStatusBanner } from "@/components/driver/DriverStatusBanner";

async function fetchMyDriverProfile() {
  const token = localStorage.getItem("token");
  const r = await fetch("/api/drivers/me", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (r.status === 404) return null;
  if (!r.ok) return null;
  return r.json();
}

async function fetchSmartRides(): Promise<SmartRideEntry[]> {
  const token = localStorage.getItem("token");
  const r = await fetch("/api/dispatch/active-fits", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!r.ok) return [];
  return r.json();
}

interface SmartRideEntry {
  ride: {
    id: number;
    originAddress: string;
    destinationAddress: string;
    offeredPrice: number;
    status: string;
    createdAt: string;
    estimatedDistance: number | null;
    estimatedDuration: number | null;
    offers: any[];
    passenger: { name: string; rating: number | null } | null;
  };
  score: { total: number; distance: number; scheduleFit: number; completionRate: number };
  distanceKm: number | null;
  scheduleFitLabel: string;
  scheduleFitColor: "green" | "yellow" | "orange" | "red";
  gapMinutes: number | null;
}

const FIT_COLORS: Record<SmartRideEntry["scheduleFitColor"], string> = {
  green:  "bg-green-500/20 text-green-400 border-green-500/30",
  yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  red:    "bg-red-500/20 text-red-400 border-red-500/30",
};

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-6 text-right">{value}</span>
    </div>
  );
}

export default function DriverHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showScores, setShowScores] = useState<number | null>(null);

  const { data: smartRides = [], isLoading, refetch } = useQuery<SmartRideEntry[]>({
    queryKey: ["dispatch-active-fits"],
    queryFn: fetchSmartRides,
    refetchInterval: 10000,
  });

  const { data: profile } = useQuery({
    queryKey: ["driver-profile-me", user?.id],
    queryFn: fetchMyDriverProfile,
    enabled: !!user?.id,
  });

  // Poll for accepted/in_progress ride and redirect
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const check = async () => {
      try {
        const token = localStorage.getItem("token");
        const r = await fetch(`/api/rides?driverId=${user.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!r.ok || cancelled) return;
        const list: any[] = await r.json();
        const active = list.find(ride => ride.status === "accepted" || ride.status === "in_progress");
        if (active && !cancelled) setLocation(`/driver/ride/${active.id}`);
      } catch { /* ignore */ }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user?.id]);

  const isApproved = profile?.status === "approved";
  const isOnline = profile?.isOnline ?? false;

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <DriverStatusBanner />

      {!isApproved ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="font-semibold">Corridas bloqueadas</div>
          <div className="text-sm text-muted-foreground max-w-xs">
            {!profile
              ? "Complete seu cadastro para começar a receber solicitações de corrida."
              : profile.status === "pending"
              ? "Seu cadastro está em análise. Assim que aprovado, as corridas aparecerão aqui."
              : "Seu cadastro foi negado. Corrija os problemas indicados e reenvie sua documentação."}
          </div>
        </div>
      ) : !isOnline ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="font-semibold">Você está offline</div>
          <div className="text-sm text-muted-foreground max-w-xs">
            Ative o botão <span className="font-semibold text-primary">Online</span> acima para começar a receber solicitações de corrida.
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold">Corridas Disponíveis</div>
              <div className="text-sm text-muted-foreground">
                {smartRides.length} solicitações · ordenadas por encaixe
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">
              Atualizar
            </Button>
          </div>

          {/* Smart legend */}
          {smartRides.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <Zap className="w-3 h-3 text-primary shrink-0" />
              <span>Ordenadas por encaixe na sua agenda, distância e avaliação</span>
            </div>
          )}

          {smartRides.length === 0 && (
            <div className="text-center py-20 space-y-3">
              <div className="w-16 h-16 mx-auto bg-secondary rounded-2xl flex items-center justify-center">
                <Car className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="text-muted-foreground">Nenhuma corrida disponível no momento</div>
              <div className="text-xs text-muted-foreground">Novas solicitações aparecerão aqui automaticamente</div>
            </div>
          )}

          {smartRides.map((entry, idx) => {
            const { ride, score, distanceKm, scheduleFitLabel, scheduleFitColor, gapMinutes } = entry;
            const isExpanded = showScores === ride.id;
            const isTop = idx === 0 && smartRides.length > 1;

            return (
              <Card
                key={ride.id}
                data-testid={`card-ride-${ride.id}`}
                className={`cursor-pointer transition-all active:scale-[0.99] ${
                  isTop
                    ? "border-primary/50 shadow-[0_0_20px_rgba(34,197,94,0.12)]"
                    : "hover:border-primary/30 hover:shadow-[0_0_12px_rgba(34,197,94,0.07)]"
                }`}
                onClick={() => setLocation(`/driver/offer/${ride.id}`)}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Top row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isTop && (
                        <Badge className="text-xs bg-primary/20 text-primary border-primary/30 border">
                          ⚡ Melhor encaixe
                        </Badge>
                      )}
                      <Badge className={`text-xs border ${ride.status === "negotiating" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}`}>
                        {ride.status === "negotiating" ? "Negociando" : "Nova"}
                      </Badge>
                      <Badge className={`text-xs border ${FIT_COLORS[scheduleFitColor]}`}>
                        {scheduleFitLabel}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Clock className="w-3 h-3" />
                      {new Date(ride.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>

                  {/* Route */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground">Embarque</div>
                        <div className="text-sm font-medium truncate">{ride.originAddress.split(",")[0]}</div>
                      </div>
                    </div>
                    <div className="ml-1 border-l-2 border-dashed border-muted-foreground/30 h-3" />
                    <div className="flex items-start gap-2">
                      <Navigation className="w-3 h-3 text-accent mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground">Destino</div>
                        <div className="text-sm font-medium truncate">{ride.destinationAddress.split(",")[0]}</div>
                      </div>
                    </div>
                  </div>

                  {/* Metrics row */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {distanceKm != null && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{distanceKm} km de você</span>
                      </div>
                    )}
                    {gapMinutes != null && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{gapMinutes >= 60 ? `${Math.floor(gapMinutes / 60)}h ${gapMinutes % 60 > 0 ? `${gapMinutes % 60}min` : ""}` : `${gapMinutes}min`} livres</span>
                      </div>
                    )}
                    {ride.passenger?.rating != null && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span>{ride.passenger.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom row */}
                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <div>
                      <div className="text-xs text-muted-foreground">Oferta do passageiro</div>
                      <div className="text-lg font-bold text-primary">R$ {ride.offeredPrice.toFixed(2)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(ride.offers?.length ?? 0) > 0 && (
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                          {ride.offers!.length} oferta{ride.offers!.length > 1 ? "s" : ""}
                        </span>
                      )}
                      {/* Score pill — click to toggle */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowScores(isExpanded ? null : ride.id); }}
                        className="flex items-center gap-1 bg-secondary rounded-full px-2 py-1 text-xs font-semibold hover:bg-secondary/80 transition"
                        title="Ver pontuação"
                      >
                        <Zap className="w-3 h-3 text-primary" />
                        <span className="text-primary">{score.total}</span>
                      </button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Expanded score breakdown */}
                  {isExpanded && (
                    <div
                      className="pt-2 border-t border-border space-y-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-xs text-muted-foreground font-semibold mb-2">Pontuação de encaixe</div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="text-muted-foreground">Distância até embarque</span>
                        </div>
                        <ScoreBar value={score.distance} color="bg-blue-500" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="text-muted-foreground">Encaixe na agenda</span>
                        </div>
                        <ScoreBar value={score.scheduleFit} color="bg-green-500" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="text-muted-foreground">Taxa de conclusão</span>
                        </div>
                        <ScoreBar value={score.completionRate} color="bg-yellow-500" />
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                        <span className="font-semibold">Total</span>
                        <span className="font-bold text-primary">{score.total}/100</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
