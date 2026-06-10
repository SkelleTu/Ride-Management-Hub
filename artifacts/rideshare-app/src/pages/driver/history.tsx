import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useListRides, getListRidesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navigation, Clock, Star } from "lucide-react";

export default function DriverHistory() {
  const { user } = useAuth();
  const { data: rides = [], isLoading } = useListRides(
    { driverId: user?.id },
    { query: { queryKey: getListRidesQueryKey({ driverId: user?.id }) } }
  );

  const completedRides = rides.filter(r => r.status === "completed");
  const totalEarned = completedRides.reduce((sum, r) => sum + (r.agreedPrice ?? r.offeredPrice), 0);

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto">
      <div className="text-lg font-bold">Historico de Corridas</div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-secondary rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-primary">{completedRides.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Corridas Finalizadas</div>
        </div>
        <div className="bg-secondary rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-accent">R$ {totalEarned.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground mt-1">Total Recebido</div>
        </div>
      </div>

      {completedRides.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Navigation className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <div>Nenhuma corrida finalizada ainda</div>
        </div>
      )}

      {completedRides.map(ride => (
        <Card key={ride.id} data-testid={`card-ride-${ride.id}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Badge className="text-xs bg-green-500/20 text-green-400">Concluida</Badge>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {new Date(ride.completedAt ?? ride.createdAt).toLocaleDateString("pt-BR")}
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span className="truncate text-muted-foreground">{ride.originAddress.split(",")[0]}</span>
              </div>
              <div className="flex items-center gap-2">
                <Navigation className="w-3 h-3 text-accent shrink-0" />
                <span className="truncate">{ride.destinationAddress.split(",")[0]}</span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground">Passageiro: {ride.passenger?.name?.split(" ")[0]}</div>
              <div className="font-bold text-primary">R$ {(ride.agreedPrice ?? ride.offeredPrice).toFixed(2)}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
