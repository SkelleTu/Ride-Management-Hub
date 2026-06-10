import { useLocation } from "wouter";
import { useListRides, getListRidesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navigation, Clock, ChevronRight } from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: "Aguardando", color: "bg-yellow-500/20 text-yellow-400" },
  negotiating: { label: "Negociando", color: "bg-blue-500/20 text-blue-400" },
  accepted: { label: "Aceita", color: "bg-primary/20 text-primary" },
  in_progress: { label: "Em Viagem", color: "bg-accent/20 text-accent" },
  completed: { label: "Concluida", color: "bg-green-500/20 text-green-400" },
  cancelled: { label: "Cancelada", color: "bg-destructive/20 text-destructive" },
};

export default function PassengerHistory() {
  const [, setLocation] = useLocation();
  const { data: rides = [], isLoading } = useListRides(undefined, { query: { queryKey: getListRidesQueryKey() } });

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="flex-1 p-4 space-y-3 overflow-y-auto">
      <div className="text-lg font-bold mb-4">Minhas Corridas</div>
      {rides.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Navigation className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <div>Nenhuma corrida ainda</div>
        </div>
      )}
      {rides.map(ride => {
        const s = STATUS_LABELS[ride.status] ?? { label: ride.status, color: "" };
        const isActive = ["open", "negotiating", "accepted", "in_progress"].includes(ride.status);
        return (
          <Card key={ride.id} data-testid={`card-ride-${ride.id}`}
            className="cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => isActive ? setLocation(`/passenger/ride/${ride.id}`) : undefined}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Badge className={`text-xs ${s.color}`}>{s.label}</Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {new Date(ride.createdAt).toLocaleDateString("pt-BR")}
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
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm font-bold text-primary">
                  R$ {(ride.agreedPrice ?? ride.offeredPrice).toFixed(2)}
                </span>
                {isActive && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
