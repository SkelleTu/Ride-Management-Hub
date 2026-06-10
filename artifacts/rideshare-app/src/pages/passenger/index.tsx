import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useCreateRide } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListRidesQueryKey } from "@workspace/api-client-react";
import MapView from "@/components/map/MapView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, Navigation, Loader2, Route } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PRICE_PER_KM = 2;

interface LocationPoint {
  address: string;
  lat: number;
  lng: number;
}

async function fetchRoute(origin: LocationPoint, destination: LocationPoint): Promise<{
  distanceKm: number;
  routePoints: [number, number][];
} | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
    const r = await fetch(url);
    const data = await r.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;
    const route = data.routes[0];
    const distanceKm = route.distance / 1000;
    const routePoints: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );
    return { distanceKm, routePoints };
  } catch {
    return null;
  }
}

export default function PassengerHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [origin, setOrigin] = useState<LocationPoint | null>(null);
  const [destination, setDestination] = useState<LocationPoint | null>(null);
  const [originQuery, setOriginQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [offeredPrice, setOfferedPrice] = useState("");
  const [originSuggestions, setOriginSuggestions] = useState<any[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<any[]>([]);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  const createRide = useCreateRide();

  useEffect(() => {
    if (!origin || !destination) {
      setDistanceKm(null);
      setRoutePoints([]);
      setOfferedPrice("");
      return;
    }

    setIsCalculating(true);
    fetchRoute(origin, destination).then((result) => {
      setIsCalculating(false);
      if (result) {
        setDistanceKm(result.distanceKm);
        setRoutePoints(result.routePoints);
        setOfferedPrice((result.distanceKm * PRICE_PER_KM).toFixed(2));
      }
    });
  }, [origin, destination]);

  const searchAddress = async (query: string, type: "origin" | "dest") => {
    if (query.length < 3) return;
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=br`
      );
      const data = await r.json();
      if (type === "origin") setOriginSuggestions(data);
      else setDestSuggestions(data);
    } catch {}
  };

  const selectAddress = (item: any, type: "origin" | "dest") => {
    const point = { address: item.display_name, lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
    if (type === "origin") {
      setOrigin(point);
      setOriginQuery(item.display_name.split(",")[0]);
      setOriginSuggestions([]);
    } else {
      setDestination(point);
      setDestQuery(item.display_name.split(",")[0]);
      setDestSuggestions([]);
    }
  };

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
      const data = await r.json();
      if (data.display_name) address = data.display_name;
    } catch {}
    if (!origin) {
      setOrigin({ lat, lng, address });
      setOriginQuery(address.split(",")[0]);
    } else if (!destination) {
      setDestination({ lat, lng, address });
      setDestQuery(address.split(",")[0]);
    }
  }, [origin, destination]);

  const handleSubmit = () => {
    if (!origin || !destination || !offeredPrice) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    const price = parseFloat(offeredPrice);
    if (isNaN(price) || price <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    createRide.mutate({
      data: {
        originAddress: origin.address,
        originLat: origin.lat,
        originLng: origin.lng,
        destinationAddress: destination.address,
        destinationLat: destination.lat,
        destinationLng: destination.lng,
        offeredPrice: price,
      }
    }, {
      onSuccess: (ride) => {
        queryClient.invalidateQueries({ queryKey: getListRidesQueryKey() });
        setLocation(`/passenger/ride/${ride.id}`);
      },
      onError: () => toast({ title: "Erro ao solicitar corrida", variant: "destructive" }),
    });
  };

  return (
    <div className="flex-1 flex flex-col relative h-[calc(100dvh-56px)]">
      <div className="flex-1">
        <MapView
          origin={origin}
          destination={destination}
          routePoints={routePoints}
          onMapClick={handleMapClick}
          className="h-full w-full"
        />
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-2xl shadow-2xl p-4 space-y-3 z-[1000]">
        <div className="w-10 h-1 bg-muted rounded-full mx-auto" />
        <div className="text-sm text-muted-foreground font-medium">
          Olá, {user?.name?.split(" ")[0]}! Para onde vamos?
        </div>

        {/* Origin */}
        <div className="relative">
          <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2.5 border border-border focus-within:border-primary transition-colors">
            <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
            <Input
              data-testid="input-origin"
              placeholder="De onde?"
              value={originQuery}
              onChange={(e) => { setOriginQuery(e.target.value); searchAddress(e.target.value, "origin"); }}
              className="border-none bg-transparent p-0 h-auto text-sm focus-visible:ring-0"
            />
          </div>
          {originSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
              {originSuggestions.map((s, i) => (
                <button key={i} onClick={() => selectAddress(s, "origin")}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-secondary transition-colors border-b border-border last:border-0">
                  <div className="font-medium truncate">{s.display_name.split(",")[0]}</div>
                  <div className="text-xs text-muted-foreground truncate">{s.display_name.split(",").slice(1, 3).join(",")}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Destination */}
        <div className="relative">
          <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2.5 border border-border focus-within:border-accent transition-colors">
            <Navigation className="w-3 h-3 text-accent shrink-0" />
            <Input
              data-testid="input-destination"
              placeholder="Para onde?"
              value={destQuery}
              onChange={(e) => { setDestQuery(e.target.value); searchAddress(e.target.value, "dest"); }}
              className="border-none bg-transparent p-0 h-auto text-sm focus-visible:ring-0"
            />
          </div>
          {destSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
              {destSuggestions.map((s, i) => (
                <button key={i} onClick={() => selectAddress(s, "dest")}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-secondary transition-colors border-b border-border last:border-0">
                  <div className="font-medium truncate">{s.display_name.split(",")[0]}</div>
                  <div className="text-xs text-muted-foreground truncate">{s.display_name.split(",").slice(1, 3).join(",")}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Price estimate card */}
        {(isCalculating || distanceKm !== null) && (
          <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2.5">
            {isCalculating ? (
              <>
                <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                <span className="text-sm text-muted-foreground">Calculando rota e preço...</span>
              </>
            ) : (
              <>
                <Route className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 text-sm">
                  <span className="text-muted-foreground">{distanceKm?.toFixed(1)} km</span>
                  <span className="mx-2 text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">R$ {PRICE_PER_KM},00/km</span>
                </div>
                <span className="text-primary font-bold text-base">R$ {offeredPrice}</span>
              </>
            )}
          </div>
        )}

        {/* Price field (editable) */}
        <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2.5 border border-border focus-within:border-primary transition-colors">
          <span className="text-primary font-semibold text-sm shrink-0">R$</span>
          <Input
            data-testid="input-price"
            type="number"
            placeholder={distanceKm ? "Preço calculado automaticamente" : "Sua oferta de preço"}
            value={offeredPrice}
            onChange={(e) => setOfferedPrice(e.target.value)}
            className="border-none bg-transparent p-0 h-auto text-sm focus-visible:ring-0"
          />
        </div>

        <Button
          data-testid="button-request-ride"
          onClick={handleSubmit}
          disabled={!origin || !destination || !offeredPrice || createRide.isPending || isCalculating}
          className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl"
        >
          {createRide.isPending ? "Solicitando..." : "Solicitar Corrida"}
          {!createRide.isPending && <ChevronRight className="ml-1 w-4 h-4" />}
        </Button>

        <div className="text-xs text-center text-muted-foreground">
          Toque no mapa para marcar os pontos · preço pode ser ajustado
        </div>
      </div>
    </div>
  );
}
