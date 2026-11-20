'use client';

import { useEffect, useRef } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';

// Update lat/lng to your exact workshop/branch coordinates
const DEFAULT_LAT = 9.03;
const DEFAULT_LNG = 38.74;

export default function LocationMap({
  title = 'Grum Stove & Manufacturing',
  address = 'Addis Ababa, Ethiopia',
  lat = DEFAULT_LAT,
  lng = DEFAULT_LNG,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      if (!isMounted || !mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 15,
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const markerIcon = L.divIcon({
        className: 'custom-pin',
        html: `<div style="width:28px;height:28px;border-radius:9999px;background:#b45309;border:3px solid #ffffff;box-shadow:0 4px 10px rgba(0,0,0,0.25);"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker([lat, lng], { icon: markerIcon })
        .addTo(map)
        .bindPopup(`<strong>${title}</strong><br/>${address}`)
        .openPopup();

      mapInstanceRef.current = map;
    })();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng, title, address]);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-stone-200/90 bg-stone-100 h-72 shadow-xs">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      <div className="absolute bottom-3 right-3 z-[400]">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900/90 hover:bg-amber-800 text-white text-xs font-semibold shadow-md backdrop-blur-xs transition"
        >
          <MapPin size={14} className="text-amber-300" />
          Google Maps ክፈት
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}