import { useEffect, useRef } from "react";
import { MapPin, Info, Calculator } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { PriceEstimator } from "@/components/pricing/PriceEstimator";

const PRACA = { lat: -22.3584, lng: -47.3814 };

function updateOverlay(map: any, L: any, svg: SVGSVGElement) {
  const size = map.getSize();
  svg.setAttribute("width", String(size.x));
  svg.setAttribute("height", String(size.y));

  const center = map.latLngToContainerPoint((L as any).latLng(PRACA.lat, PRACA.lng));
  const edgePt  = map.latLngToContainerPoint((L as any).latLng(PRACA.lat - 0.045, PRACA.lng));
  const radius  = Math.abs(center.y - edgePt.y);

  svg.innerHTML = `
    <defs>
      <radialGradient id="pg" cx="${center.x.toFixed(1)}" cy="${center.y.toFixed(1)}"
        r="${radius.toFixed(1)}" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stop-color="#22c55e" stop-opacity="0.38"/>
        <stop offset="18%"  stop-color="#6ec832" stop-opacity="0.32"/>
        <stop offset="36%"  stop-color="#eab308" stop-opacity="0.28"/>
        <stop offset="58%"  stop-color="#f97316" stop-opacity="0.24"/>
        <stop offset="80%"  stop-color="#ef4444" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#ef4444" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="${center.x.toFixed(1)}" cy="${center.y.toFixed(1)}" r="${radius.toFixed(1)}"
      fill="url(#pg)"/>
  `;
}

export default function PassengerPrices() {
  const mapRef  = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const rafRef  = useRef<number>(0);

  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;

    import("leaflet").then((L) => {
      const map = (L as any).map(mapRef.current!, {
        center: [PRACA.lat, PRACA.lng],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false,
      });

      (L as any).tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { maxZoom: 19 }
      ).addTo(map);

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGSVGElement;
      svg.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:450;overflow:visible;";
      map.getContainer().appendChild(svg);

      const schedule = () => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => updateOverlay(map, L, svg));
      };

      map.on("move zoom viewreset resize", schedule);
      map.whenReady(() => updateOverlay(map, L, svg));

      const pracaIcon = (L as any).divIcon({
        className: "",
        html: `<div style="width:12px;height:12px;border-radius:50%;background:#22c55e;border:2px solid #fff;box-shadow:0 0 10px #22c55e;pointer-events:none;"></div>`,
        iconAnchor: [6, 6], iconSize: [12, 12],
      });
      (L as any).marker([PRACA.lat, PRACA.lng], { icon: pracaIcon, interactive: false }).addTo(map);

      const labels = [
        { lat: -22.358, lng: -47.381, label: "Praça / Centro",     price: "R$ 10",  color: "#22c55e" },
        { lat: -22.342, lng: -47.390, label: "Zona Norte",         price: "R$ 12",  color: "#86c840" },
        { lat: -22.374, lng: -47.382, label: "Zona Sul",           price: "R$ 12",  color: "#86c840" },
        { lat: -22.358, lng: -47.358, label: "Zona Leste",         price: "R$ 15",  color: "#eab308" },
        { lat: -22.376, lng: -47.394, label: "Facão",              price: "R$ 15",  color: "#eab308" },
        { lat: -22.324, lng: -47.381, label: "Aeroporto",          price: "R$ 25+", color: "#ef4444" },
        { lat: -22.388, lng: -47.363, label: "Usina São João",     price: "R$ 25+", color: "#ef4444" },
        { lat: -22.388, lng: -47.400, label: "Tenneco Powertrain", price: "R$ 25+", color: "#ef4444" },
      ];

      labels.forEach(({ lat, lng, label, price, color }) => {
        const icon = (L as any).divIcon({
          className: "",
          html: `<div style="text-align:center;pointer-events:none;">
            <div style="font-size:13px;font-weight:800;color:${color};text-shadow:0 0 8px #000,0 1px 3px #000;">${price}</div>
            <div style="font-size:9px;font-weight:600;color:rgba(255,255,255,0.75);text-shadow:0 1px 2px #000;white-space:nowrap;">${label}</div>
          </div>`,
          iconAnchor: [40, 14], iconSize: [80, 28],
        });
        (L as any).marker([lat, lng], { icon, interactive: false }).addTo(map);
      });

      mapInst.current = { map, svg };
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      mapInst.current?.svg?.remove();
      mapInst.current?.map?.remove();
      mapInst.current = null;
    };
  }, []);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border bg-card/80 backdrop-blur z-10">
        <div className="flex items-center gap-2.5">
          <MapPin size={18} className="text-primary" />
          <div>
            <p className="text-sm font-bold text-foreground leading-tight">Mapa de Preços</p>
            <p className="text-xs text-muted-foreground">A partir da Praça Barão de Araras</p>
          </div>
        </div>
      </div>

      {/* Calculadora por endereço */}
      <div className="shrink-0 px-4 pt-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Calculator size={14} className="text-primary" />
          <p className="text-sm font-semibold text-foreground">Calcule o preço da sua corrida</p>
        </div>
        <PriceEstimator />
      </div>

      {/* Map */}
      <div className="shrink-0 relative h-64 mt-4 overflow-hidden">
        <div ref={mapRef} className="w-full h-full" />
      </div>

      {/* Legend */}
      <div className="shrink-0 mx-3 mb-3 mt-2 bg-card/90 backdrop-blur rounded-2xl border border-border px-4 py-3 z-10">
        <div className="flex items-center gap-1.5 mb-2">
          <Info size={11} className="text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">Preço máximo · partida da Praça Barão</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { color: "#22c55e", label: "0–1 km",  price: "R$10"  },
            { color: "#86c840", label: "1–2 km",  price: "R$12"  },
            { color: "#eab308", label: "2–3 km",  price: "R$15"  },
            { color: "#f97316", label: "3–4 km",  price: "R$25"  },
            { color: "#ef4444", label: "4 km+",   price: "R$25+" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color, boxShadow: `0 0 5px ${item.color}` }} />
              <span className="text-[10px] text-muted-foreground">
                <strong className="text-foreground">{item.price}</strong> {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
