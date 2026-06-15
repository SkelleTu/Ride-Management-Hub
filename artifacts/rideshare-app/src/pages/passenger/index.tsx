import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useCreateRide } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListRidesQueryKey } from "@workspace/api-client-react";
import MapView from "@/components/map/MapView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronUp, Navigation, Loader2, Route, Hash, LocateFixed, Calendar, Clock, Radio, User2, FileText, Globe, AlertCircle, CheckCircle, MoveIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PRICE_PER_KM = 2;

// ── Drag-pin validation helpers ────────────────────────────────────────────

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeStreet(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/\b(rua|r\.|avenida|av\.?|alameda|al\.?|travessa|tv\.?|estrada|est\.?|rodovia|rod\.?|praça|praca|pça|largo|viela)\b\s*/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function streetsCompatible(typedAddress: string, reversedRoad: string | undefined): boolean {
  if (!reversedRoad) return false;
  const normTyped = normalizeStreet(typedAddress);
  const normReversed = normalizeStreet(reversedRoad);
  // Check token overlap — at least one significant word must match
  const tokensTyped = normTyped.split(" ").filter(t => t.length > 3);
  const tokensReversed = normReversed.split(" ").filter(t => t.length > 3);
  return tokensTyped.some(t => tokensReversed.includes(t));
}

async function reverseGeocodeDetail(lat: number, lng: number): Promise<{
  display_name: string;
  address?: { road?: string; suburb?: string; city?: string; postcode?: string; house_number?: string };
} | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
    );
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

type DragState = null | "loading" | "ok" | "warning" | "far";

interface LocationPoint {
  address: string;
  lat: number;
  lng: number;
}

interface DriverOption {
  id: number;
  name: string;
  vehicleModel: string | null;
  vehiclePlate: string | null;
}

async function fetchRoute(origin: LocationPoint, destination: LocationPoint): Promise<{
  distanceKm: number;
  durationSeconds: number;
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
    const durationSeconds = route.duration;
    const routePoints: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );
    return { distanceKm, durationSeconds, routePoints };
  } catch {
    return null;
  }
}

function buildFinalAddress(base: string, number: string) {
  if (!number.trim()) return base;
  return `${base}, nº ${number.trim()}`;
}

