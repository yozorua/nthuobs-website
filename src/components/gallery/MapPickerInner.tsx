'use client';
import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// White pin marker — replaces the default blue Leaflet marker
const WHITE_ICON = L.divIcon({
  className: '',
  html: `<svg width="22" height="30" viewBox="0 0 22 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 0C4.925 0 0 4.925 0 11c0 7.5 11 19 11 19S22 18.5 22 11C22 4.925 17.075 0 11 0z"
      fill="#888" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>
    <circle cx="11" cy="11" r="4" fill="rgba(0,0,0,0.2)"/>
  </svg>`,
  iconSize:    [22, 30],
  iconAnchor:  [11, 30],
  popupAnchor: [0, -30],
});

// NTHU Observatory default coordinates
const DEFAULT_LAT = 24.7957;
const DEFAULT_LNG = 120.9961;

function makeTileLayer(theme: string | undefined): L.TileLayer {
  if (theme === 'dark') {
    return L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { attribution: '© OpenStreetMap contributors © CARTO', maxZoom: 19 },
    );
  }
  return L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 },
  );
}

export default function MapPickerInner({
  lat,
  lng,
  onChange,   // undefined → read-only display mode
  height = 260,
}: {
  lat: number | null;
  lng: number | null;
  onChange?: (lat: number, lng: number) => void;
  height?: number;
}) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef      = useRef<L.Map | null>(null);
  const markerRef   = useRef<L.Marker | null>(null);
  const tileRef     = useRef<L.TileLayer | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const readonly = !onChange;

  // Mount map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      attributionControl: false,   // hide the white attribution bar
      dragging:           true,
      zoomControl:        !readonly,  // no zoom buttons on small display map
      scrollWheelZoom:    true,
      touchZoom:          true,
      doubleClickZoom:    !readonly,
      boxZoom:            !readonly,
      keyboard:           !readonly,
    }).setView(
      [lat ?? DEFAULT_LAT, lng ?? DEFAULT_LNG],
      lat !== null ? 8 : 7,
    );

    tileRef.current = makeTileLayer(resolvedTheme).addTo(map);

    if (lat !== null && lng !== null) {
      markerRef.current = L.marker([lat, lng], { icon: WHITE_ICON }).addTo(map);
    }

    if (!readonly) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat: la, lng: lo } = e.latlng;
        onChangeRef.current?.(la, lo);
        if (markerRef.current) {
          markerRef.current.setLatLng([la, lo]);
        } else {
          markerRef.current = L.marker([la, lo], { icon: WHITE_ICON }).addTo(map);
        }
      });
    }

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current  = null;
      markerRef.current = null;
      tileRef.current   = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Invalidate map size when container is resized (e.g. panel drag)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Swap tile layer when theme changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    tileRef.current?.remove();
    tileRef.current = makeTileLayer(resolvedTheme).addTo(map);
  }, [resolvedTheme]);

  // Sync external lat/lng changes (e.g. geolocation) into the live map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lat !== null && lng !== null) {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { icon: WHITE_ICON }).addTo(map);
      }
      map.setView([lat, lng], 8);
    } else {
      markerRef.current?.remove();
      markerRef.current = null;
    }
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      style={{ height: `${height}px`, width: '100%', cursor: readonly ? 'default' : undefined }}
    />
  );
}
