import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetRide, getGetRideQueryKey, useCreateOffer } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetActiveRidesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, MapPin, Navigation, Send, Route, Loader2, AlertCircle } from "lucide-react";
import { DriverStatusBanner } from "@/components/driver/DriverStatusBanner";
import { useToast } from "@/hooks/use-toast";

const PRICE_PER_KM = 2.5;
const BASE_FARE = 3.0;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function DriverOffer({ params }: { params: { rideId: string } }) {
  const rideId = parseInt(params.rideId);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");

  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsError, setGpsError] = useState(false);

  const { data: ride, isLoading } = useGetRide(rideId, {
    query: { queryKey: getGetRideQueryKey(rideId) }
  });
  const createOffer = useCreateOffer();

  useEffect(() => {
    if (!navigator.geolocation) { setGpsError(true); setGpsLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDriverPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      () => { setGpsError(true); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const distances = (() => {
    if (!ride) return null;
    const tripKm = haversineKm(ride.originLat, ride.originLng, ride.destinationLat, ride.destinationLng);
    if (!driverPos) return { tripKm, toPickupKm: null, totalKm: tripKm };
    const toPickupKm = haversineKm(driverPos.lat, driverPos.lng, ride.originLat, ride.originLng);
    return { tripKm, toPickupKm, totalKm: toPickupKm + tripKm };
  })();

  const suggestedPrice = distances
    ? Math.max(BASE_FARE + distances.totalKm * PRICE_PER_KM, BASE_FARE)
    : null;

  useEffect(() => {
    if (suggestedPrice !== null && !price) {
      setPrice(suggestedPrice.toFixed(2));
    }
  }, [suggestedPrice]);

  const handleSubmit = () => {
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) {
      toast({ title: "Informe um valor válido", variant: "destructive" });
      return;
    }
    createOffer.mutate({ rideId, data: { price: p, message: message || null } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetActiveRidesQueryKey() });
        toast({ title: "Oferta enviada! Aguarde a resposta do passageiro." });
        setLocation("/driver");
      },
      onError: (e: any) => toast({ title: e?.data?.error ?? "Erro ao enviar oferta", variant: "destructive" }),
    });
  };

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );
  if (!ride) return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">Corrida não encontrada</div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <DriverStatusBanner />
      <div className="p-4 space-y-5">
        <button onClick={() => setLocation("/driver")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div>
          <div className="text-xl font-bold">Fazer Oferta</div>
          <div className="text-sm text-muted-foreground">Corrida #{ride.id} · {ride.passenger?.name}</div>
        </div>

        {/* Route */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground">Embarque</div>
                <div className="text-sm font-medium">{ride.originAddress.split(",").slice(0, 2).join(",")}</div>
              </div>
            </div>
            <div className="ml-1 border-l-2 border-dashed border-muted h-4" />
            <div className="flex items-start gap-3">
              <Navigation className="w-3 h-3 text-accent mt-1 shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground">Destino</div>
                <div className="text-sm font-medium">{ride.destinationAddress.split(",").slice(0, 2).join(",")}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Distance breakdown */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Route className="w-4 h-4" />
              Cálculo de distância
            </div>

            {gpsLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Obtendo sua localização...
              </div>
            )}

            {gpsError && (
              <div className="flex items-center gap-2 text-sm text-yellow-500">
                <AlertCircle className="w-3.5 h-3.5" />
                Localização indisponível — calculado só com a distância da corrida
              </div>
            )}

            {distances && (
              <div className="space-y-2">
                {distances.toPickupKm !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Você → Embarque
                    </span>
                    <span className="font-medium">{distances.toPickupKm.toFixed(1)} km</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Navigation className="w-3 h-3" /> Embarque → Destino
                  </span>
                  <span className="font-medium">{distances.tripKm.toFixed(1)} km</span>
                </div>
                <div className="border-t border-primary/20 pt-2 flex justify-between text-sm font-semibold">
                  <span>Total percorrido</span>
                  <span className="text-primary">{distances.totalKm.toFixed(1)} km</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Tarifa base R$ {BASE_FARE.toFixed(2)} + R$ {PRICE_PER_KM.toFixed(2)}/km
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Passenger offer */}
        <div className="flex items-center justify-between bg-secondary rounded-xl p-4">
          <span className="text-sm text-muted-foreground">Oferta do passageiro</span>
          <span className="text-xl font-bold text-accent">R$ {ride.offeredPrice.toFixed(2)}</span>
        </div>

        {/* Your price */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Sua proposta de valor</label>
            {suggestedPrice !== null && (
              <button
                className="text-xs text-primary underline"
                onClick={() => setPrice(suggestedPrice.toFixed(2))}
              >
                Usar sugestão (R$ {suggestedPrice.toFixed(2)})
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 bg-secondary rounded-xl px-4 py-3 border border-border focus-within:border-primary transition-colors">
            <span className="text-primary font-bold">R$</span>
            <Input
              data-testid="input-offer-price"
              type="number"
              placeholder="0,00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="border-none bg-transparent p-0 h-auto text-xl font-bold focus-visible:ring-0"
            />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Mensagem (opcional)</label>
          <Textarea
            data-testid="input-offer-message"
            placeholder="Ex: Carro limpo, ar condicionado, chego em 5 min..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="bg-secondary border-border resize-none"
            rows={3}
          />
        </div>

        <Button
          data-testid="button-send-offer"
          onClick={handleSubmit}
          disabled={!price || createOffer.isPending}
          className="w-full h-12 text-base font-semibold rounded-xl"
        >
          <Send className="w-4 h-4 mr-2" />
          {createOffer.isPending ? "Enviando..." : "Enviar Oferta"}
        </Button>
      </div>
    </div>
  );
}
