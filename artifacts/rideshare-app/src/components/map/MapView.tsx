import { useEffect, useRef, memo, useState, useCallback } from 'react';
import L from 'leaflet';

interface MapViewProps {
  origin?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
  driverPosition?: { lat: number; lng: number } | null;
  passengerPhotoUrl?: string | null;
  driverPhotoUrl?: string | null;
  passengerLabel?: string;
  driverLabel?: string;
  routePoints?: [number, number][];
  waypoints?: { lat: number; lng: number }[];
  onMapClick?: (lat: number, lng: number) => void;
  onOriginDragEnd?: (lat: number, lng: number) => void;
  onDestinationDragEnd?: (lat: number, lng: number) => void;
  className?: string;
}

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function makePhotoIcon(photoUrl: string, borderColor: string, label?: string, draggable?: boolean) {
  const labelHtml = label
    ? `<div style="
        position:absolute;top:46px;left:50%;transform:translateX(-50%);
        background:rgba(0,0,0,0.75);color:#fff;font-size:10px;font-weight:600;
        white-space:nowrap;padding:2px 6px;border-radius:6px;
        border:1px solid ${borderColor};backdrop-filter:blur(4px);
        max-width:90px;overflow:hidden;text-overflow:ellipsis;
      ">${label}</div>`
    : '';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:42px;">
      <div style="
        width:42px;height:42px;border-radius:50%;overflow:hidden;
        border:3px solid ${borderColor};
        box-shadow:0 2px 8px rgba(0,0,0,0.5);
        background:#1a1a1a;
        cursor:${draggable ? 'grab' : 'default'};
      ">
        <img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover" />
      </div>
      ${labelHtml}
    </div>`,
    iconSize: [42, label ? 64 : 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -24],
  });
}

function makeFallbackIcon(color: string, svgPath: string, label?: string, draggable?: boolean) {
  const labelHtml = label
    ? `<div style="
        position:absolute;top:46px;left:50%;transform:translateX(-50%);
        background:rgba(0,0,0,0.75);color:#fff;font-size:10px;font-weight:600;
        white-space:nowrap;padding:2px 6px;border-radius:6px;
        border:1px solid ${color};backdrop-filter:blur(4px);
        max-width:90px;overflow:hidden;text-overflow:ellipsis;
      ">${label}</div>`
    : '';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:42px;">
      <div style="
        width:42px;height:42px;border-radius:50%;
        border:3px solid ${color};
        box-shadow:0 2px 8px rgba(0,0,0,0.5);
        background:#1a1a1a;
        display:flex;align-items:center;justify-content:center;
        cursor:${draggable ? 'grab' : 'default'};
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${svgPath}
        </svg>
      </div>
      ${labelHtml}
    </div>`,
    iconSize: [42, label ? 64 : 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -24],
  });
}

const destinationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const PERSON_PATH = `<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>`;
const CAR_PATH = `<rect x="2" y="9" width="20" height="9" rx="2"/><path d="M16 9V7a4 4 0 0 0-8 0v2"/><circle cx="7" cy="18" r="1"/><circle cx="17" cy="18" r="1"/>`;

// ── Bearing helper (true geographic bearing, 0-360°) ───────────────────────
function calcBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLon = toRad(lon2 - lon1);
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const y = Math.sin(dLon) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function bearingLabel(b: number): string {
  const dirs = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(b / 45) % 8];
}

// ── Compass ────────────────────────────────────────────────────────────────
interface MapCompassProps { mouseHeading?: number | null; }

function MapCompass({ mouseHeading = null }: MapCompassProps) {
  const [devHeading, setDevHeading] = useState<number>(0);
  const [devActive, setDevActive] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 768
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const startListening = useCallback(() => {
    const handler = (e: DeviceOrientationEvent) => {
      const webkit = (e as any).webkitCompassHeading;
      if (webkit != null) { setDevHeading(webkit); setDevActive(true); }
      else if (e.alpha != null) { setDevHeading(360 - e.alpha); setDevActive(true); }
    };
    window.addEventListener('deviceorientation', handler, true);
    return () => window.removeEventListener('deviceorientation', handler, true);
  }, []);

  useEffect(() => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      setNeedsPermission(true);
    } else if ('DeviceOrientationEvent' in window) {
      return startListening();
    }
  }, [startListening]);

  const requestPermission = useCallback(async () => {
    try {
      const res = await (DeviceOrientationEvent as any).requestPermission();
      if (res === 'granted') { setNeedsPermission(false); startListening(); }
    } catch {}
  }, [startListening]);

  // Desktop: use mouse bearing when available; Mobile: use device orientation
  const usingMouse = isDesktop && mouseHeading !== null;
  const bearing    = usingMouse ? mouseHeading! : devHeading;
  // Mouse mode: needle points toward cursor direction (rotation = bearing)
  // Device mode: compass rotates so N stays pointing to magnetic North (rotation = -heading)
  const svgRotation = usingMouse ? bearing : -devHeading;

  const size    = isDesktop ? 54 : 40;
  const svgSize = isDesktop ? 38 : 28;
  const posStyle: React.CSSProperties = isDesktop
    ? { position: 'absolute', bottom: '19px', right: '50px', zIndex: 1000 }
    : { position: 'absolute', bottom: '90px', right: '10px', zIndex: 1000 };

  const titleTip = needsPermission
    ? 'Toque para ativar a bússola'
    : usingMouse
      ? `${Math.round(bearing)}° ${bearingLabel(bearing)}`
      : devActive ? `${Math.round(devHeading)}° Norte` : 'Bússola';

  // Font that matches the bold condensed logo style
  const displayFont = "'Inter', 'SF Pro Display', 'Helvetica Neue', system-ui, sans-serif";

  return (
    // Outer wrapper: positions the whole group (label + circle)
    <div
      style={{
        ...posStyle,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '5px',
        width: 'max-content',
      }}
    >
      {/* Direction label — above the compass, outside the circle */}
      <div
        style={{
          minHeight: '18px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1px',
          opacity: usingMouse ? 1 : 0,
          transition: 'opacity 0.2s ease',
          pointerEvents: 'none',
        }}
      >
        <div style={{
          fontSize: '15px',
          fontWeight: 900,
          fontFamily: displayFont,
          color: '#ef4444',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          lineHeight: 1,
          textShadow: '0 1px 6px rgba(0,0,0,0.9), 0 0 12px rgba(239,68,68,0.4)',
        }}>
          {bearingLabel(bearing)}
        </div>
        <div style={{
          fontSize: '9px',
          fontWeight: 700,
          fontFamily: displayFont,
          color: 'rgba(255,255,255,0.55)',
          letterSpacing: '0.08em',
          lineHeight: 1,
          textShadow: '0 1px 3px rgba(0,0,0,0.9)',
        }}>
          {Math.round(bearing)}°
        </div>
      </div>

      {/* Compass circle */}
      <div
        onClick={needsPermission ? requestPermission : undefined}
        title={titleTip}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          background: usingMouse ? 'rgba(10,10,18,0.90)' : 'rgba(15,15,20,0.82)',
          border: `1.5px solid ${usingMouse ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.18)'}`,
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: needsPermission ? 'pointer' : 'default',
          boxShadow: `0 2px 8px rgba(0,0,0,0.5)${usingMouse ? ', 0 0 12px rgba(239,68,68,0.2)' : ''}`,
          transition: 'border-color 0.2s, box-shadow 0.2s',
          flexShrink: 0,
        }}
      >
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 28 28"
          style={{ transform: `rotate(${svgRotation}deg)`, transition: 'transform 0.08s linear' }}
        >
          {[0,45,90,135,180,225,270,315].map((deg) => (
            <line
              key={deg}
              x1="14" y1="3.5" x2="14" y2={deg % 90 === 0 ? '5.5' : '5'}
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={deg % 90 === 0 ? '1.5' : '1'}
              transform={`rotate(${deg} 14 14)`}
            />
          ))}
          <polygon points="14,4 11.5,14 14,12.5 16.5,14" fill="#ef4444" />
          <polygon points="14,24 11.5,14 14,15.5 16.5,14" fill="rgba(255,255,255,0.55)" />
          <circle cx="14" cy="14" r="2" fill="rgba(255,255,255,0.9)" />
          {/* Static N label when not in mouse mode */}
          {!usingMouse && (
            <text x="14" y="10" textAnchor="middle" fontSize="4" fontWeight="bold" fill="#ef4444" fontFamily="sans-serif">N</text>
          )}
        </svg>
      </div>
    </div>
  );
}

