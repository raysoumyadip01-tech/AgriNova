import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CloudSun, LocateFixed, Map as MapIcon, Navigation, Route, Truck } from 'lucide-react';
import { api } from '../services/api';
import type { Shipment, WeatherData } from '../types/supplyChain';

interface SupplyChainMapProps {
  shipment: Shipment | null;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function calcProgressPct(s: Shipment): number {
  const total = haversineKm(s.origin_lat, s.origin_lng, s.dest_lat, s.dest_lng);
  if (total <= 0) return s.status === 'Delivered' ? 100 : 15;
  const done = haversineKm(s.origin_lat, s.origin_lng, s.current_lat, s.current_lng);
  if (s.status === 'Delivered') return 100;
  return Math.min(98, Math.max(8, Math.round((done / total) * 100)));
}

export function SupplyChainMap({ shipment }: SupplyChainMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>('');
  const [viewMode, setViewMode] = useState<'street' | 'corridor'>('street');
  const [tileErrors, setTileErrors] = useState(0);

  useEffect(() => {
    if (viewMode !== 'street') {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
      }
      return;
    }

    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [22.75, 88.36],
      zoom: 8,
      zoomControl: true,
    });

    // Use AgriNova same-origin cached tile proxy (ArcGIS / OSM) so no API key or "Access blocked" errors occur
    const tileLayer = L.tileLayer('/api/map-tiles/{z}/{x}/{y}.png?v=2', {
      attribution: '&copy; AgriNova Corridor Maps',
      maxZoom: 18,
    });
    let errors = 0;
    tileLayer.on('tileerror', () => {
      errors += 1;
      setTileErrors(errors);
      if (errors >= 6) {
        // Automatically switch to clean built-in vector corridor view if completely offline
        setViewMode('corridor');
      }
    });
    tileLayer.addTo(map);

