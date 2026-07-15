import { useState } from "react";
import { useListRides, getListRidesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Navigation, Clock, MapPin } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: "Aberta", color: "bg-yellow-500/20 text-yellow-400" },
  negotiating: { label: "Negociando", color: "bg-blue-500/20 text-blue-400" },
  accepted: { label: "Aceita", color: "bg-primary/20 text-primary" },
  in_progress: { label: "Em Viagem", color: "bg-accent/20 text-accent" },
  completed: { label: "Concluida", color: "bg-green-500/20 text-green-400" },
  cancelled: { label: "Cancelada", color: "bg-destructive/20 text-destructive" },
};

export default function AdminRides() {
  const [activeTab, setActiveTab] = useState("all");

  const { data: rides = [], isLoading } = useListRides(
    activeTab !== "all" ? { status: activeTab as any } : undefined,
    { query: { queryKey: getListRidesQueryKey(activeTab !== "all" ? { status: activeTab as any } : undefined) } }
  );

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="text-xl font-bold">Corridas</div>
        <div className="text-sm text-muted-foreground">{rides.length} total</div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary overflow-x-auto flex w-full">
          <TabsTrigger value="all" className="flex-1 text-xs">Todas</TabsTrigger>
          <TabsTrigger value="open" className="flex-1 text-xs">Abertas</TabsTrigger>
          <TabsTrigger value="in_progress" className="flex-1 text-xs">Ativas</TabsTrigger>
          <TabsTrigger value="completed" className="flex-1 text-xs">Concluidas</TabsTrigger>
          <TabsTrigger value="cancelled" className="flex-1 text-xs">Canceladas</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-3 space-y-3">
          {rides.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <div>Nenhuma corrida encontrada</div>
            </div>
          )}
          {rides.map(ride => {
            const s = STATUS_CONFIG[ride.status] ?? { label: ride.status, color: "" };
            return (
              <Card key={ride.id} data-testid={`card-ride-${ride.id}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${s.color}`}>{s.label}</Badge>
                      <span className="text-xs text-muted-foreground">#{ride.id}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {new Date(ride.createdAt).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="truncate text-muted-foreground">{ride.originAddress.split(",")[0]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Navigation className="w-3 h-3 text-accent shrink-0" />
                      <span className="truncate">{ride.destinationAddress.split(",")[0]}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs border-t border-border pt-2">
                    <div className="text-muted-foreground">
                      <span className="font-medium text-foreground">{ride.passenger?.name?.split(" ")[0]}</span>
                      {ride.driver && <span> → {ride.driver.name?.split(" ")[0]}</span>}
                    </div>
                    <div className="font-bold text-primary">R$ {(ride.agreedPrice ?? ride.offeredPrice).toFixed(2)}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
