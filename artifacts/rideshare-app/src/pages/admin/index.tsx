import { useLocation } from "wouter";
import { useGetAdminStats, getGetAdminStatsQueryKey, useGetRecentActivity, getGetRecentActivityQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Car, MapPin, TrendingUp, Clock, ChevronRight, AlertCircle } from "lucide-react";

export default function AdminHome() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading: statsLoading } = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey(), refetchInterval: 30000 } });
  const { data: activity = [], isLoading: actLoading } = useGetRecentActivity({ query: { queryKey: getGetRecentActivityQueryKey(), refetchInterval: 30000 } });

  const ACTIVITY_ICONS: Record<string, string> = {
    ride_completed: "Corrida finalizada",
    driver_registered: "Novo motorista cadastrado",
    driver_approved: "Motorista aprovado",
    driver_denied: "Motorista negado",
    ride_cancelled: "Corrida cancelada",
    new_passenger: "Novo passageiro",
  };

  return (
    <div className="flex-1 p-4 space-y-5 overflow-y-auto">
      <div>
        <div className="text-xl font-bold">Painel do Administrador</div>
        <div className="text-sm text-muted-foreground">Visao geral da plataforma</div>
      </div>

      {/* Stats Grid */}
      {statsLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-secondary rounded-xl animate-pulse" />)}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="col-span-2 bg-gradient-to-r from-primary/20 to-primary/5 border-primary/30">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Receita Total</div>
                <div className="text-3xl font-bold text-primary">R$ {stats.totalRevenue.toFixed(2)}</div>
              </div>
              <TrendingUp className="w-10 h-10 text-primary opacity-50" />
            </CardContent>
          </Card>
          {[
            { label: "Passageiros", value: stats.totalPassengers, icon: Users, color: "text-blue-400" },
            { label: "Motoristas", value: stats.totalDrivers, icon: Car, color: "text-accent" },
            { label: "Corridas Totais", value: stats.totalRides, icon: MapPin, color: "text-primary" },
            { label: "Corridas Ativas", value: stats.activeRides, icon: Clock, color: "text-yellow-400" },
            { label: "Concluidas", value: stats.completedRides, icon: MapPin, color: "text-green-400" },
            { label: "Canceladas", value: stats.cancelledRides, icon: MapPin, color: "text-destructive" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pending Drivers Alert */}
      {stats && stats.pendingDrivers > 0 && (
        <button onClick={() => setLocation("/admin/drivers")}
          className="w-full flex items-center justify-between bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-left hover:bg-yellow-500/20 transition-colors">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400" />
            <div>
              <div className="font-semibold text-yellow-400">{stats.pendingDrivers} motorista{stats.pendingDrivers > 1 ? "s" : ""} aguardando aprovacao</div>
              <div className="text-xs text-muted-foreground">Clique para revisar</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-yellow-400" />
        </button>
      )}

      {/* Quick Nav */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Motoristas", path: "/admin/drivers", sub: `${stats?.pendingDrivers ?? 0} pendentes` },
          { label: "Passageiros", path: "/admin/passengers", sub: `${stats?.totalPassengers ?? 0} cadastrados` },
          { label: "Corridas", path: "/admin/rides", sub: `${stats?.activeRides ?? 0} ativas` },
          { label: "Todos Usuarios", path: "/admin/users", sub: "Gerenciar contas" },
        ].map(({ label, path, sub }) => (
          <button key={path} onClick={() => setLocation(path)}
            className="flex flex-col items-start p-4 bg-secondary rounded-xl hover:bg-secondary/80 transition-colors text-left">
            <div className="font-semibold text-sm">{label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
          </button>
        ))}
      </div>

      {/* Recent Activity */}
      <div>
        <div className="text-sm font-semibold text-muted-foreground mb-3">Atividade Recente</div>
        <div className="space-y-2">
          {actLoading && <div className="h-10 bg-secondary rounded-xl animate-pulse" />}
          {activity.slice(0, 8).map(item => (
            <div key={item.id} data-testid={`activity-item-${item.id}`} className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{item.description}</div>
                <div className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("pt-BR", { timeStyle: "short", dateStyle: "short" })}</div>
              </div>
            </div>
          ))}
          {activity.length === 0 && !actLoading && (
            <div className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade recente</div>
          )}
        </div>
      </div>
    </div>
  );
}