function getMinDatetimeLocal() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
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
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Scheduling state ───────────────────────────────────────────────────
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [schedulingType, setSchedulingType] = useState<"public" | "directed">("public");
  const [directedToDriverId, setDirectedToDriverId] = useState<number | null>(null);
  const [driverSearch, setDriverSearch] = useState("");
  const [driverOptions, setDriverOptions] = useState<DriverOption[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DriverOption | null>(null);
  const [driverSearchLoading, setDriverSearchLoading] = useState(false);
  const [scheduledNote, setScheduledNote] = useState("");
  const driverDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Active map field (which pin map clicks go to) ──────────────────────
  const [activeField, setActiveField] = useState<"origin" | "destination">("origin");

  // ── Mobile bottom sheet ────────────────────────────────────────────────
  const [sheetExpanded, setSheetExpanded] = useState(false);

  // ── Drag-pin state ─────────────────────────────────────────────────────
  const [originDragState, setOriginDragState] = useState<DragState>(null);
  const [destDragState, setDestDragState] = useState<DragState>(null);
  const [originDragMsg, setOriginDragMsg] = useState<string>("");
  const [destDragMsg, setDestDragMsg] = useState<string>("");

  // ── Availability state ─────────────────────────────────────────────────
  const [availability, setAvailability] = useState<{ driverCount: number; totalDrivers: number } | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const availabilityRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: redirect to active NON-SCHEDULED ride if passenger already has one
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch("/api/rides", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((rides: any[]) => {
        const activeStatuses = ["open", "negotiating", "accepted", "in_progress"];
        const active = rides.find(r =>
          activeStatuses.includes(r.status) && !r.isScheduled
        );
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
        const coordLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setOrigin({ address: coordLabel, lat, lng });
        setOriginQuery(coordLabel);
        setIsLocating(false);
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
          if (r.ok) {
            const data = await r.json();
            if (data?.display_name) {
              const shortName = data.display_name.split(",")[0];
              setOrigin({ address: data.display_name, lat, lng });
              setOriginQuery(shortName);
            }
          }
        } catch {}
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Fetch availability when scheduledFor or duration changes
  useEffect(() => {
    if (!isScheduling || !scheduledFor) {
      setAvailability(null);
      return;
    }
    if (availabilityRef.current) clearTimeout(availabilityRef.current);
    availabilityRef.current = setTimeout(async () => {
      const date = scheduledFor.split("T")[0];
      const duration = durationSeconds ? Math.round(durationSeconds / 60) : 60;
      setAvailabilityLoading(true);
      try {
        const token = localStorage.getItem("token");
        const r = await fetch(`/api/rides/availability?date=${date}&duration=${duration}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const data = await r.json();
        const selectedTime = scheduledFor.split("T")[1]?.slice(0, 5) ?? "00:00";
        const [sh, sm] = selectedTime.split(":").map(Number);
        const selMin = sh * 60 + sm;
        let nearest = data.slots?.[0];
        let minDiff = Infinity;
        for (const slot of (data.slots ?? [])) {
          const [h, m] = (slot.time as string).split(":").map(Number);
          const diff = Math.abs(h * 60 + m - selMin);
          if (diff < minDiff) { minDiff = diff; nearest = slot; }
        }
        setAvailability(nearest
          ? { driverCount: nearest.driverCount as number, totalDrivers: nearest.totalDrivers as number }
          : { driverCount: data.totalDrivers ?? 0, totalDrivers: data.totalDrivers ?? 0 }
        );
      } catch {} finally { setAvailabilityLoading(false); }
    }, 600);
  }, [scheduledFor, durationSeconds, isScheduling]);

  const createRide = useCreateRide();

  useEffect(() => {
    if (!origin || !destination) {
      setDistanceKm(null);
      setDurationSeconds(null);
      setRoutePoints([]);
      setOfferedPrice("");
      return;
    }
    setIsCalculating(true);
    fetchRoute(origin, destination).then((result) => {
      setIsCalculating(false);
      if (result) {
        setDistanceKm(result.distanceKm);
        setDurationSeconds(result.durationSeconds);
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

  const searchDrivers = (query: string) => {
    if (driverDebounceRef.current) clearTimeout(driverDebounceRef.current);
    if (query.length < 2) {
      setDriverOptions([]);
      return;
    }
    driverDebounceRef.current = setTimeout(async () => {
      setDriverSearchLoading(true);
      try {
        const token = localStorage.getItem("token");
        const r = await fetch(`/api/drivers?status=approved`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const drivers: any[] = await r.json();
        const q = query.toLowerCase();
        const filtered = drivers
          .filter(d =>
            d.user?.name?.toLowerCase().includes(q) ||
            d.vehicleModel?.toLowerCase().includes(q) ||
            d.vehiclePlate?.toLowerCase().includes(q)
          )
          .slice(0, 8)
          .map(d => ({
            id: d.userId,
            name: d.user?.name ?? `Motorista #${d.userId}`,
            vehicleModel: d.vehicleModel ?? null,
            vehiclePlate: d.vehiclePlate ?? null,
          }));
        setDriverOptions(filtered);
      } catch {} finally {
        setDriverSearchLoading(false);
      }
    }, 400);
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
    const shortAddress = address.split(",")[0];
    if (activeField === "origin") {
      setOrigin({ lat, lng, address });
      setOriginQuery(shortAddress);
      setOriginNumber("");
      setOriginSuggestions([]);
      // Auto-advance to destination if not set yet
      if (!destination) setActiveField("destination");
    } else {
      setDestination({ lat, lng, address });
      setDestQuery(shortAddress);
      setDestNumber("");
      setDestSuggestions([]);
    }
  }, [activeField, destination]);

  // ── Drag-pin handlers ──────────────────────────────────────────────────

  const handleOriginDragEnd = useCallback(async (lat: number, lng: number) => {
    if (!origin) return;
    setOriginDragState("loading");
    setOriginDragMsg("");

    const distMeters = haversineMeters(origin.lat, origin.lng, lat, lng);
    const result = await reverseGeocodeDetail(lat, lng);

    if (!result) {
      setOriginDragState("warning");
      setOriginDragMsg("Não foi possível verificar o endereço");
      setOrigin(prev => prev ? { ...prev, lat, lng } : prev);
      return;
    }

    const reversedRoad = result.address?.road ?? result.display_name.split(",")[0];
    const compatible = streetsCompatible(originQuery, reversedRoad);

    // Compose a clean short address from reversed result
    const parts = [
      result.address?.road,
      result.address?.house_number,
      result.address?.suburb,
    ].filter(Boolean).join(", ");
    const newShortAddress = parts || result.display_name.split(",")[0];

    if (distMeters > 150) {
      // Moved more than 150 m — too far for a pickup fine-tune
      setOriginDragState("far");
      setOriginDragMsg(`Muito longe (${Math.round(distMeters)} m). Mova apenas alguns metros para indicar onde está esperando.`);
      setOrigin(prev => prev ? { ...prev, lat, lng, address: result.display_name } : prev);
      setOriginQuery(newShortAddress);
      toast({ title: "Pin muito longe", description: "Arraste apenas alguns metros para pontuar o local exato.", variant: "destructive" });
    } else if (!compatible) {
      // Close but different street name
      setOriginDragState("warning");
      setOriginDragMsg(`Rua detectada: "${reversedRoad}". Confirme se está correto.`);
      setOrigin(prev => prev ? { ...prev, lat, lng, address: result.display_name } : prev);
      setOriginQuery(newShortAddress);
      toast({ title: "Rua diferente detectada", description: `O pin foi para: ${reversedRoad}` });
    } else {
      // Compatible — update silently
      setOriginDragState("ok");
      setOriginDragMsg(`Ponto ajustado na ${reversedRoad}`);
      setOrigin(prev => prev ? { ...prev, lat, lng, address: result.display_name } : prev);
      setOriginQuery(newShortAddress);
    }
    setTimeout(() => setOriginDragState(null), 4000);
  }, [origin, originQuery, toast]);

  const handleDestDragEnd = useCallback(async (lat: number, lng: number) => {
    if (!destination) return;
    setDestDragState("loading");
    setDestDragMsg("");

    const result = await reverseGeocodeDetail(lat, lng);

    if (!result) {
      setDestDragState("warning");
      setDestDragMsg("Não foi possível verificar o endereço");
      setDestination(prev => prev ? { ...prev, lat, lng } : prev);
      setTimeout(() => setDestDragState(null), 4000);
      return;
    }

    const reversedRoad = result.address?.road ?? result.display_name.split(",")[0];
    const parts = [
      result.address?.road,
      result.address?.house_number,
      result.address?.suburb,
    ].filter(Boolean).join(", ");
    const newShortAddress = parts || result.display_name.split(",")[0];

    // Destination has no distance limit — only check if landed on a road
    if (!reversedRoad) {
      setDestDragState("warning");
      setDestDragMsg("Pin em área sem via identificada. Verifique o ponto.");
      toast({ title: "Verifique o destino", description: "O pin parece estar fora de uma via." });
    } else {
      setDestDragState("ok");
      setDestDragMsg(`Destino ajustado: ${newShortAddress}`);
    }

    setDestination(prev => prev ? { ...prev, lat, lng, address: result.display_name } : prev);
    setDestQuery(newShortAddress);
    setTimeout(() => setDestDragState(null), 4000);
  }, [destination, toast]);

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

    // Scheduling validation
    if (isScheduling) {
      if (!scheduledFor) {
        toast({ title: "Informe data e horário do agendamento", variant: "destructive" });
        return;
      }
      const schedDate = new Date(scheduledFor);
      if (schedDate <= new Date()) {
        toast({ title: "A data do agendamento deve ser futura", variant: "destructive" });
        return;
      }
      if (schedulingType === "directed" && !directedToDriverId) {
        toast({ title: "Selecione um motorista para a corrida direcionada", variant: "destructive" });
        return;
      }
    }

    const rideData: any = {
      originAddress: buildFinalAddress(origin.address, originNumber),
      originLat: origin.lat,
      originLng: origin.lng,
      destinationAddress: buildFinalAddress(destination.address, destNumber),
      destinationLat: destination.lat,
      destinationLng: destination.lng,
      offeredPrice: price,
      estimatedDistance: distanceKm ?? undefined,
      estimatedDuration: durationSeconds ? Math.round(durationSeconds) : undefined,
    };

    if (isScheduling) {
      rideData.isScheduled = true;
      rideData.scheduledFor = new Date(scheduledFor).toISOString();
      rideData.schedulingType = schedulingType;
      if (schedulingType === "directed" && directedToDriverId) {
        rideData.directedToDriverId = directedToDriverId;
      }
      if (scheduledNote.trim()) rideData.scheduledNote = scheduledNote.trim();
    }

    createRide.mutate({ data: rideData }, {
      onSuccess: (ride) => {
        queryClient.invalidateQueries({ queryKey: getListRidesQueryKey() });
        if (isScheduling) {
          toast({
            title: "Corrida agendada com sucesso!",
            description: `Agendada para ${new Date(scheduledFor).toLocaleString("pt-BR")}. Aguarde confirmação do motorista.`,
          });
          setLocation(`/passenger/scheduled`);
        } else {
          setLocation(`/passenger/ride/${ride.id}`);
        }
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? "Erro ao solicitar corrida";
        toast({ title: msg, variant: "destructive" });
      },
    });
  };

  return (
    <>
      {/* Map — full screen on desktop, above BottomNav on mobile */}
      <div className="fixed top-20 bottom-16 md:bottom-0 left-0 right-0 md:left-96 z-0">
        <MapView
          origin={origin}
          destination={destination}
          routePoints={routePoints}
          onMapClick={handleMapClick}
          onOriginDragEnd={origin ? handleOriginDragEnd : undefined}
          onDestinationDragEnd={destination ? handleDestDragEnd : undefined}
          passengerPhotoUrl={user?.avatarUrl ?? null}
          passengerLabel={user?.name ? user.name.split(" ").slice(0, 2).join(" ") : "Você"}
          className="h-full w-full"
        />
      </div>

      {/* Form — sidebar on desktop, collapsible bottom sheet on mobile */}
      <div
        className={`fixed bottom-16 left-0 right-0 md:bottom-0 md:top-20 md:right-auto md:w-96
          bg-card border-t md:border-t-0 md:border-r border-border rounded-t-2xl md:rounded-none
          shadow-2xl md:shadow-xl z-[1000] overflow-hidden
          transition-[max-height] duration-300 ease-in-out
          md:!max-h-none md:overflow-visible
          ${sheetExpanded ? 'max-h-[80vh]' : 'max-h-[160px]'}`}
      >
        <div className="p-3 md:h-[calc(100dvh-80px)] md:overflow-y-auto space-y-2 pb-3 md:pb-6 overflow-y-auto" style={{ maxHeight: 'inherit' }}>
          {/* Drag handle — mobile only, click to expand/collapse */}
          <button
            onClick={() => setSheetExpanded(v => !v)}
            className="w-full flex flex-col items-center gap-1 md:hidden pb-1 focus:outline-none"
            aria-label={sheetExpanded ? "Recolher painel" : "Expandir painel"}
          >
            <div className="w-10 h-1 bg-muted rounded-full" />
            <ChevronUp className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-300 ${sheetExpanded ? 'rotate-180' : ''}`} />
          </button>

          {/* Mode toggle: Agora / Agendar */}
          <div className="flex items-center gap-2">
            <div className="flex bg-secondary rounded-xl p-1 gap-1 flex-1">
              <button
                onClick={() => setIsScheduling(false)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  !isScheduling
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                Agora
              </button>
              <button
                onClick={() => setIsScheduling(true)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  isScheduling
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Agendar
              </button>
            </div>
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
                  onFocus={() => { setActiveField("origin"); setSheetExpanded(true); }}
                  onChange={(e) => {
                    setOriginQuery(e.target.value);
                    setOrigin(null);
                    searchAddress(e.target.value, "origin");
                  }}
                  className="border-none bg-transparent p-0 h-auto text-sm focus-visible:ring-0 disabled:opacity-60 disabled:cursor-wait"
                />
                {isLocating && <Loader2 className="w-3.5 h-3.5 text-primary shrink-0 animate-spin" />}
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
            {origin && (
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
            )}
            {/* Drag-pin feedback for origin */}
            {origin && originDragState && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium animate-in fade-in duration-200 ${
                originDragState === "loading" ? "bg-secondary text-muted-foreground" :
                originDragState === "ok" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                originDragState === "warning" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" :
                "bg-destructive/10 text-destructive border border-destructive/20"
              }`}>
                {originDragState === "loading" ? <Loader2 className="w-3 h-3 animate-spin shrink-0" /> :
                 originDragState === "ok" ? <CheckCircle className="w-3 h-3 shrink-0" /> :
                 <AlertCircle className="w-3 h-3 shrink-0" />}
                {originDragState === "loading" ? "Verificando rua..." : originDragMsg}
              </div>
            )}
          </div>

          {/* Map pin mode selector */}
          {/* Tap-on-map hint — compact single line, only before addresses are set */}
          {(!origin || !destination) && (
            <p className="text-[10px] text-muted-foreground/60 text-center">
              Toque no mapa para marcar o ponto de {!origin ? "embarque" : "destino"}
            </p>
          )}
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
                  onFocus={() => { setActiveField("destination"); setSheetExpanded(true); }}
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
            {destination && (
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
            )}
            {/* Drag-pin feedback for destination */}
            {destination && destDragState && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium animate-in fade-in duration-200 ${
                destDragState === "loading" ? "bg-secondary text-muted-foreground" :
                destDragState === "ok" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                destDragState === "warning" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" :
                "bg-destructive/10 text-destructive border border-destructive/20"
              }`}>
                {destDragState === "loading" ? <Loader2 className="w-3 h-3 animate-spin shrink-0" /> :
                 destDragState === "ok" ? <CheckCircle className="w-3 h-3 shrink-0" /> :
                 <AlertCircle className="w-3 h-3 shrink-0" />}
                {destDragState === "loading" ? "Verificando rua..." : destDragMsg}
              </div>
            )}
          </div>

          {/* ── Scheduling Panel ──────────────────────────────────────────── */}
          {isScheduling && (
            <div className="space-y-3 border border-primary/20 bg-primary/5 rounded-xl p-3">
              {/* Date/time */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Data e Horário
                </label>
                <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2.5 border border-border focus-within:border-primary transition-colors">
                  <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    min={getMinDatetimeLocal()}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none text-foreground [color-scheme:dark]"
                  />
                </div>
                {/* Availability badge */}
                {scheduledFor && (
                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                    availabilityLoading
                      ? "bg-secondary text-muted-foreground"
                      : availability?.driverCount === 0
                        ? "bg-destructive/10 text-destructive border border-destructive/20"
                        : availability
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : "bg-secondary text-muted-foreground"
                  }`}>
                    {availabilityLoading ? (
                      <><Loader2 className="w-3 h-3 animate-spin" />Verificando disponibilidade...</>
                    ) : availability?.driverCount === 0 ? (
                      <><AlertCircle className="w-3 h-3" />Nenhum motorista disponível nesse horário</>
                    ) : availability ? (
                      <><CheckCircle className="w-3 h-3" />{availability.driverCount} de {availability.totalDrivers} motorista{availability.totalDrivers !== 1 ? "s" : ""} disponível{availability.driverCount !== 1 ? "is" : ""}</>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Scheduling type */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Radio className="w-3 h-3" /> Tipo de Agendamento
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSchedulingType("public"); setSelectedDriver(null); setDirectedToDriverId(null); setDriverSearch(""); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      schedulingType === "public"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Pública
                  </button>
                  <button
                    onClick={() => setSchedulingType("directed")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      schedulingType === "directed"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    <User2 className="w-3.5 h-3.5" />
                    Direcionada
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {schedulingType === "public"
                    ? "Qualquer motorista aprovado pode aceitar"
                    : "Escolha um motorista específico para a corrida"}
                </p>
              </div>

              {/* Driver search (directed only) */}
              {schedulingType === "directed" && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <User2 className="w-3 h-3" /> Motorista
                  </label>
                  {selectedDriver ? (
                    <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <User2 className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{selectedDriver.name}</div>
                        {selectedDriver.vehicleModel && (
                          <div className="text-xs text-muted-foreground truncate">
                            {selectedDriver.vehicleModel} {selectedDriver.vehiclePlate ? `· ${selectedDriver.vehiclePlate}` : ""}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => { setSelectedDriver(null); setDirectedToDriverId(null); setDriverSearch(""); setDriverOptions([]); }}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      >
                        Trocar
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2.5 border border-border focus-within:border-primary transition-colors">
                        <User2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <Input
                          placeholder="Buscar motorista por nome ou placa..."
                          value={driverSearch}
                          onChange={(e) => {
                            setDriverSearch(e.target.value);
                            searchDrivers(e.target.value);
                          }}
                          className="border-none bg-transparent p-0 h-auto text-sm focus-visible:ring-0"
                        />
                        {driverSearchLoading && <Loader2 className="w-3.5 h-3.5 text-muted-foreground shrink-0 animate-spin" />}
                      </div>
                      {driverOptions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                          {driverOptions.map((d) => (
                            <button
                              key={d.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setSelectedDriver(d);
                                setDirectedToDriverId(d.id);
                                setDriverSearch(d.name);
                                setDriverOptions([]);
                              }}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-secondary transition-colors border-b border-border last:border-0"
                            >
                              <div className="font-medium">{d.name}</div>
                              {d.vehicleModel && (
                                <div className="text-xs text-muted-foreground">
                                  {d.vehicleModel} {d.vehiclePlate ? `· ${d.vehiclePlate}` : ""}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Optional note */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <FileText className="w-3 h-3" /> Observação (opcional)
                </label>
                <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2.5 border border-border focus-within:border-primary transition-colors">
                  <Input
                    placeholder="Ex: Voo às 14h, bagagem grande..."
                    value={scheduledNote}
                    onChange={(e) => setScheduledNote(e.target.value)}
                    className="border-none bg-transparent p-0 h-auto text-sm focus-visible:ring-0"
                  />
                </div>
              </div>
            </div>
          )}

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

          {/* Price + submit — only when both points are set */}
          {origin && destination && (
            <>
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
                disabled={
                  !offeredPrice || createRide.isPending || isCalculating ||
                  (isScheduling && availability?.driverCount === 0 && !availabilityLoading)
                }
                className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl"
              >
                {createRide.isPending
                  ? (isScheduling ? "Agendando..." : "Solicitando...")
                  : (isScheduling ? "Agendar Corrida" : "Solicitar Corrida")}
                {!createRide.isPending && <ChevronRight className="ml-1 w-4 h-4" />}
              </Button>
            </>
          )}

        </div>
      </div>
    </>
  );
}
