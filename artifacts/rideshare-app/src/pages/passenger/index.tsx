import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useCreateRide } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListRidesQueryKey } from "@workspace/api-client-react";
import MapView from "@/components/map/MapView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, Navigation, Loader2, Route, Hash, LocateFixed } from "lucide-react";
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
    const params = new URLSearchParams({
      olng: String(origin.lng), olat: String(origin.lat),
      dlng: String(destination.lng), dlat: String(destination.lat),
    });
    const r = await fetch(`/api/proxy/route?${params}`);
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

function buildFinalAddress(base: string, number: string) {
  if (!number.trim()) return base;
  return `${base}, nº ${number.trim()}`;
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
  const [originNumber, setOriginNumber] = useState("");
  const [destNumber, setDestNumber] = useState("");
  const [offeredPrice, setOfferedPrice] = useState("");
  const [originSuggestions, setOriginSuggestions] = useState<any[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<any[]>([]);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: redirect to active ride if passenger already has one in progress
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch("/api/rides", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((rides: any[]) => {
        const activeStatuses = ["open", "negotiating", "accepted", "in_progress"];
        const active = rides.find(r => activeStatuses.includes(r.status));
        if (active) setLocation(`/passenger/ride/${active.id}`);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        // Plot marker and center map immediately with raw coordinates
        const coordLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setOrigin({ address: coordLabel, lat, lng });
        setOriginQuery(coordLabel);
        setIsLocating(false);
        // Then try to resolve actual street address in the background
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
          );
          if (r.ok) {
            const data = await r.json();
            if (data?.display_name) {
              const shortName = data.display_name.split(",")[0];
              setOrigin({ address: data.display_name, lat, lng });
              setOriginQuery(shortName);
            }
          }
        } catch {
          // keep coordinates as address fallback
        }
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

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

  const searchAddress = (query: string, type: "origin" | "dest") => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 3) {
      if (type === "origin") setOriginSuggestions([]);
      else setDestSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/proxy/geocode?q=${encodeURIComponent(query)}`);
        if (!r.ok) return;
        const data = await r.json();
        if (Array.isArray(data)) {
          if (type === "origin") setOriginSuggestions(data);
          else setDestSuggestions(data);
        }
      } catch {}
    }, 800);
  };

  const selectAddress = (item: any, type: "origin" | "dest") => {
    const fullAddress = item.postcode
      ? `${item.display_name} — CEP ${item.postcode}`
      : item.display_name;
    const point = { address: fullAddress, lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
    if (type === "origin") {
      setOrigin(point);
      setOriginQuery(item.display_name.split(",")[0]);
      setOriginNumber("");
      setOriginSuggestions([]);
    } else {
      setDestination(point);
      setDestQuery(item.display_name.split(",")[0]);
      setDestNumber("");
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
      setOriginNumber("");
    } else if (!destination) {
      setDestination({ lat, lng, address });
      setDestQuery(address.split(",")[0]);
      setDestNumber("");
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
        originAddress: buildFinalAddress(origin.address, originNumber),
        originLat: origin.lat,
        originLng: origin.lng,
        destinationAddress: buildFinalAddress(destination.address, destNumber),
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
    <>
      {/* Map: fixed to viewport, completely free from flex/overflow constraints */}
      <div className="fixed inset-x-0 top-16 bottom-0 z-0">
        <MapView
          origin={origin}
          destination={destination}
          routePoints={routePoints}
          onMapClick={handleMapClick}
          passengerPhotoUrl={user?.avatarUrl ?? null}
          passengerLabel={user?.name ? user.name.split(" ").slice(0, 2).join(" ") : "Você"}
          className="h-full w-full"
        />
      </div>

      {/* Bottom sheet: fixed on top of map */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-2xl shadow-2xl p-4 space-y-3 z-[1000]">
        <div className="w-10 h-1 bg-muted rounded-full mx-auto" />
        <div className="text-sm text-muted-foreground font-medium">
          Olá, {user?.name?.split(" ")[0]}! Para onde vamos?
        </div>

        {/* Origin */}
        <div className="space-y-1.5">
          <div className="relative">
            <div className={`flex items-center gap-2 bg-secondary rounded-xl px-3 py-2.5 border transition-colors ${isLocating ? "border-primary/50" : "border-border focus-within:border-primary"}`}>
              {isLocating ? (
                <LocateFixed className="w-3.5 h-3.5 text-primary shrink-0 animate-pulse" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
              )}
              <Input
                data-testid="input-origin"
                placeholder={isLocating ? "Detectando sua localização..." : "De onde?"}
                value={originQuery}
                disabled={isLocating}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                onChange={(e) => {
                  setOriginQuery(e.target.value);
                  setOrigin(null);
                  searchAddress(e.target.value, "origin");
                }}
                className="border-none bg-transparent p-0 h-auto text-sm focus-visible:ring-0 disabled:opacity-60 disabled:cursor-wait"
              />
              {isLocating && (
                <Loader2 className="w-3.5 h-3.5 text-primary shrink-0 animate-spin" />
              )}
            </div>
            {originSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                {originSuggestions.map((s) => (
                  <button key={`${s.lat}-${s.lon}`} onMouseDown={(e) => { e.preventDefault(); selectAddress(s, "origin"); }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-secondary transition-colors border-b border-border last:border-0">
                    <div className="font-medium truncate">{s.display_name.split(",")[0]}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.display_name.split(",").slice(1, 3).join(",")}
                      {s.postcode ? ` · CEP ${s.postcode}` : ""}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Number field for origin */}
          <div className="flex items-center gap-2 bg-secondary/60 rounded-lg px-3 py-2 border border-border/60 focus-within:border-primary/60 transition-colors">
            <Hash className="w-3 h-3 text-muted-foreground shrink-0" />
            <Input
              data-testid="input-origin-number"
              placeholder="Número / complemento (ex: 123, Apto 4)"
              value={originNumber}
              onChange={(e) => setOriginNumber(e.target.value)}
              className="border-none bg-transparent p-0 h-auto text-xs focus-visible:ring-0"
            />
          </div>
        </div>

        {/* Destination */}
        <div className="space-y-1.5">
          <div className="relative">
            <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2.5 border border-border focus-within:border-accent transition-colors">
              <Navigation className="w-3 h-3 text-accent shrink-0" />
              <Input
                data-testid="input-destination"
                placeholder="Para onde?"
                value={destQuery}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                onChange={(e) => {
                  setDestQuery(e.target.value);
                  setDestination(null);
                  searchAddress(e.target.value, "dest");
                }}
                className="border-none bg-transparent p-0 h-auto text-sm focus-visible:ring-0"
              />
            </div>
            {destSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                {destSuggestions.map((s) => (
                  <button key={`${s.lat}-${s.lon}`} onMouseDown={(e) => { e.preventDefault(); selectAddress(s, "dest"); }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-secondary transition-colors border-b border-border last:border-0">
                    <div className="font-medium truncate">{s.display_name.split(",")[0]}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.display_name.split(",").slice(1, 3).join(",")}
                      {s.postcode ? ` · CEP ${s.postcode}` : ""}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Number field for destination */}
          <div className="flex items-center gap-2 bg-secondary/60 rounded-lg px-3 py-2 border border-border/60 focus-within:border-accent/60 transition-colors">
            <Hash className="w-3 h-3 text-muted-foreground shrink-0" />
            <Input
              data-testid="input-dest-number"
              placeholder="Número / complemento (ex: 456, Bloco B)"
              value={destNumber}
              onChange={(e) => setDestNumber(e.target.value)}
              className="border-none bg-transparent p-0 h-auto text-xs focus-visible:ring-0"
            />
          </div>
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
    </>
  );
}
