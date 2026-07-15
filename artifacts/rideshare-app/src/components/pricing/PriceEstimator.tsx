import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation, Loader2, ArrowRight, Info } from "lucide-react";
import { estimatePassengerPrice, formatBRL, ROUND_STEP } from "@/lib/pricing";

interface GeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface Point {
  address: string;
  lat: number;
  lng: number;
}

async function geocode(query: string): Promise<GeocodeResult[]> {
  try {
    const r = await fetch(`/api/proxy/geocode?q=${encodeURIComponent(query)}`);
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function fetchRouteDistanceKm(origin: Point, destination: Point): Promise<number | null> {
  try {
    const params = new URLSearchParams({
      olng: String(origin.lng), olat: String(origin.lat),
      dlng: String(destination.lng), dlat: String(destination.lat),
    });
    const r = await fetch(`/api/proxy/route?${params}`);
    const data = await r.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;
    return data.routes[0].distance / 1000;
  } catch {
    return null;
  }
}

function AddressField({
  label,
  icon,
  value,
  onSelect,
  placeholder,
  testId,
}: {
  label: string;
  icon: React.ReactNode;
  value: Point | null;
  onSelect: (p: Point | null) => void;
  placeholder: string;
  testId: string;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (value) setQuery(value.address);
  }, [value]);

  const handleChange = (q: string) => {
    setQuery(q);
    if (value) onSelect(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const results = await geocode(q);
      setSuggestions(results);
      setLoading(false);
    }, 400);
  };

  return (
    <div className="relative space-y-1">
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        {icon} {label}
      </label>
      <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2.5 border border-border focus-within:border-primary transition-colors">
        <input
          data-testid={testId}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 border-none bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin shrink-0" />}
      </div>
      {suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect({ address: s.display_name, lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
                setSuggestions([]);
              }}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-secondary transition-colors border-b border-border last:border-0"
            >
              {s.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Calculadora de preço estimado: passageiro (ou visitante) digita endereço de
 * embarque e destino, a plataforma calcula a distância da rota e mostra o
 * preço já arredondado, com a regra de arredondamento explicada.
 */
export function PriceEstimator() {
  const [origin, setOrigin] = useState<Point | null>(null);
  const [destination, setDestination] = useState<Point | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!origin || !destination) {
      setDistanceKm(null);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    fetchRouteDistanceKm(origin, destination).then((km) => {
      setLoading(false);
      if (km === null) setError(true);
      else setDistanceKm(km);
    });
  }, [origin, destination]);

  const estimate = distanceKm !== null ? estimatePassengerPrice(distanceKm) : null;

  return (
    <div className="space-y-3">
      <AddressField
        label="Endereço de embarque"
        icon={<MapPin className="w-3 h-3" />}
        value={origin}
        onSelect={setOrigin}
        placeholder="De onde você vai sair?"
        testId="input-estimator-origin"
      />
      <AddressField
        label="Endereço de destino"
        icon={<Navigation className="w-3 h-3" />}
        value={destination}
        onSelect={setDestination}
        placeholder="Para onde você vai?"
        testId="input-estimator-destination"
      />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
          <Loader2 className="w-4 h-4 animate-spin" /> Calculando rota e preço...
        </div>
      )}

      {error && (
        <div className="text-sm text-yellow-500 px-1">
          Não conseguimos calcular a rota entre esses endereços. Tente selecionar as opções sugeridas.
        </div>
      )}

      {estimate && !loading && !error && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 space-y-3" data-testid="price-estimate-result">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Distância estimada</span>
            <span className="font-semibold">{estimate.distanceKm.toFixed(1)} km</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Preço por km</span>
            <span className="font-semibold">{formatBRL(estimate.pricePerKm)}/km</span>
          </div>
          <div className="flex items-center justify-between text-sm border-t border-primary/20 pt-3">
            <span className="text-muted-foreground">Valor calculado</span>
            <span className={estimate.rawPrice !== estimate.roundedPrice ? "line-through text-muted-foreground" : "font-semibold"}>
              {formatBRL(estimate.rawPrice)}
            </span>
          </div>
          {estimate.rawPrice !== estimate.roundedPrice && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <ArrowRight className="w-3.5 h-3.5" /> Arredondado
              </span>
              <span className="text-2xl font-bold text-primary">{formatBRL(estimate.roundedPrice)}</span>
            </div>
          )}
          {estimate.rawPrice === estimate.roundedPrice && (
            <div className="flex items-center justify-end">
              <span className="text-2xl font-bold text-primary">{formatBRL(estimate.roundedPrice)}</span>
            </div>
          )}
          <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-relaxed pt-1">
            <Info className="w-3 h-3 shrink-0 mt-0.5" />
            Os preços da UPcar sempre arredondam para o múltiplo de R$ {ROUND_STEP} mais próximo
            (ex.: R$17 vira R$15, R$18 vira R$20). O valor final da corrida ainda pode variar
            conforme a negociação entre passageiro e motorista.
          </div>
        </div>
      )}
    </div>
  );
}
