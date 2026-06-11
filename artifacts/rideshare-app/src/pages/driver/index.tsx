import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useGetActiveRides, getGetActiveRidesQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navigation, Clock, ChevronRight, Car, Lock } from "lucide-react";
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

export default function DriverHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: rides = [], isLoading, refetch } = useGetActiveRides({
    query: { queryKey: getGetActiveRidesQueryKey(), refetchInterval: 10000 }
  });
  const { data: profile } = useQuery({
    queryKey: ["driver-profile-me", user?.id],
    queryFn: fetchMyDriverProfile,
    enabled: !!user?.id,
  });

  // Poll for accepted/in_progress ride assigned to this driver and redirect
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
      ) : (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold">Corridas Disponíveis</div>
              <div className="text-sm text-muted-foreground">{rides.length} solicitações abertas</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">
              Atualizar
            </Button>
          </div>

          {rides.length === 0 && (
            <div className="text-center py-20 space-y-3">
              <div className="w-16 h-16 mx-auto bg-secondary rounded-2xl flex items-center justify-center">
                <Car className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="text-muted-foreground">Nenhuma corrida disponível no momento</div>
              <div className="text-xs text-muted-foreground">Novas solicitações aparecerão aqui automaticamente</div>
            </div>
          )}

          {rides.map(ride => (
            <Card
              key={ride.id}
              data-testid={`card-ride-${ride.id}`}
              className="cursor-pointer hover:border-primary/40 transition-all hover:shadow-[0_0_20px_rgba(34,197,94,0.1)] active:scale-[0.99]"
              onClick={() => setLocation(`/driver/offer/${ride.id}`)}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge className={`text-xs ${ride.status === "negotiating" ? "bg-blue-500/20 text-blue-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                    {ride.status === "negotiating" ? "Negociando" : "Nova Corrida"}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {new Date(ride.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground">Embarque</div>
                      <div className="text-sm font-medium">{ride.originAddress.split(",")[0]}</div>
                      {ride.originAddress.includes(",") && (
                        <div className="text-xs text-muted-foreground truncate">
                          {ride.originAddress.split(",").slice(1).join(",").trim()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ml-1 border-l-2 border-dashed border-muted-foreground/30 h-3" />
                  <div className="flex items-start gap-2">
                    <Navigation className="w-3 h-3 text-accent mt-1 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground">Destino</div>
                      <div className="text-sm font-medium">{ride.destinationAddress.split(",")[0]}</div>
                      {ride.destinationAddress.includes(",") && (
                        <div className="text-xs text-muted-foreground truncate">
                          {ride.destinationAddress.split(",").slice(1).join(",").trim()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <div>
                    <div className="text-xs text-muted-foreground">Oferta do passageiro</div>
                    <div className="text-lg font-bold text-primary">R$ {ride.offeredPrice.toFixed(2)}</div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {(ride.offers?.length ?? 0) > 0 && (
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                        {ride.offers!.length} oferta{ride.offers!.length > 1 ? "s" : ""}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
