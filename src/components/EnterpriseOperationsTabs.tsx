import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Activity,
  Camera,
  CameraOff,
  Download,
  HeartHandshake,
  MapPin,
  Navigation,
  Package,
  Play,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Square,
  Trash2,
  Truck,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import type { TransporterStrings } from '../i18n/transporterTranslations';
import type {
  FarmerPayment,
  IotReading,
  Product,
  RedistributionItem,
  RiskLevel,
  Shipment,
  SpoilagePrediction,
} from '../types/supplyChain';
import { SupplyChainMap } from './SupplyChainMap';

const SHIPMENT_STATUSES = [
  'Created',
  'Confirmed',
  'Picked Up',
  'In Transit',
  'At Warehouse',
  'Out for Delivery',
  'Delivered',
  'Delayed',
  'Cancelled',
];

function RiskText({ level }: { level: RiskLevel }) {
  const cls =
    level === 'Critical'
      ? 'text-red-600 dark:text-red-400'
      : level === 'High'
        ? 'text-amber-600 dark:text-amber-400'
        : level === 'Medium'
          ? 'text-amber-600 dark:text-amber-300'
          : 'text-[#16A34A] dark:text-[#A3E635]';
  return <span className={`font-semibold ${cls}`}>{level}</span>;
}

export function ProductsInventoryTab({
  products,
  searchQuery,
  onReload,
}: {
  products: Product[];
  searchQuery: string;
  onReload: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Tomato');
  const [quantity, setQuantity] = useState('300');
  const [origin, setOrigin] = useState('Hooghly Farm Hub');
  const [destination, setDestination] = useState('Kolkata Central Market');
  const [temp, setTemp] = useState('14');
  const [hum, setHum] = useState('84');
  const [price, setPrice] = useState('34');
  const [saving, setSaving] = useState(false);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.batch_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createProduct({
        name,
        category,
        quantity: Number(quantity),
        origin,
        destination,
        current_temp_c: Number(temp),
        current_humidity_pct: Number(hum),
        price_per_unit: Number(price),
      });
      showToast('Batch added and evaluated by AI Spoilage Engine.', 'success');
      setName('');
      setShowAdd(false);
      await onReload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create batch.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleWarmStressTest = async (p: Product) => {
    try {
      await api.updateProduct(p.id, { current_temp_c: 32, current_humidity_pct: 86, transport_delay_hours: 4 });
      showToast(`Updated ${p.batch_id} sensor state (32°C, 4h delay) — AI risk recalculated.`, 'warning');
      await onReload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed.', 'error');
    }
  };

  const handleSendToNgo = async (p: Product) => {
    try {
      await api.createRedistribution({
        product_id: p.id,
        mode: 'ngo',
        ngo_name: 'Annapurna Food Rescue (Demo NGO)',
      });
      showToast(`${p.name} listed in Food Redistribution for NGO pickup.`, 'success');
      await onReload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not list for redistribution.', 'error');
    }
  };

  const handleDelete = async (p: Product) => {
    try {
      await api.deleteProduct(p.id);
      showToast(`Deleted ${p.batch_id}`, 'info');
      await onReload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Products &amp; Cold-Chain Inventory
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Create, inspect, stress-test, or route produce batches to NGO food rescue.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16A34A]"
        >
          <Plus className="h-4 w-4" />
          <span>{showAdd ? 'Close Form' : 'Add Product Batch'}</span>
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800 dark:bg-[#1E293B]"
        >
          <div>
            <label className="block text-xs font-medium">Product Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Fresh Red Tomatoes"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
            >
              <option value="Tomato">Tomato</option>
              <option value="Mango">Mango</option>
              <option value="Banana">Banana</option>
              <option value="Potato">Potato</option>
              <option value="Onion">Onion</option>
              <option value="Rice">Rice</option>
              <option value="Wheat">Wheat</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium">Quantity (kg)</label>
            <input
              type="number"
              required
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium">Price (₹/kg)</label>
            <input
              type="number"
              required
              min={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium">Origin</label>
            <input
              type="text"
              required
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium">Destination</label>
            <input
              type="text"
              required
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium">Current Temp (°C)</label>
            <input
              type="number"
              step="0.5"
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium">Humidity (%)</label>
              <input
                type="number"
                value={hum}
                onChange={(e) => setHum(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#16A34A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#1E293B]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="px-4 py-3 font-medium">Batch / Produce</th>
                <th className="px-4 py-3 font-medium text-right">Qty</th>
                <th className="px-4 py-3 font-medium">Conditions</th>
                <th className="px-4 py-3 font-medium">AI Spoilage Risk</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900 dark:text-white">{p.name}</div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {p.batch_id} · {p.origin} → {p.destination}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {p.quantity} {p.unit}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
                    {p.current_temp_c}°C · {p.current_humidity_pct}% RH · {p.transport_delay_hours}h delay
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <RiskText level={p.risk_level} />{' '}
                    <span className="font-mono text-slate-500">({p.risk_score}/100)</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleWarmStressTest(p)}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium hover:border-amber-500 dark:border-slate-700"
                      >
                        Simulate Heat
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSendToNgo(p)}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-[#16A34A] hover:border-[#16A34A] dark:border-slate-700"
                      >
                        NGO Rescue
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(p)}
                        aria-label={`Delete ${p.name}`}
                        className="rounded-md p-1.5 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ShipmentsMapTab({
  shipments,
  products,
  onReload,
  transporterStrings,
}: {
  shipments: Shipment[];
  products: Product[];
  onReload: () => Promise<void>;
  transporterStrings?: TransporterStrings;
}) {
  const { showToast } = useToast();
  const ts = transporterStrings?.shipments;
  const [selected, setSelected] = useState<Shipment | null>(shipments[0] || null);
  const [newProdId, setNewProdId] = useState(products[0]?.id || '');
  const [newDest, setNewDest] = useState('Kolkata Central Market');

  const [updStatus, setUpdStatus] = useState(selected?.status || 'In Transit');
  const [updTemp, setUpdTemp] = useState(String(selected?.current_temp_c ?? 14));
  const [updHum, setUpdHum] = useState(String(selected?.current_humidity_pct ?? 85));
  const [updDelay, setUpdDelay] = useState(String(selected?.delay_hours ?? 0));
  const [updNote, setUpdNote] = useState('');
  const [autoTrack, setAutoTrack] = useState(false);

  useEffect(() => {
    if (!newProdId && products.length > 0) {
      setNewProdId(products[0].id);
    }
  }, [products, newProdId]);

  useEffect(() => {
    if (selected) {
      const fresh = shipments.find((s) => s.id === selected.id);
      if (fresh) {
        setSelected(fresh);
        setUpdStatus(fresh.status);
        setUpdTemp(String(fresh.current_temp_c));
        setUpdHum(String(fresh.current_humidity_pct));
        setUpdDelay(String(fresh.delay_hours));
      }
    } else if (shipments.length > 0) {
      setSelected(shipments[0]);
    }
  }, [shipments, selected]);

  const handleAdvanceCar = async (silent = false) => {
    if (!selected) return;
    try {
      const updated = await api.advanceLiveShipment(selected.id);
      setSelected(updated);
      await onReload();
      if (updated.status === 'Delivered') {
        setAutoTrack(false);
        if (!silent) showToast(`${updated.shipment_code} delivered to ${updated.destination}!`, 'success');
      } else if (!silent) {
        showToast(`Vehicle moved (${updated.current_lat.toFixed(3)}, ${updated.current_lng.toFixed(3)})`, 'info');
      }
    } catch (err) {
      setAutoTrack(false);
      if (!silent) showToast(err instanceof Error ? err.message : 'Unable to move vehicle.', 'error');
    }
  };

  useEffect(() => {
    if (!autoTrack || !selected || selected.status === 'Delivered') return;
    const timer = window.setInterval(() => {
      void handleAdvanceCar(true);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [autoTrack, selected]);

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdId) return;
    try {
      const created = await api.createShipment({ product_id: newProdId, destination: newDest });
      showToast(`Created shipment ${created.shipment_code} -> ${created.destination}`, 'success');
      await onReload();
      setSelected(created);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create shipment.', 'error');
    }
  };

  const handleUpdateShipment = async (advanceGps: boolean) => {
    if (!selected) return;
    try {
      const updated = await api.updateShipment(selected.id, {
        status: updStatus,
        current_temp_c: Number(updTemp),
        current_humidity_pct: Number(updHum),
        delay_hours: Number(updDelay),
        note: updNote || undefined,
        advance_gps: advanceGps,
      });
      showToast(`Shipment ${updated.shipment_code} updated (${updated.status}).`, 'success');
      setUpdNote('');
      await onReload();
      setSelected(updated);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {ts ? ts.title : 'Shipments, Live Map & Weather'}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {ts
              ? ts.subtitle
              : 'Create shipments, advance simulated GPS markers, log temperature/delays, and view live Open-Meteo weather.'}
          </p>
        </div>

        <form onSubmit={handleCreateShipment} className="flex flex-wrap items-center gap-2">
          <select
            value={newProdId}
            onChange={(e) => setNewProdId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#1E293B]"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.batch_id} · {p.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            list="agrinova-dest-hubs"
            value={newDest}
            onChange={(e) => setNewDest(e.target.value)}
            placeholder="Select or type destination hub"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#1E293B]"
          />
          <datalist id="agrinova-dest-hubs">
            <option value="Kolkata North Agri Hub" />
            <option value="Siliguri Cold Storage Depot" />
            <option value="Howrah Wholesale Mandi" />
            <option value="Burdwan Cold Chain Center" />
            <option value="GreenBasket Fresh Mart (Bengaluru)" />
            <option value="Annapurna Food Rescue (NGO)" />
          </datalist>
          <button
            type="submit"
            className="rounded-lg bg-[#14532D] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#16A34A]"
          >
            {ts ? ts.dispatchBtn : '+ Dispatch Shipment'}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Shipment List */}
        <div className="space-y-3 lg:col-span-4">
          {shipments.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelected(s)}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                selected?.id === s.id
                  ? 'border-[#16A34A] bg-[#16A34A]/5 dark:bg-[#16A34A]/10'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-[#1E293B]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#16A34A] dark:text-[#A3E635]">
                  {s.shipment_code}
                </span>
                <RiskText level={s.risk_level} />
              </div>
              <p className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-white">{s.product_name}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {s.origin} → {s.destination}
              </p>
              <div className="mt-2 flex items-center justify-between font-mono text-xs text-slate-600 dark:text-slate-300">
                <span>{s.status}</span>
                <span>{s.current_temp_c}°C · {s.current_humidity_pct}%</span>
              </div>
            </button>
          ))}
        </div>

        {/* Map + Live Controls */}
        <div className="space-y-5 lg:col-span-8">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#1E293B]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Live GPS Corridor &amp; Weather Monitor
              </span>
              {selected && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={selected.status === 'Delivered'}
                    onClick={() => void handleAdvanceCar(false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:border-[#16A34A] disabled:opacity-50 dark:border-slate-700"
                  >
                    <Navigation className="h-3.5 w-3.5 text-[#16A34A]" />
                    <span>Move Car Live</span>
                  </button>
                  <button
                    type="button"
                    disabled={selected.status === 'Delivered'}
                    onClick={() => setAutoTrack((p) => !p)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${
                      autoTrack ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#14532D] hover:bg-[#16A34A]'
                    }`}
                  >
                    {autoTrack ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    <span>{autoTrack ? 'Stop Auto-Track' : 'Auto-Track'}</span>
                  </button>
                </div>
              )}
            </div>
            <SupplyChainMap shipment={selected} />
          </div>

          {selected && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#1E293B]">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-700">
                <div>
                  <h2 className="font-display text-base font-bold">
                    Update {selected.shipment_code} · {selected.transporter_name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Log status, temperature/humidity readings, transit delays, or move live GPS coordinates forward.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-1.5">
                  <QRCodeSVG
                    value={`AGRINOVA|${selected.shipment_code}|${selected.product_name}|${selected.origin}->${selected.destination}`}
                    size={60}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="block text-xs font-medium">{ts ? ts.statusLabel : 'Status'}</label>
                  <select
                    value={updStatus}
                    onChange={(e) => setUpdStatus(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-[#0F172A]"
                  >
                    {SHIPMENT_STATUSES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium">{ts ? ts.tempLabel : 'Temp (°C)'}</label>
                  <input
                    type="number"
                    step="0.5"
                    value={updTemp}
                    onChange={(e) => setUpdTemp(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium">{ts ? ts.humLabel : 'Humidity (%)'}</label>
                  <input
                    type="number"
                    value={updHum}
                    onChange={(e) => setUpdHum(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium">{ts ? ts.delayLabel : 'Delay (hrs)'}</label>
                  <input
                    type="number"
                    step="0.5"
                    value={updDelay}
                    onChange={(e) => setUpdDelay(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-[#0F172A]"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={updNote}
                  onChange={(e) => setUpdNote(e.target.value)}
                  placeholder={ts ? ts.notePlaceholder : 'Optional checkpoint note...'}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#0F172A]"
                />
                <button
                  type="button"
                  onClick={() => void handleUpdateShipment(false)}
                  className="rounded-lg bg-[#14532D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#16A34A]"
                >
                  {ts ? ts.saveUpdate : 'Save Update'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleUpdateShipment(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:border-[#16A34A] dark:border-slate-700"
                >
                  <MapPin className="h-3.5 w-3.5 text-[#16A34A]" />
                  <span>{ts ? ts.moveGps : 'Move GPS & Save'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AiSpoilageIotTab({ shipments }: { shipments: Shipment[] }) {
  const { showToast } = useToast();
  const [category, setCategory] = useState('Tomato');
  const [temp, setTemp] = useState('32');
  const [hum, setHum] = useState('85');
  const [storageHrs, setStorageHrs] = useState('24');
  const [delayHrs, setDelayHrs] = useState('5');
  const [prediction, setPrediction] = useState<SpoilagePrediction | null>(null);

  const [iotShipmentId, setIotShipmentId] = useState(shipments[0]?.id || 'ship-101');
  const [readings, setReadings] = useState<IotReading[]>([]);

  const runPrediction = async (e?: React.FormEvent) => {
    e?.preventDefault();
    try {
      const res = await api.predictSpoilage({
        category,
        temperature_c: Number(temp),
        humidity_pct: Number(hum),
        storage_hours: Number(storageHrs),
        transport_delay_hours: Number(delayHrs),
      });
      setPrediction(res);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Prediction failed.', 'error');
    }
  };

  const loadReadings = async (sid: string) => {
    try {
      const list = await api.listIotReadings(sid);
      setReadings(list);
    } catch {
      setReadings([]);
    }
  };

  useEffect(() => {
    void runPrediction();
    void loadReadings(iotShipmentId);
  }, [iotShipmentId]);

  const handleSimulateSensor = async () => {
    try {
      await api.simulateIotReading({ shipment_id: iotShipmentId });
      showToast('Simulated ESP32 sensor reading appended.', 'info');
      await loadReadings(iotShipmentId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Simulation failed.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          AI Spoilage Predictor &amp; IoT Monitor
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Transparent category-calibrated spoilage risk scoring + simulated ESP32/Arduino telemetry feed.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          onSubmit={runPrediction}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-[#1E293B]"
        >
          <h2 className="font-display text-base font-bold">Run Spoilage Risk Assessment</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium">Produce Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
              >
                <option value="Tomato">Tomato</option>
                <option value="Mango">Mango</option>
                <option value="Banana">Banana</option>
                <option value="Potato">Potato</option>
                <option value="Onion">Onion</option>
                <option value="Rice">Rice</option>
                <option value="Wheat">Wheat</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium">Temp (°C)</label>
              <input
                type="number"
                step="0.5"
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">Humidity (%)</label>
              <input
                type="number"
                value={hum}
                onChange={(e) => setHum(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">Storage Age (hrs)</label>
              <input
                type="number"
                value={storageHrs}
                onChange={(e) => setStorageHrs(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">Transit Delay (hrs)</label>
              <input
                type="number"
                step="0.5"
                value={delayHrs}
                onChange={(e) => setDelayHrs(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#16A34A]"
          >
            Calculate Spoilage Risk
          </button>
        </form>

        {/* Prediction Result */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-[#1E293B]">
          {prediction ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-700">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Predicted Spoilage Classification</p>
                  <p className="mt-1 font-display text-2xl font-bold">
                    <RiskText level={prediction.risk_level} /> Risk
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Risk Score</p>
                  <p className="font-mono text-3xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                    {prediction.risk_score}/100
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Risk Drivers
                </h3>
                <ul className="mt-2 space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
                  {prediction.explanations.map((ex, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <span>{ex}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Preventive Recommendations
                </h3>
                <ul className="mt-2 space-y-1.5 text-sm text-[#14532D] dark:text-[#A3E635]">
                  {prediction.recommendations.map((rec, idx) => (
                    <li key={idx}>• {rec}</li>
                  ))}
                </ul>
              </div>

              <p className="border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {prediction.model_note}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Simulated IoT Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#1E293B]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#16A34A]" />
              <h2 className="font-display text-base font-bold">
                IoT Cold-Chain Telemetry (Simulated ESP32 Feed)
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Clearly labelled simulated sensor readings (hardware-ready for ESP32/Arduino HTTP webhooks).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={iotShipmentId}
              onChange={(e) => setIotShipmentId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-[#0F172A]"
            >
              {shipments.map((s) => (
                <option key={s.id} value={s.id}>{s.shipment_code}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSimulateSensor}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#16A34A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#14532D]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Simulate Sensor Reading</span>
            </button>
          </div>
        </div>

        <div className="mt-5 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={readings}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.25} />
              <XAxis dataKey="recorded_at" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="temperature_c" name="Temp (°C)" stroke="#16A34A" strokeWidth={2.5} />
              <Line type="monotone" dataKey="humidity_pct" name="Humidity (%)" stroke="#D97706" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export function RedistributionTab({
  items,
  products,
  onReload,
}: {
  items: RedistributionItem[];
  products: Product[];
  onReload: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [prodId, setProdId] = useState(products[0]?.id || '');
  const [mode, setMode] = useState<'ngo' | 'discount'>('ngo');
  const [ngoName, setNgoName] = useState('Annapurna Food Rescue (Demo NGO)');

  useEffect(() => {
    if (!prodId && products.length > 0) {
      setProdId(products[0].id);
    }
  }, [products, prodId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodId) return;
    try {
      await api.createRedistribution({ product_id: prodId, mode, ngo_name: ngoName, discount_pct: 40 });
      showToast('Food redistribution listing created.', 'success');
      await onReload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Creation failed.', 'error');
    }
  };

  const advanceStatus = async (item: RedistributionItem, nextStatus: string) => {
    try {
      await api.updateRedistributionStatus(item.id, nextStatus);
      showToast(`Redistribution marked ${nextStatus}.`, 'success');
      await onReload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Status update failed.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Surplus Food Redistribution &amp; NGO Rescue
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Connect near-expiry or high-risk food batches with demo NGOs and discounted local buyers before spoilage occurs.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#1E293B]"
      >
        <div className="min-w-[200px] flex-1">
          <label className="block text-xs font-medium">Select Batch</label>
          <select
            value={prodId}
            onChange={(e) => setProdId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#0F172A]"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.quantity} {p.unit} · {p.risk_level})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium">Channel</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as 'ngo' | 'discount')}
            className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#0F172A]"
          >
            <option value="ngo">NGO Donation</option>
            <option value="discount">Discounted Sale (40% off)</option>
          </select>
        </div>
        <div className="min-w-[220px] flex-1">
          <label className="block text-xs font-medium">Partner NGO / Hub</label>
          <input
            type="text"
            value={ngoName}
            onChange={(e) => setNgoName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-[#0F172A]"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#14532D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#16A34A]"
        >
          <HeartHandshake className="h-4 w-4" />
          <span>Create Rescue Listing</span>
        </button>
      </form>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#1E293B]"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#16A34A] dark:text-[#A3E635]">
                  {item.mode === 'ngo' ? 'NGO Food Rescue' : `${item.discount_pct}% Discounted Surplus`}
                </span>
                <span className="font-mono text-xs font-bold">{item.status}</span>
              </div>
              <h3 className="mt-1 font-display text-lg font-bold">{item.product_name}</h3>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {item.quantity} {item.unit} · {item.location} · Partner: {item.ngo_name}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {item.status === 'Available' && (
                <button
                  type="button"
                  onClick={() => void advanceStatus(item, 'Requested')}
                  className="rounded-lg bg-[#16A34A] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Request Pickup
                </button>
              )}
              {item.status === 'Requested' && (
                <button
                  type="button"
                  onClick={() => void advanceStatus(item, 'Dispatched')}
                  className="rounded-lg bg-[#14532D] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Mark Dispatched
                </button>
              )}
              {item.status !== 'Rescued' && (
                <button
                  type="button"
                  onClick={() => void advanceStatus(item, 'Rescued')}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
                >
                  Mark Rescued
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function QrReportsTab({ shipments }: { shipments: Shipment[] }) {
  const { showToast } = useToast();
  const [lookupCode, setLookupCode] = useState(shipments[0]?.shipment_code || 'SFC-2026-101');
  const [result, setResult] = useState<{ shipment: Shipment; product: Product | null } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const qrContainerRef = useRef<HTMLDivElement | null>(null);

  const runLookup = async (code: string) => {
    try {
      const data = await api.lookupShipment(code);
      setResult(data);
    } catch (err) {
      setResult(null);
      showToast(err instanceof Error ? err.message : 'Shipment not found.', 'error');
    }
  };

  useEffect(() => {
    if (lookupCode) void runLookup(lookupCode);
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((tr) => tr.stop());
      }
    };
  }, []);

  const toggleCameraScanner = async () => {
    if (cameraOpen) {
      stopCamera();
      return;
    }
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not available in this browser. Use the manual Shipment ID lookup above.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      }, 60);

      // Use native BarcodeDetector when available in Chromium browsers
      const w = window as unknown as {
        BarcodeDetector?: new (opts: { formats: string[] }) => {
          detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
        };
      };
      if (w.BarcodeDetector) {
        const detector = new w.BarcodeDetector({ formats: ['qr_code'] });
        const interval = window.setInterval(async () => {
          if (!videoRef.current || !streamRef.current) {
            window.clearInterval(interval);
            return;
          }
          try {
            const codes = await detector.detect(videoRef.current);
            const val = codes?.[0]?.rawValue?.trim();
            if (val) {
              window.clearInterval(interval);
              setLookupCode(val);
              stopCamera();
              void runLookup(val);
              showToast(`Scanned QR: ${val}`, 'success');
            }
          } catch {
            // ignore frame detection errors
          }
        }, 700);
      }
    } catch {
      setCameraError('Camera permission denied or no camera detected. Use the manual Shipment ID field above.');
    }
  };

  const downloadImageReport = (format: 'png' | 'jpeg') => {
    if (!result) return;
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#14532D';
    ctx.fillRect(0, 0, canvas.width, 96);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('AgriNova — Shipment & Spoilage Report', 40, 52);
    ctx.fillStyle = '#A3E635';
    ctx.font = '15px sans-serif';
    ctx.fillText(`Generated: ${new Date().toLocaleString()}`, 40, 78);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`Shipment ID: ${result.shipment.shipment_code}`, 40, 150);

    ctx.font = '18px sans-serif';
    const lines = [
      `Produce: ${result.shipment.product_name}`,
      `Route: ${result.shipment.origin} -> ${result.shipment.destination}`,
      `Status: ${result.shipment.status} | Transporter: ${result.shipment.transporter_name}`,
      `Live Readings: ${result.shipment.current_temp_c}°C | ${result.shipment.current_humidity_pct}% Humidity | Delay: ${result.shipment.delay_hours}h`,
      `Spoilage Risk Classification: ${result.shipment.risk_level}`,
      result.product?.recommendations?.[0]
        ? `Recommendation: ${result.product.recommendations[0]}`
        : 'Recommendation: Maintain standard cold-chain monitoring.',
    ];
    lines.forEach((line, idx) => {
      ctx.fillText(line, 40, 200 + idx * 44);
    });

    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const url = canvas.toDataURL(mime, 0.94);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.shipment.shipment_code}-report.${ext}`;
    a.click();
    showToast(`Downloaded ${ext.toUpperCase()} report.`, 'success');
  };

  const downloadQrPng = () => {
    if (!result || !qrContainerRef.current) return;
    const svg = qrContainerRef.current.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 370;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 36, 24, 248, 248);
        ctx.fillStyle = '#1F2421';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(result.shipment.shipment_code, 160, 312);
        ctx.font = '13px sans-serif';
        ctx.fillStyle = '#5A5F5B';
        ctx.fillText('AgriNova Verified QR Label', 160, 338);
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `${result.shipment.shipment_code}-qr.png`;
        a.click();
        showToast(`Downloaded ${result.shipment.shipment_code}-qr.png`, 'success');
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          QR Traceability &amp; Downloadable Reports
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Scan with camera or look up any shipment ID, inspect its QR code, and export a branded PNG, JPG, or PDF report.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runLookup(lookupCode);
        }}
        className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#1E293B]"
      >
        <QrCode className="h-5 w-5 text-[#16A34A]" />
        <input
          type="text"
          value={lookupCode}
          onChange={(e) => setLookupCode(e.target.value)}
          placeholder="Enter Shipment ID (e.g. SFC-2026-101)"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-[#0F172A]"
        />
        <button
          type="submit"
          className="rounded-lg bg-[#14532D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16A34A]"
        >
          Lookup Shipment
        </button>
        <button
          type="button"
          onClick={() => void toggleCameraScanner()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:border-[#16A34A] dark:border-slate-700"
        >
          {cameraOpen ? <CameraOff className="h-4 w-4 text-red-500" /> : <Camera className="h-4 w-4 text-[#16A34A]" />}
          <span>{cameraOpen ? 'Stop Camera' : 'Camera Scanner'}</span>
        </button>
        {shipments.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setLookupCode(s.shipment_code);
              void runLookup(s.shipment_code);
            }}
            className="rounded-md border border-slate-200 px-2.5 py-1.5 font-mono text-xs hover:border-[#16A34A] dark:border-slate-700"
          >
            {s.shipment_code}
          </button>
        ))}
      </form>

      {cameraError && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200">
          {cameraError}
        </div>
      )}

      {cameraOpen && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#1E293B]">
          <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            Point camera at an AgriNova shipment QR code (or type Shipment / Batch ID above).
          </p>
          <video ref={videoRef} playsInline muted className="max-h-64 w-full rounded-lg bg-black object-cover" />
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#1E293B]">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-2">
              <p className="font-mono text-sm font-bold text-[#16A34A] dark:text-[#A3E635]">
                {result.shipment.shipment_code}
              </p>
              <h2 className="font-display text-xl font-bold">{result.shipment.product_name}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {result.shipment.origin} → {result.shipment.destination}
              </p>
              <p className="text-sm">
                Status: <strong>{result.shipment.status}</strong> · Spoilage Risk:{' '}
                <RiskText level={result.shipment.risk_level} />
              </p>
              <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                Temp: {result.shipment.current_temp_c}°C · Humidity: {result.shipment.current_humidity_pct}% · Delay:{' '}
                {result.shipment.delay_hours}h
              </p>
            </div>

            <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
              <div ref={qrContainerRef}>
                <QRCodeSVG
                  value={`AGRINOVA|${result.shipment.shipment_code}|${result.shipment.product_name}|${result.shipment.origin}->${result.shipment.destination}`}
                  size={120}
                />
              </div>
              <span className="font-mono text-[11px] text-slate-700">{result.shipment.shipment_code}</span>
              <button
                type="button"
                onClick={downloadQrPng}
                className="text-[11px] font-semibold text-[#16A34A] hover:underline"
              >
                Download QR PNG
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button
              type="button"
              onClick={() => downloadImageReport('png')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16A34A]"
            >
              <Download className="h-4 w-4" />
              <span>Download Report PNG</span>
            </button>
            <button
              type="button"
              onClick={() => downloadImageReport('jpeg')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:border-[#16A34A] dark:border-slate-700"
            >
              <Download className="h-4 w-4" />
              <span>Download Report JPG</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700"
            >
              <Printer className="h-4 w-4" />
              <span>Print / Save as PDF</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function FarmerPaymentsSettlementCard({
  payments,
  canSettle,
  onReload,
}: {
  payments: FarmerPayment[];
  canSettle: boolean;
  onReload: () => Promise<void>;
}) {
  const { showToast } = useToast();

  const handleSettle = async (pay: FarmerPayment) => {
    try {
      await api.settlePayment(pay.id);
      showToast(`Settled ₹${pay.amount_inr.toLocaleString()} for ${pay.product_name}.`, 'success');
      await onReload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Settlement failed.', 'error');
    }
  };

  if (payments.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#1E293B]">
      <h2 className="font-display text-base font-bold">Farmer Payout Ledger</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Admins and Retailers can settle pending farm payouts directly to update the Farmer dashboard.
      </p>
      <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
        {payments.map((pay) => (
          <div key={pay.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{pay.product_name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {pay.buyer_name} · {pay.created_at}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold tabular-nums">₹{pay.amount_inr.toLocaleString()}</span>
              <span
                className={`text-xs font-semibold ${
                  pay.status === 'Paid' ? 'text-[#16A34A] dark:text-[#A3E635]' : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {pay.status}
              </span>
              {canSettle && pay.status !== 'Paid' && (
                <button
                  type="button"
                  onClick={() => void handleSettle(pay)}
                  className="rounded-lg bg-[#14532D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#16A34A]"
                >
                  Settle Payment
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

