import { useLocation } from "wouter";
import { useListDrivers, getListDriversQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Clock, CheckCircle, XCircle, Search, Car, ChevronRight } from "lucide-react";

const STATUS_CONFIG = {
  pending: { label: "Pendente", icon: Clock, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  approved: { label: "Aprovado", icon: CheckCircle, color: "bg-green-500/20 text-green-400 border-green-500/30" },
  denied: { label: "Negado", icon: XCircle, color: "bg-destructive/20 text-destructive border-destructive/30" },
};

export default function AdminDrivers() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("pending");

  const { data: drivers = [], isLoading } = useListDrivers(
    { status: activeTab as any, search: search || undefined },
    { query: { queryKey: getListDriversQueryKey({ status: activeTab as any, search: search || undefined }) } }
  );

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto">
      <div className="text-xl font-bold">Motoristas</div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          data-testid="input-search-drivers"
          placeholder="Buscar motoristas..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-secondary border-border"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full bg-secondary">
          <TabsTrigger value="pending" className="flex-1 text-xs">Pendentes</TabsTrigger>
          <TabsTrigger value="approved" className="flex-1 text-xs">Aprovados</TabsTrigger>
          <TabsTrigger value="denied" className="flex-1 text-xs">Negados</TabsTrigger>
        </TabsList>

        {["pending", "approved", "denied"].map(tab => (
          <TabsContent key={tab} value={tab} className="mt-3 space-y-3">
            {drivers.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Car className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <div>Nenhum motorista {STATUS_CONFIG[tab as keyof typeof STATUS_CONFIG].label.toLowerCase()}</div>
              </div>
            )}
            {drivers.map(driver => {
              const cfg = STATUS_CONFIG[driver.status as keyof typeof STATUS_CONFIG];
              const Icon = cfg.icon;
              return (
                <Card
                  key={driver.id}
                  data-testid={`card-driver-${driver.id}`}
                  className="cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => setLocation(`/admin/drivers/${driver.id}`)}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-sm shrink-0">
                      {driver.user?.name?.charAt(0) ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{driver.user?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {driver.vehicleMake} {driver.vehicleModel} · {driver.vehiclePlate}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(driver.createdAt).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${cfg.color}`}>
                        <Icon className="w-3 h-3 mr-1" />{cfg.label}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
