import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface MapViewProps {
  origin?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
  driverPosition?: { lat: number; lng: number } | null;
  passengerPhotoUrl?: string | null;
  driverPhotoUrl?: string | null;
  routePoints?: [number, number][];
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
}

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const originIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const destinationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const driverFallbackIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

function makePhotoIcon(photoUrl: string, borderColor: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:42px;height:42px;border-radius:50%;overflow:hidden;
      border:3px solid ${borderColor};
      box-shadow:0 2px 8px rgba(0,0,0,0.5);
      background:#1a1a1a;
    ">
      <img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover" />
    </div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -24],
  });
}

export default function MapView({
  origin, destination, driverPosition,
  passengerPhotoUrl, driverPhotoUrl,
  routePoints, onMapClick,
  className = "h-full w-full"
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<{ origin?: L.Marker; destination?: L.Marker; driver?: L.Marker }>({});
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    mapInstance.current = L.map(mapRef.current, { zoomControl: true }).setView([-23.5505, -46.6333], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd', maxZoom: 20
    }).addTo(mapInstance.current);
    if (onMapClick) {
      mapInstance.current.on('click', (e: L.LeafletMouseEvent) => onMapClick(e.latlng.lat, e.latlng.lng));
    }
    setTimeout(() => mapInstance.current?.invalidateSize(), 100);
  }, [onMapClick]);

  // Origin (passenger) marker
  useEffect(() => {
    if (!mapInstance.current) return;

    if (!origin) {
      if (markersRef.current.origin) {
        mapInstance.current.removeLayer(markersRef.current.origin);
        delete markersRef.current.origin;
      }
      return;
    }

    const icon = passengerPhotoUrl ? makePhotoIcon(passengerPhotoUrl, '#22c55e') : originIcon;

    if (markersRef.current.origin) {
      markersRef.current.origin.setLatLng([origin.lat, origin.lng]);
      markersRef.current.origin.setIcon(icon);
    } else {
      markersRef.current.origin = L.marker([origin.lat, origin.lng], { icon })
        .bindPopup('Passageiro').addTo(mapInstance.current);
    }
  }, [origin, passengerPhotoUrl]);

  // Destination marker
  useEffect(() => {
    if (!mapInstance.current) return;

    if (!destination) {
      if (markersRef.current.destination) {
        mapInstance.current.removeLayer(markersRef.current.destination);
        delete markersRef.current.destination;
      }
      return;
    }

    if (markersRef.current.destination) {
      markersRef.current.destination.setLatLng([destination.lat, destination.lng]);
    } else {
      markersRef.current.destination = L.marker([destination.lat, destination.lng], { icon: destinationIcon })
        .bindPopup('Destino').addTo(mapInstance.current);
    }
  }, [destination]);

  // Fit bounds
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
        mapInstance.current.removeLayer(markersRef.current.driver);
        delete markersRef.current.driver;
      }
      return;
    }

    const icon = driverPhotoUrl ? makePhotoIcon(driverPhotoUrl, '#3b82f6') : driverFallbackIcon;

    if (markersRef.current.driver) {
      markersRef.current.driver.setLatLng([driverPosition.lat, driverPosition.lng]);
      markersRef.current.driver.setIcon(icon);
    } else {
      markersRef.current.driver = L.marker([driverPosition.lat, driverPosition.lng], { icon })
        .bindPopup('Motorista').addTo(mapInstance.current!);
    }
  }, [driverPosition, driverPhotoUrl]);

  // Polyline
  useEffect(() => {
    if (!mapInstance.current) return;
    if (polylineRef.current) { mapInstance.current.removeLayer(polylineRef.current); polylineRef.current = null; }
    if (routePoints && routePoints.length > 1) {
      polylineRef.current = L.polyline(routePoints, {
        color: '#22c55e', weight: 4, opacity: 0.85, lineCap: 'round', lineJoin: 'round',
      }).addTo(mapInstance.current);
    }
  }, [routePoints]);

  return <div ref={mapRef} className={className} />;
}
