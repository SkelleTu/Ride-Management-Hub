import { useEffect, useRef, memo } from 'react';
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

function MapView({
  origin, destination, driverPosition,
  passengerPhotoUrl, driverPhotoUrl,
  passengerLabel, driverLabel,
  routePoints, onMapClick,
  onOriginDragEnd, onDestinationDragEnd,
  className = "h-full w-full"
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<{ origin?: L.Marker; destination?: L.Marker; driver?: L.Marker }>({});
  const polylineRef = useRef<L.Polyline | null>(null);
  const draggingRef = useRef<{ origin: boolean; destination: boolean }>({ origin: false, destination: false });

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

    return () => {
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

  return <div ref={mapRef} className={className} />;
}

export default memo(MapView);
