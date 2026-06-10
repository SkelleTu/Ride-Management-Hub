import { useState } from "react";
import { useLocation } from "wouter";
import { useGetRide, getGetRideQueryKey, useUpdateRideStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, Navigation, MapPin, Play, CheckSquare, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openGpsApp } from "@/lib/gps";

const GPS_APPS = [
  { id: "googleMaps" as const, name: "Google Maps", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: "waze" as const, name: "Waze", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  { id: "browser" as const, name: "Maps (Browser)", color: "bg-secondary text-foreground border-border" },
];

export default function DriverRide({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [gpsSheetOpen, setGpsSheetOpen] = useState(false);
  const [gpsTarget, setGpsTarget] = useState<{ lat: number; lng: number } | null>(null);

  const { data: ride, isLoading } = useGetRide(id, {
    query: { queryKey: getGetRideQueryKey(id), refetchInterval: 5000 }
  });
  const updateStatus = useUpdateRideStatus();

  const handleStartTrip = () => {
    if (!ride) return;
    // Open GPS to pickup address
    setGpsTarget({ lat: ride.originLat, lng: ride.originLng });
    setGpsSheetOpen(true);
  };

  const handleTripStarted = () => {
    if (!ride) return;
    updateStatus.mutate({ id, data: { status: "in_progress" } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetRideQueryKey(id) });
        // Open GPS to destination
        setGpsTarget({ lat: ride.destinationLat, lng: ride.destinationLng });
        setGpsSheetOpen(true);
        toast({ title: "Viagem iniciada!" });
      },
    });
  };

  const handleComplete = () => {
    updateStatus.mutate({ id, data: { status: "completed" } }, {
      onSuccess: () => {
        toast({ title: "Corrida finalizada com sucesso!" });
        setLocation("/driver");
      },
    });
  };

  const handleGpsOpen = (app: "googleMaps" | "waze" | "browser") => {
    if (!gpsTarget) return;
    openGpsApp(app, gpsTarget.lat, gpsTarget.lng);
    setGpsSheetOpen(false);
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!ride) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Corrida não encontrada</div>;

  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto pb-8">
      <button onClick={() => setLocation("/driver")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div>
        <div className="text-xl font-bold">Corrida #{ride.id}</div>
        <Badge className={`mt-1 text-xs ${ride.status === "in_progress" ? "bg-accent/20 text-accent" : "bg-primary/20 text-primary"}`}>
          {ride.status === "in_progress" ? "Em Viagem" : "Motorista a Caminho"}
        </Badge>
      </div>

      {/* Passenger */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
            {ride.passenger?.name.charAt(0)}
          </div>
          <div>
            <div className="font-semibold">{ride.passenger?.name}</div>
            <div className="text-sm text-muted-foreground">{ride.passenger?.phone}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-muted-foreground">Valor acordado</div>
            <div className="text-lg font-bold text-primary">R$ {(ride.agreedPrice ?? ride.offeredPrice).toFixed(2)}</div>
          </div>
        </CardContent>
      </Card>

      {/* Route */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">Embarque</div>
              <div className="text-sm font-medium">{ride.originAddress.split(",").slice(0, 2).join(",")}</div>
            </div>
            <button
              onClick={() => { setGpsTarget({ lat: ride.originLat, lng: ride.originLng }); setGpsSheetOpen(true); }}
              className="text-xs flex items-center gap-1 text-primary bg-primary/10 px-2 py-1 rounded-lg"
            >
              <Navigation className="w-3 h-3" /> Navegar
            </button>
          </div>
          <div className="ml-1 border-l-2 border-dashed border-muted h-4" />
          <div className="flex items-start gap-3">
            <Navigation className="w-3 h-3 text-accent mt-1 shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">Destino</div>
              <div className="text-sm font-medium">{ride.destinationAddress.split(",").slice(0, 2).join(",")}</div>
            </div>
            <button
              onClick={() => { setGpsTarget({ lat: ride.destinationLat, lng: ride.destinationLng }); setGpsSheetOpen(true); }}
              className="text-xs flex items-center gap-1 text-accent bg-accent/10 px-2 py-1 rounded-lg"
            >
              <Navigation className="w-3 h-3" /> Navegar
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-3">
        {ride.status === "accepted" && (
          <Button
            data-testid="button-start-trip"
            onClick={handleStartTrip}
            className="w-full h-14 text-base font-bold bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl"
          >
            <Play className="w-5 h-5 mr-2" />
            A Bordo — Iniciar Viagem
          </Button>
        )}

        {ride.status === "accepted" && (
          <Button
            data-testid="button-trip-started"
            onClick={handleTripStarted}
            disabled={updateStatus.isPending}
            variant="outline"
            className="w-full h-12 rounded-xl border-primary/50 text-primary"
          >
            Viagem Iniciada (abrir GPS ao destino)
          </Button>
        )}

        {ride.status === "in_progress" && (
          <Button
            data-testid="button-complete-ride"
            onClick={handleComplete}
            disabled={updateStatus.isPending}
            className="w-full h-14 text-base font-bold bg-primary text-primary-foreground rounded-xl"
          >
            <CheckSquare className="w-5 h-5 mr-2" />
            Finalizar Corrida
          </Button>
        )}
      </div>

      {/* GPS App Selector Sheet */}
      <Sheet open={gpsSheetOpen} onOpenChange={setGpsSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle>Abrir no GPS</SheetTitle>
          </SheetHeader>
          <div className="space-y-3">
            {GPS_APPS.map(app => (
              <button
                key={app.id}
                data-testid={`button-gps-${app.id}`}
                onClick={() => handleGpsOpen(app.id)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors ${app.color} hover:opacity-80`}
              >
                <span className="font-semibold">{app.name}</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
