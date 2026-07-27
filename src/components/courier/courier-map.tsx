"use client";

import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

// Faz 16 Adım 1 (S66): varsayılan Leaflet marker ikonu bundler'larda kırık
// asset yoluna bağımlı — bunun yerine bağımlılıksız bir divIcon kullanılır.
const courierIcon = L.divIcon({
  className: "courier-marker",
  html: '<div style="width:14px;height:14px;border-radius:9999px;background:#e8590c;border:2px solid white;box-shadow:0 0 2px rgba(0,0,0,0.5);"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export type CourierMapPoint = { courierId: string; label: string; latitude: number; longitude: number };

export function CourierMap({ points }: { points: CourierMapPoint[] }) {
  if (points.length === 0) return null;
  const center: [number, number] = [points[0].latitude, points[0].longitude];

  return (
    <div className="h-64 w-full overflow-hidden rounded-md border border-border">
      <MapContainer center={center} zoom={13} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {points.map((p) => (
          <Marker key={p.courierId} position={[p.latitude, p.longitude]} icon={courierIcon}>
            <Popup>{p.label}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