    const group = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    layerGroupRef.current = group;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    };
  }, [viewMode]);

  useEffect(() => {
    if (!shipment) return;
    void api
      .getWeather(shipment.current_lat, shipment.current_lng)
      .then((w) => setWeather(w))
      .catch(() => setWeather(null));

    const map = mapInstanceRef.current;
    const group = layerGroupRef.current;
    if (!map || !group || viewMode !== 'street') return;

    group.clearLayers();

    const originPt: [number, number] = [shipment.origin_lat, shipment.origin_lng];
    const destPt: [number, number] = [shipment.dest_lat, shipment.dest_lng];
    const truckPt: [number, number] = [shipment.current_lat, shipment.current_lng];

    // Remaining route dashed, completed route solid
    L.polyline([originPt, truckPt], {
      color: '#16A34A',
      weight: 4,
    }).addTo(group);

    L.polyline([truckPt, destPt], {
      color: '#D97706',
      weight: 3,
      dashArray: '6 6',
    }).addTo(group);

    L.circleMarker(originPt, { radius: 7, color: '#14532D', fillColor: '#16A34A', fillOpacity: 0.95 })
      .bindPopup(`<strong>Farm Origin:</strong> ${shipment.origin}`)
      .addTo(group);

    L.circleMarker(destPt, { radius: 8, color: '#1E293B', fillColor: '#2563EB', fillOpacity: 0.95 })
      .bindPopup(`<strong>Destination Hub:</strong> ${shipment.destination}`)
      .addTo(group);

    const truckIcon = L.divIcon({
      className: 'agrinova-live-truck-marker',
      html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;background:#D97706;color:#fff;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);font-size:16px;">🚛</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker(truckPt, { icon: truckIcon })
      .bindPopup(
        `<strong>${shipment.shipment_code}</strong><br/>Status: ${shipment.status}<br/>Temp: ${shipment.current_temp_c}°C · ${shipment.current_humidity_pct}% RH<br/>GPS: ${shipment.current_lat.toFixed(3)}, ${shipment.current_lng.toFixed(3)}`,
      )
      .addTo(group)
      .openPopup();

    if (userPos) {
      L.circleMarker([userPos.lat, userPos.lng], {
        radius: 6,
        color: '#2563EB',
        fillColor: '#3B82F6',
        fillOpacity: 0.9,
      })
        .bindPopup('Your Current GPS Location')
        .addTo(group);
    }

    const bounds = L.latLngBounds([originPt, destPt, truckPt]);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
  }, [shipment, userPos, viewMode]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Browser GPS unavailable. Showing shipment vehicle coordinates.');
      return;
    }
    setGpsStatus('Requesting GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus(`GPS centered (${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)})`);
      },
      () => {
        setGpsStatus('GPS permission denied. Showing vehicle telemetry coordinates.');
      },
    );
  };

  const distanceKm = shipment
    ? haversineKm(shipment.origin_lat, shipment.origin_lng, shipment.dest_lat, shipment.dest_lng)
    : 0;
  const remainingKm = shipment
    ? haversineKm(shipment.current_lat, shipment.current_lng, shipment.dest_lat, shipment.dest_lng)
    : 0;
  const progressPct = shipment ? calcProgressPct(shipment) : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Navigation className="h-3.5 w-3.5 text-[#16A34A]" />
            <span>
              Distance: <strong className="font-mono tabular-nums">{distanceKm} km</strong> · Left:{' '}
              <strong className="font-mono tabular-nums">{remainingKm} km</strong>
            </span>
          </span>
          {weather && (
            <span className="inline-flex items-center gap-1.5">
              <CloudSun className="h-3.5 w-3.5 text-amber-500" />
              <span>
                Weather:{' '}
                <strong className="font-mono tabular-nums">
                  {weather.temperature_c}°C · {weather.humidity_pct}% RH
                </strong>
              </span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode((m) => (m === 'street' ? 'corridor' : 'street'))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#16A34A] dark:border-slate-700 dark:bg-[#0F172A] dark:text-slate-200"
          >
            {viewMode === 'street' ? <Route className="h-3.5 w-3.5 text-[#16A34A]" /> : <MapIcon className="h-3.5 w-3.5 text-[#16A34A]" />}
            <span>{viewMode === 'street' ? 'Clean Route View' : 'Street Map View'}</span>
          </button>

          <button
            type="button"
            onClick={handleLocateMe}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#16A34A] dark:border-slate-700 dark:bg-[#0F172A] dark:text-slate-200"
          >
            <LocateFixed className="h-3.5 w-3.5 text-[#16A34A]" />
            <span>My GPS Location</span>
          </button>
        </div>
      </div>

      {/* Live Vehicle Progress Readout */}
      {shipment && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs dark:border-slate-700 dark:bg-[#0F172A]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">
              {shipment.origin} → {shipment.destination}
            </span>
            <span className="font-mono text-slate-600 dark:text-slate-300">
              Live Car GPS: {shipment.current_lat.toFixed(4)}, {shipment.current_lng.toFixed(4)} · {progressPct}% · ETA{' '}
              {shipment.eta_hours}h
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-[#16A34A] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {gpsStatus && <p className="text-xs text-slate-500 dark:text-slate-400">{gpsStatus}</p>}

      {viewMode === 'street' ? (
        <div
          ref={mapContainerRef}
          className="h-72 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 z-0"
        />
      ) : (
        <div className="relative h-72 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-[#0F172A]">
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Live Corridor Telemetry View {tileErrors > 0 ? '(Offline Safe Fallback)' : ''}</span>
              {shipment && <span className="font-mono font-semibold">{shipment.transporter_name}</span>}
            </div>

            {shipment ? (
              <svg viewBox="0 0 600 180" className="h-44 w-full" aria-label="Live truck route diagram">
                <defs>
                  <linearGradient id="routeGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#16A34A" />
                    <stop offset="100%" stopColor="#D97706" />
                  </linearGradient>
                </defs>
                {/* Background subtle grid */}
                <line x1="40" y1="90" x2="560" y2="90" stroke="#94a3b8" strokeOpacity="0.25" strokeWidth="1" />
                {/* Full corridor path */}
                <path
                  d="M 70 115 Q 300 40 530 115"
                  fill="none"
                  stroke="#94a3b8"
                  strokeOpacity="0.35"
                  strokeWidth="4"
                  strokeDasharray="6 6"
                />
                {/* Completed progress segment */}
                <path
                  d={`M 70 115 L ${Math.round(70 + (460 * progressPct) / 100)} ${Math.round(
                    115 - Math.sin((progressPct / 100) * Math.PI) * 38,
                  )}`}
                  fill="none"
                  stroke="url(#routeGrad)"
                  strokeWidth="5"
                  strokeLinecap="round"
                />

                {/* Origin Node */}
                <circle cx="70" cy="115" r="10" fill="#14532D" stroke="#fff" strokeWidth="2.5" />
                <text x="70" y="145" textAnchor="middle" fontSize="11" fill="currentColor" fontWeight="600">
                  {shipment.origin.slice(0, 20)}
                </text>

                {/* Destination Node */}
                <circle cx="530" cy="115" r="10" fill="#2563EB" stroke="#fff" strokeWidth="2.5" />
                <text x="530" y="145" textAnchor="middle" fontSize="11" fill="currentColor" fontWeight="600">
                  {shipment.destination.slice(0, 22)}
                </text>

                {/* Live Moving Car / Truck Marker */}
                {(() => {
                  const tx = Math.round(70 + (460 * progressPct) / 100);
                  const ty = Math.round(115 - Math.sin((progressPct / 100) * Math.PI) * 38);
                  return (
                    <g transform={`translate(${tx}, ${ty})`}>
                      <circle cx="0" cy="0" r="16" fill="#D97706" stroke="#fff" strokeWidth="2.5" />
                      <text x="0" y="5" textAnchor="middle" fontSize="14">
                        🚛
                      </text>
                      <text x="0" y="-24" textAnchor="middle" fontSize="11" fill="#D97706" fontWeight="700">
                        {shipment.shipment_code} ({progressPct}%)
                      </text>
                    </g>
                  );
                })()}
              </svg>
            ) : (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
                <Truck className="h-4 w-4" />
                <span>Select a shipment to track its live route.</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Status: <strong>{shipment?.status || '—'}</strong></span>
              <span>Temp: <strong className="font-mono">{shipment?.current_temp_c ?? '--'}°C</strong> · Humidity: <strong className="font-mono">{shipment?.current_humidity_pct ?? '--'}%</strong></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
