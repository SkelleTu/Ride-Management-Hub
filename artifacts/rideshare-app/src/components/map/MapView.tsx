import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface MapViewProps {
  origin?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
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

export default function MapView({ origin, destination, routePoints, onMapClick, className = "h-full w-full" }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<{ origin?: L.Marker; destination?: L.Marker }>({});
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    mapInstance.current = L.map(mapRef.current, { zoomControl: true }).setView([-23.5505, -46.6333], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(mapInstance.current);

    if (onMapClick) {
      mapInstance.current.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    // Force recalculation after paint so Leaflet sees the real pixel dimensions
    setTimeout(() => {
      mapInstance.current?.invalidateSize();
    }, 100);
  }, [onMapClick]);

  useEffect(() => {
    if (!mapInstance.current) return;

    if (!origin && markersRef.current.origin) {
      mapInstance.current.removeLayer(markersRef.current.origin);
      delete markersRef.current.origin;
    }
    if (!destination && markersRef.current.destination) {
      mapInstance.current.removeLayer(markersRef.current.destination);
      delete markersRef.current.destination;
    }

    if (origin) {
      if (markersRef.current.origin) {
        markersRef.current.origin.setLatLng([origin.lat, origin.lng]);
      } else {
        markersRef.current.origin = L.marker([origin.lat, origin.lng], { icon: originIcon }).addTo(mapInstance.current);
      }
    }

    if (destination) {
      if (markersRef.current.destination) {
        markersRef.current.destination.setLatLng([destination.lat, destination.lng]);
      } else {
        markersRef.current.destination = L.marker([destination.lat, destination.lng], { icon: destinationIcon }).addTo(mapInstance.current);
      }
    }

    if (origin && destination) {
      mapInstance.current.fitBounds(
        L.latLngBounds([origin.lat, origin.lng], [destination.lat, destination.lng]),
        { padding: [60, 60] }
      );
    } else if (origin) {
      mapInstance.current.setView([origin.lat, origin.lng], 15);
    } else if (destination) {
      mapInstance.current.setView([destination.lat, destination.lng], 15);
    }
  }, [origin, destination]);

  useEffect(() => {
    if (!mapInstance.current) return;

    if (polylineRef.current) {
      mapInstance.current.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    if (routePoints && routePoints.length > 1) {
      polylineRef.current = L.polyline(routePoints, {
        color: '#22c55e',
        weight: 4,
        opacity: 0.85,
        dashArray: undefined,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(mapInstance.current);
    }
  }, [routePoints]);

  return <div ref={mapRef} className={className} />;
}