function makeStopIcon(index: number) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:30px;height:30px;border-radius:50%;
      background:#f59e0b;border:3px solid #fbbf24;
      display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:800;color:#000;
      box-shadow:0 2px 8px rgba(0,0,0,0.5);
    ">${index + 1}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

function MapView({
  origin, destination, driverPosition,
  passengerPhotoUrl, driverPhotoUrl,
  passengerLabel, driverLabel,
  routePoints, waypoints,
  onMapClick,
  onOriginDragEnd, onDestinationDragEnd,
  className = "h-full w-full"
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<{ origin?: L.Marker; destination?: L.Marker; driver?: L.Marker }>({});
  const stopMarkersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const draggingRef = useRef<{ origin: boolean; destination: boolean }>({ origin: false, destination: false });
  const [mouseHeading, setMouseHeading] = useState<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const point = L.point(e.clientX - rect.left, e.clientY - rect.top);
    const cursor = map.containerPointToLatLng(point);
    const center = map.getCenter();
    // Only update if cursor is meaningfully away from center (avoid jitter at dead center)
    const dist = Math.hypot(cursor.lat - center.lat, cursor.lng - center.lng);
    if (dist < 1e-8) return;
    setMouseHeading(calcBearing(center.lat, center.lng, cursor.lat, cursor.lng));
  }, []);

  const handleMouseLeave = useCallback(() => setMouseHeading(null), []);

  // Keep callbacks in refs so effects never need to re-run when they change
  const onMapClickRef = useRef(onMapClick);
  const onOriginDragEndRef = useRef(onOriginDragEnd);
  const onDestDragEndRef = useRef(onDestinationDragEnd);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { onOriginDragEndRef.current = onOriginDragEnd; }, [onOriginDragEnd]);
  useEffect(() => { onDestDragEndRef.current = onDestinationDragEnd; }, [onDestinationDragEnd]);

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, { zoomControl: false }).setView([-23.5505, -46.6333], 13);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd', maxZoom: 20
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
    });

    mapInstance.current = map;
    setTimeout(() => map.invalidateSize(), 100);

    // Recalculate map size whenever the container resizes (e.g. bottom sheet expand/collapse)
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(mapRef.current);

    return () => {
      ro.disconnect();
      try { Object.values(markersRef.current).forEach(m => m?.remove()); } catch {}
      markersRef.current = {};
      try { polylineRef.current?.remove(); } catch {}
      polylineRef.current = null;
      try { map.remove(); } catch {}
      mapInstance.current = null;
    };
  }, []);

  // Origin (passenger) marker
  useEffect(() => {
    if (!mapInstance.current) return;
    if (!origin) {
      if (markersRef.current.origin) {
        try { mapInstance.current.removeLayer(markersRef.current.origin); } catch {}
        delete markersRef.current.origin;
      }
      return;
    }

    const isDraggable = !!onOriginDragEndRef.current;
    const icon = passengerPhotoUrl
      ? makePhotoIcon(passengerPhotoUrl, '#22c55e', passengerLabel, isDraggable)
      : makeFallbackIcon('#22c55e', PERSON_PATH, passengerLabel, isDraggable);

    if (markersRef.current.origin) {
      // Only snap position if not currently being dragged by user
      if (!draggingRef.current.origin) {
        markersRef.current.origin.setLatLng([origin.lat, origin.lng]);
      }
      markersRef.current.origin.setIcon(icon);
    } else {
      const marker = L.marker([origin.lat, origin.lng], { icon, draggable: isDraggable })
        .addTo(mapInstance.current);

      if (isDraggable) {
        marker.on('dragstart', () => { draggingRef.current.origin = true; });
        marker.on('dragend', () => {
          draggingRef.current.origin = false;
          const { lat, lng } = marker.getLatLng();
          onOriginDragEndRef.current?.(lat, lng);
        });
      }

      markersRef.current.origin = marker;
    }
  }, [origin, passengerPhotoUrl, passengerLabel]);

  // Destination marker
  useEffect(() => {
    if (!mapInstance.current) return;
    if (!destination) {
      if (markersRef.current.destination) {
        try { mapInstance.current.removeLayer(markersRef.current.destination); } catch {}
        delete markersRef.current.destination;
      }
      return;
    }

    const isDraggable = !!onDestDragEndRef.current;

    if (markersRef.current.destination) {
      if (!draggingRef.current.destination) {
        markersRef.current.destination.setLatLng([destination.lat, destination.lng]);
      }
    } else {
      const marker = L.marker([destination.lat, destination.lng], {
        icon: destinationIcon,
        draggable: isDraggable,
      }).bindPopup('Destino').addTo(mapInstance.current);

      if (isDraggable) {
        marker.on('dragstart', () => { draggingRef.current.destination = true; });
        marker.on('dragend', () => {
          draggingRef.current.destination = false;
          const { lat, lng } = marker.getLatLng();
          onDestDragEndRef.current?.(lat, lng);
        });
      }

      markersRef.current.destination = marker;
    }
  }, [destination]);

  // Fit bounds when points change
  useEffect(() => {
    if (!mapInstance.current) return;
    const points = [origin, destination, driverPosition].filter(Boolean) as { lat: number; lng: number }[];
    if (points.length >= 2) {
      mapInstance.current.fitBounds(
        L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number])),
        { padding: [60, 60] }
      );
    } else if (points.length === 1) {
      mapInstance.current.setView([points[0].lat, points[0].lng], 15);
    }
  }, [origin, destination, driverPosition]);

  // Driver position marker
  useEffect(() => {
    if (!mapInstance.current) return;
    if (!driverPosition) {
      if (markersRef.current.driver) {
        try { mapInstance.current.removeLayer(markersRef.current.driver); } catch {}
        delete markersRef.current.driver;
      }
      return;
    }
    const icon = driverPhotoUrl
      ? makePhotoIcon(driverPhotoUrl, '#3b82f6', driverLabel)
      : makeFallbackIcon('#3b82f6', CAR_PATH, driverLabel);

    if (markersRef.current.driver) {
      markersRef.current.driver.setLatLng([driverPosition.lat, driverPosition.lng]);
      markersRef.current.driver.setIcon(icon);
    } else {
      markersRef.current.driver = L.marker([driverPosition.lat, driverPosition.lng], { icon })
        .addTo(mapInstance.current!);
    }
  }, [driverPosition, driverPhotoUrl, driverLabel]);

  // Stop / waypoint markers
  useEffect(() => {
    if (!mapInstance.current) return;
    stopMarkersRef.current.forEach(m => { try { mapInstance.current!.removeLayer(m); } catch {} });
    stopMarkersRef.current = [];
    if (waypoints && waypoints.length > 0) {
      waypoints.forEach((wp, idx) => {
        const marker = L.marker([wp.lat, wp.lng], { icon: makeStopIcon(idx) })
          .bindTooltip(`Parada ${idx + 1}`, { permanent: false, direction: 'top' })
          .addTo(mapInstance.current!);
        stopMarkersRef.current.push(marker);
      });
    }
  }, [waypoints]);

  // Polyline
  useEffect(() => {
    if (!mapInstance.current) return;
    if (polylineRef.current) {
      try { mapInstance.current.removeLayer(polylineRef.current); } catch {}
      polylineRef.current = null;
    }
    if (routePoints && routePoints.length > 1) {
      polylineRef.current = L.polyline(routePoints, {
        color: '#22c55e', weight: 4, opacity: 0.85, lineCap: 'round', lineJoin: 'round',
      }).addTo(mapInstance.current);
    }
  }, [routePoints]);

  return (
    <div
      className={`${className} relative`}
      style={{ isolation: 'isolate' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div ref={mapRef} className="h-full w-full" />
      <MapCompass mouseHeading={mouseHeading} />
    </div>
  );
}

export default memo(MapView);
