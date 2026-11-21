import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  HelpCircle,
  IndianRupee,
  Languages,
  MapPin,
  Mic,
  Navigation,
  Play,
  PlusCircle,
  ShieldCheck,
  ShoppingBag,
  Sprout,
  Square,
  Trash2,
  Truck,
  UserCircle2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { FARMER_TRANSLATIONS, SUPPORTED_FARMER_LANGUAGES } from '../i18n/farmerTranslations';
import type { FarmerLanguage, User } from '../types/auth';
import type { FarmerPayment, Product, Shipment, SpoilagePrediction } from '../types/supplyChain';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  isSpeechRecognitionSupported,
  speakInLanguage,
  startVoiceInput,
  stopSpeaking,
  unlockWebAudioOnGesture,
} from '../utils/speech';
import { SafeImage } from './SafeImage';
import { SupplyChainMap } from './SupplyChainMap';
import { FoodBotWidget } from './FoodBotWidget';

export type FarmerView = 'home' | 'myCrops' | 'addCrops' | 'sellProducts' | 'trackDelivery' | 'myPayments' | 'help';

interface FarmerWorkspaceProps {
  user: User;
  language: FarmerLanguage;
  onLanguageChange: (lang: FarmerLanguage) => void;
  onOpenAccount: () => void;
  onOpenNotifications: () => void;
  unreadNotifications: number;
  activeView?: FarmerView;
  onViewChange?: (view: FarmerView) => void;
}

const CROP_PRESETS = [
  { category: 'Tomato', label: 'Tomato / টমেটো / टमाटर', temp: 13, hum: 85, price: 32 },
  { category: 'Potato', label: 'Potato / আলু / आलू', temp: 8, hum: 88, price: 24 },
  { category: 'Onion', label: 'Onion / পেঁয়াজ / प्याज', temp: 7, hum: 70, price: 28 },
  { category: 'Mango', label: 'Mango / আম / आम', temp: 12, hum: 88, price: 75 },
  { category: 'Banana', label: 'Banana / কলা / केला', temp: 14, hum: 90, price: 40 },
  { category: 'Rice', label: 'Rice / চাল / चावल', temp: 18, hum: 58, price: 62 },
  { category: 'Wheat', label: 'Wheat / গম / गेहूं', temp: 18, hum: 56, price: 30 },
];

interface DestinationOption {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  note: string;
}

const DESTINATION_OPTIONS: DestinationOption[] = [
  {
    id: 'kolkata-hub',
    name: 'Kolkata North Agri Hub',
    type: 'Regional Agri Hub',
    lat: 22.5726,
    lng: 88.3639,
    note: 'Primary cold-chain sorting & buyer distribution center',
  },
  {
    id: 'siliguri-cold',
    name: 'Siliguri Cold Storage Depot',
    type: 'Cold Storage',
    lat: 26.7271,
    lng: 88.3953,
    note: 'Temperature-controlled storage (4°C–14°C) for fresh produce',
  },
  {
    id: 'howrah-mandi',
    name: 'Howrah Wholesale Mandi',
    type: 'Wholesale Mandi',
    lat: 22.5958,
    lng: 88.2636,
    note: 'Direct wholesale auction & retailer pickup point',
  },
  {
    id: 'burdwan-cold',
    name: 'Burdwan Cold Chain Center',
    type: 'Cold Storage',
    lat: 23.2324,
    lng: 87.8615,
    note: 'District cold warehouse with IoT humidity control',
  },
  {
    id: 'retail-mart',
    name: 'GreenBasket Fresh Mart (Bengaluru)',
    type: 'Retailer Buyer',
    lat: 12.9716,
    lng: 77.5946,
    note: 'Direct retail supermarket cold supply line',
  },
  {
    id: 'annapurna-ngo',
    name: 'Annapurna Food Rescue (NGO)',
    type: 'NGO Rescue',
    lat: 22.5355,
    lng: 88.342,
    note: 'Community surplus rescue & fast distribution hub',
  },
];

export function FarmerWorkspace({
  user,
  language,
  onLanguageChange,
  onOpenAccount,
  onOpenNotifications,
  unreadNotifications,
  activeView,
  onViewChange,
}: FarmerWorkspaceProps) {
  const t = FARMER_TRANSLATIONS[language] || FARMER_TRANSLATIONS.en;
  const { showToast } = useToast();

  const [internalView, setInternalView] = useState<FarmerView>('home');
  const view = activeView ?? internalView;
  const setView = useCallback(
    (next: FarmerView) => {
      if (onViewChange) {
        onViewChange(next);
      } else {
        setInternalView(next);
      }
    },
    [onViewChange],
  );
  const [speaking, setSpeaking] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [listeningMic, setListeningMic] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [payments, setPayments] = useState<FarmerPayment[]>([]);
  const [transporters, setTransporters] = useState<Array<{ id: string; full_name: string; location: string | null }>>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

  // Add Crop Form State
  const [presetCategory, setPresetCategory] = useState('Tomato');
  const [cropName, setCropName] = useState('Fresh Vine Tomatoes');
  const [quantity, setQuantity] = useState('250');
  const [harvestDate, setHarvestDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState(user.location || 'Hooghly, West Bengal');
  const [pricePerKg, setPricePerKg] = useState('32');
  const [cropPhoto, setCropPhoto] = useState('/src/assets/images/farmer_mobile_harvest_1795105201987.jpg');
  const [savingCrop, setSavingCrop] = useState(false);
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});

  // Send Truck / Dispatch Modal State
  const [dispatchProduct, setDispatchProduct] = useState<Product | null>(null);
  const [dispatchDestId, setDispatchDestId] = useState<string>('kolkata-hub');
  const [customDestination, setCustomDestination] = useState('');
  const [selectedTransporter, setSelectedTransporter] = useState('ColdHaul Express Fleet');
  const [dispatching, setDispatching] = useState(false);

  // Live Car Tracking State
  const [autoTrack, setAutoTrack] = useState(false);
  const [steppingCar, setSteppingCar] = useState(false);

  // Quick Spoilage Risk Checker Modal State
  const [spoilageOpen, setSpoilageOpen] = useState(false);
  const [spoilCat, setSpoilCat] = useState('Tomato');
  const [spoilTemp, setSpoilTemp] = useState('24');
  const [spoilHum, setSpoilHum] = useState('84');
  const [spoilDelay, setSpoilDelay] = useState('2');
  const [spoilResult, setSpoilResult] = useState<SpoilagePrediction | null>(null);
  const [checkingSpoil, setCheckingSpoil] = useState(false);

  const loadAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const [prods, ships, pays, fleet] = await Promise.all([
        api.listProducts(),
        api.listShipments(),
        api.listPayments(),
        api.listTransporters().catch(() => []),
      ]);
      setProducts(prods);
      setShipments(ships);
      setPayments(pays);
      setTransporters(fleet);
      if (fleet.length > 0) {
        setSelectedTransporter(fleet[0].full_name);
      }
      setSelectedShipment((prev) => {
        if (prev) {
          const fresh = ships.find((s) => s.id === prev.id);
          if (fresh) return fresh;
        }
        return ships[0] || null;
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load farm data.', 'error');
    } finally {
      setLoadingData(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Stop any playing speech if farmer switches language or unmounts
  useEffect(() => {
    stopSpeaking();
    setSpeaking(false);
    setVoiceNotice(null);
    return () => stopSpeaking();
  }, [language]);

  const handleStepCarGps = useCallback(
    async (shipmentId: string, silent = false) => {
      setSteppingCar(true);
      try {
        const updated = await api.advanceLiveShipment(shipmentId);
        setSelectedShipment(updated);
        setShipments((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        if (updated.status === 'Delivered') {
          setAutoTrack(false);
          if (!silent) showToast(`${updated.shipment_code} has arrived at ${updated.destination}!`, 'success');
        } else if (!silent) {
          showToast(
            `Vehicle moved (${updated.current_lat.toFixed(3)}, ${updated.current_lng.toFixed(3)}) · ETA ${updated.eta_hours}h`,
            'info',
          );
        }
      } catch (err) {
        setAutoTrack(false);
        if (!silent) showToast(err instanceof Error ? err.message : 'Unable to update vehicle location.', 'error');
      } finally {
        setSteppingCar(false);
      }
    },
    [showToast],
  );

  // Live Auto-Track Polling Loop when enabled on Track Delivery screen
  useEffect(() => {
    if (!autoTrack || view !== 'trackDelivery' || !selectedShipment || selectedShipment.status === 'Delivered') {
      return;
    }
    const timer = window.setInterval(() => {
      void handleStepCarGps(selectedShipment.id, true);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [autoTrack, view, selectedShipment, handleStepCarGps]);

  const handleVoiceAssist = async () => {
    unlockWebAudioOnGesture();
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setVoiceNotice(null);
    setSpeaking(true);
    const res = await speakInLanguage(t.voiceSampleText, language, () => setSpeaking(false));
    if (!res.ok) {
      setSpeaking(false);
      const msg = res.message || (res.reason === 'missing_voice' ? t.voiceMissing : t.voiceUnsupported);
      setVoiceNotice(msg);
      showToast(msg, 'warning');
    }
  };

  const handleMicCropName = () => {
    setListeningMic(true);
    startVoiceInput(
      language,
      (transcript) => setCropName(transcript),
      (err) => showToast(err, 'warning'),
      () => setListeningMic(false),
    );
  };

  const handlePresetChange = (cat: string) => {
    setPresetCategory(cat);
    const found = CROP_PRESETS.find((c) => c.category === cat);
    if (found) {
      setCropName(`Fresh ${found.category}`);
      setPricePerKg(String(found.price));
    }
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      showToast('Please choose a photo smaller than 1.5 MB.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setCropPhoto(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCrop(true);
    try {
      const preset = CROP_PRESETS.find((c) => c.category === presetCategory);
      await api.createProduct({
        name: cropName,
        category: presetCategory,
        quantity: Number(quantity),
        unit: 'kg',
        harvest_date: harvestDate,
        origin: location,
        current_temp_c: preset?.temp ?? 15,
        current_humidity_pct: preset?.hum ?? 84,
        price_per_unit: Number(pricePerKg),
        image_url: cropPhoto,
      });
      showToast('Crop saved!', 'success');
      await loadAll();
      setView('myCrops');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save crop.', 'error');
    } finally {
      setSavingCrop(false);
    }
  };

  const handleToggleSale = async (p: Product) => {
    const edited = Number(priceEdits[p.id] ?? p.price_per_unit);
    const nextPrice = Number.isFinite(edited) && edited > 0 ? edited : p.price_per_unit;
    try {
      await api.updateProduct(p.id, { listed_for_sale: !p.listed_for_sale, price_per_unit: nextPrice });
      showToast(!p.listed_for_sale ? `${p.name} listed for sale!` : `${p.name} removed from sale.`, 'success');
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed.', 'error');
    }
  };

  const handleSavePrice = async (p: Product) => {
    const edited = Number(priceEdits[p.id] ?? p.price_per_unit);
    if (!Number.isFinite(edited) || edited <= 0) {
      showToast('Enter a valid price above 0.', 'warning');
      return;
    }
    try {
      await api.updateProduct(p.id, { price_per_unit: edited, listed_for_sale: p.listed_for_sale });
      showToast(`Updated ${p.name} price to ₹${edited}/${p.unit}`, 'success');
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update price.', 'error');
    }
  };

  const openDispatchModal = (p: Product) => {
    setDispatchProduct(p);
    const matching = DESTINATION_OPTIONS.find((d) => p.destination && d.name.toLowerCase().includes(p.destination.toLowerCase().split(' ')[0]));
    setDispatchDestId(matching ? matching.id : 'kolkata-hub');
    setCustomDestination('');
  };

  const confirmDispatchTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchProduct) return;
    const preset = DESTINATION_OPTIONS.find((d) => d.id === dispatchDestId);
    const destName = dispatchDestId === 'custom' ? customDestination.trim() : preset?.name || 'Kolkata North Agri Hub';
    if (!destName) {
      showToast('Please enter where you want to send this harvest.', 'warning');
      return;
    }

    setDispatching(true);
    try {
      const ship = await api.createShipment({
        product_id: dispatchProduct.id,
        destination: destName,
        dest_lat: dispatchDestId === 'custom' ? undefined : preset?.lat,
        dest_lng: dispatchDestId === 'custom' ? undefined : preset?.lng,
        transporter_name: selectedTransporter,
      });
      showToast(
        `Truck ${ship.shipment_code} dispatched to ${ship.destination} (${ship.transporter_name})!`,
        'success',
      );
      setDispatchProduct(null);
      await loadAll();
      setSelectedShipment(ship);
      setView('trackDelivery');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not dispatch truck.', 'error');
    } finally {
      setDispatching(false);
    }
  };

  const handleDeleteCrop = async (id: string) => {
    try {
      await api.deleteProduct(id);
      showToast('Crop deleted.', 'info');
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
    }
  };

  const handleQuickSpoilageCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckingSpoil(true);
    try {
      const res = await api.predictSpoilage({
        category: spoilCat,
        temperature_c: Number(spoilTemp),
        humidity_pct: Number(spoilHum),
        storage_hours: 18,
        transport_delay_hours: Number(spoilDelay),
      });
      setSpoilResult(res);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Spoilage calculation failed.', 'error');
    } finally {
      setCheckingSpoil(false);
    }
  };

  const riskBadge = (level: Product['risk_level']) => {
    if (level === 'Low') return <span className="font-semibold text-[#16A34A] dark:text-[#A3E635]">{t.labels.safe}</span>;
    if (level === 'Medium') return <span className="font-semibold text-amber-600 dark:text-amber-400">{t.labels.caution}</span>;
    return <span className="font-semibold text-red-600 dark:text-red-400">{t.labels.highRisk}</span>;
  };

  const paidSum = payments.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.amount_inr, 0);
  const pendingSum = payments.filter((p) => p.status !== 'Paid').reduce((s, p) => s + p.amount_inr, 0);

  const selectedDestOption = DESTINATION_OPTIONS.find((d) => d.id === dispatchDestId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#1E293B]">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 sm:text-2xl dark:text-white">
            {t.greetingPrefix}, {user.full_name}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-[#0F172A]">
            <Languages className="h-4 w-4 text-[#16A34A]" />
            <select
              aria-label={t.languageLabel}
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as FarmerLanguage)}
              className="bg-transparent text-sm font-semibold text-slate-900 focus:outline-none dark:text-white"
            >
              {SUPPORTED_FARMER_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                  {l.native} ({l.label})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => void handleVoiceAssist()}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 hover:border-[#16A34A] dark:border-slate-700 dark:bg-[#0F172A] dark:text-slate-100"
          >
            {speaking ? <VolumeX className="h-4 w-4 text-red-500" /> : <Volume2 className="h-4 w-4 text-[#16A34A]" />}
            <span>{speaking ? t.voiceSpeaking : t.voiceButton}</span>
          </button>

          <button
            type="button"
            onClick={() => setSpoilageOpen(true)}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium hover:border-[#16A34A] dark:border-slate-700 dark:bg-[#0F172A]"
          >
            <ShieldCheck className="h-4 w-4 text-[#16A34A]" />
            <span>Spoilage Check</span>
          </button>

          <button
            type="button"
            onClick={onOpenNotifications}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium dark:border-slate-700 dark:bg-[#0F172A]"
          >
            <Bell className="h-4 w-4 text-[#16A34A]" />
            <span>{t.notifications} ({unreadNotifications})</span>
          </button>

          <button
            type="button"
            onClick={onOpenAccount}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium dark:border-slate-700 dark:bg-[#0F172A]"
          >
            <UserCircle2 className="h-4 w-4 text-[#16A34A]" />
            <span>{t.profile}</span>
          </button>
        </div>
      </div>

      {voiceNotice && (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200">
          {voiceNotice}
        </div>
      )}

      {view !== 'home' && (
        <button
          type="button"
          onClick={() => {
            setAutoTrack(false);
            setView('home');
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-[#16A34A] dark:border-slate-700 dark:bg-[#1E293B] dark:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t.backHome}</span>
        </button>
      )}

      {view === 'home' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => setView('myCrops')}
            className="flex min-h-[112px] items-start gap-4 rounded-xl bg-[#14532D] p-5 text-left text-white transition-colors hover:bg-[#16A34A]"
          >
            <Sprout className="mt-0.5 h-8 w-8 shrink-0 text-[#A3E635]" />
            <div>
              <div className="font-display text-xl font-bold">{t.actions.myCrops.title}</div>
              <div className="mt-1 text-sm text-emerald-100">{t.actions.myCrops.subtitle}</div>
              <div className="mt-2 font-mono text-xs text-[#A3E635]">{products.length} crops</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setView('addCrops')}
            className="flex min-h-[112px] items-start gap-4 rounded-xl bg-[#16A34A] p-5 text-left text-white transition-colors hover:bg-[#14532D]"
          >
            <PlusCircle className="mt-0.5 h-8 w-8 shrink-0" />
            <div>
              <div className="font-display text-xl font-bold">{t.actions.addCrops.title}</div>
              <div className="mt-1 text-sm text-emerald-50">{t.actions.addCrops.subtitle}</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setView('sellProducts')}
            className="flex min-h-[112px] items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-[#16A34A] dark:border-slate-800 dark:bg-[#1E293B]"
          >
            <ShoppingBag className="mt-0.5 h-8 w-8 shrink-0 text-[#16A34A]" />
            <div>
              <div className="font-display text-xl font-bold text-slate-900 dark:text-white">{t.actions.sellProducts.title}</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.actions.sellProducts.subtitle}</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setView('trackDelivery')}
            className="flex min-h-[112px] items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-[#16A34A] dark:border-slate-800 dark:bg-[#1E293B]"
          >
            <Truck className="mt-0.5 h-8 w-8 shrink-0 text-[#16A34A]" />
            <div>
              <div className="font-display text-xl font-bold text-slate-900 dark:text-white">{t.actions.trackDelivery.title}</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.actions.trackDelivery.subtitle}</div>
              <div className="mt-2 font-mono text-xs text-[#16A34A] dark:text-[#A3E635]">{shipments.length} live trips</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setView('myPayments')}
            className="flex min-h-[112px] items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-[#16A34A] dark:border-slate-800 dark:bg-[#1E293B]"
          >
            <IndianRupee className="mt-0.5 h-8 w-8 shrink-0 text-[#16A34A]" />
            <div>
              <div className="font-display text-xl font-bold text-slate-900 dark:text-white">{t.actions.myPayments.title}</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.actions.myPayments.subtitle}</div>
              <div className="mt-2 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                ₹{paidSum.toLocaleString()} {t.labels.paid}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setView('help')}
            className="flex min-h-[112px] items-start gap-4 rounded-xl border border-dashed border-[#16A34A]/60 bg-[#16A34A]/5 p-5 text-left transition-colors hover:bg-[#16A34A]/10 dark:bg-[#16A34A]/10"
          >
            <HelpCircle className="mt-0.5 h-8 w-8 shrink-0 text-[#16A34A]" />
            <div>
              <div className="font-display text-xl font-bold text-slate-900 dark:text-white">{t.helpTitle}</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.helpDesc}</div>
            </div>
          </button>
        </div>
      )}

      {view === 'myCrops' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold">{t.actions.myCrops.title}</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSpoilageOpen(true)}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold hover:border-[#16A34A] dark:border-slate-700"
              >
                Check Spoilage Risk
              </button>
              <button
                type="button"
                onClick={() => setView('addCrops')}
                className="rounded-lg bg-[#14532D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16A34A]"
              >
                + {t.actions.addCrops.title}
              </button>
            </div>
          </div>

          {loadingData ? (
            <p className="text-sm text-slate-500">Loading crops...</p>
          ) : products.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-[#1E293B] dark:text-slate-300">
              {t.labels.noCrops}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#1E293B]"
                >
                  <div className="grid grid-cols-12">
                    <div className="col-span-4">
                      <SafeImage src={p.image_url} alt={p.name} className="h-full min-h-[130px] w-full object-cover" />
                    </div>
                    <div className="col-span-8 flex flex-col justify-between p-4">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">{p.name}</h3>
                          <button
                            type="button"
                            onClick={() => void handleDeleteCrop(p.id)}
                            aria-label={`Delete ${p.name}`}
                            className="p-1 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {p.quantity} {p.unit} · {p.harvest_date} · {p.origin}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                          {riskBadge(p.risk_level)}
                          <span className="font-mono text-slate-600 dark:text-slate-300">
                            {t.labels.tempLabel}: {p.current_temp_c}°C · {t.labels.humLabel}: {p.current_humidity_pct}%
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-slate-600 dark:text-slate-300">{p.recommendations[0]}</p>
                        <button
                          type="button"
                          onClick={() => openDispatchModal(p)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#14532D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#16A34A]"
                        >
                          <Truck className="h-3.5 w-3.5" />
                          <span>{t.labels.dispatchTruck}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'addCrops' && (
        <form
          onSubmit={handleCreateCrop}
          className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#1E293B]"
        >
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">{t.actions.addCrops.title}</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">{t.labels.cropPreset}</label>
              <select
                value={presetCategory}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
              >
                {CROP_PRESETS.map((c) => (
                  <option key={c.category} value={c.category}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">{t.labels.cropName}</label>
                {isSpeechRecognitionSupported() && (
                  <button
                    type="button"
                    onClick={handleMicCropName}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A34A]"
                  >
                    <Mic className="h-3.5 w-3.5" />
                    <span>{listeningMic ? '...' : t.labels.voiceType}</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                required
                value={cropName}
                onChange={(e) => setCropName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">{t.labels.quantityKg}</label>
              <input
                type="number"
                required
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">{t.labels.pricePerKg}</label>
              <input
                type="number"
                required
                min={1}
                value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">{t.labels.harvestDate}</label>
              <input
                type="date"
                required
                value={harvestDate}
                onChange={(e) => setHarvestDate(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">{t.labels.location}</label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium">{t.labels.uploadPhoto}</label>
            <input type="file" accept="image/*" onChange={handleImageFile} className="mt-1.5 block text-xs" />
          </div>

          <button
            type="submit"
            disabled={savingCrop}
            className="mt-6 w-full min-h-[46px] rounded-lg bg-[#14532D] px-5 py-3 text-base font-bold text-white hover:bg-[#16A34A] disabled:opacity-50"
          >
            {savingCrop ? t.labels.saving : t.labels.saveCrop}
          </button>
        </form>
      )}

      {view === 'sellProducts' && (
        <div className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-bold">{t.actions.sellProducts.title}</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Set your farm price or click <strong>{t.labels.dispatchTruck}</strong> to choose exactly which Cold Storage, Mandi, Retailer, or NGO hub receives your produce.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {products.map((p) => {
              const currentEditVal = priceEdits[p.id] ?? String(p.price_per_unit);
              const numericPrice = Number(currentEditVal) || p.price_per_unit;
              return (
                <div
                  key={p.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#1E293B]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-lg font-bold">{p.name}</h3>
                      <span className="font-mono text-sm font-bold text-[#16A34A] dark:text-[#A3E635]">
                        ₹{numericPrice}/{p.unit}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {p.quantity} {p.unit} · Est. Total: ₹{(p.quantity * numericPrice).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Route target: <strong>{p.destination}</strong>
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {t.labels.pricePerKg}:
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={currentEditVal}
                        onChange={(e) => setPriceEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        className="w-24 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-[#0F172A]"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSavePrice(p)}
                        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold hover:border-[#16A34A] dark:border-slate-700"
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleToggleSale(p)}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                        p.listed_for_sale
                          ? 'border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200'
                          : 'bg-[#16A34A] text-white hover:bg-[#14532D]'
                      }`}
                    >
                      {p.listed_for_sale ? t.labels.removeListing : t.labels.markForSale}
                    </button>
                    <button
                      type="button"
                      onClick={() => openDispatchModal(p)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#14532D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16A34A]"
                    >
                      <Truck className="h-4 w-4" />
                      <span>{t.labels.dispatchTruck}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'trackDelivery' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">{t.actions.trackDelivery.title}</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Track live vehicle GPS location, route destination, temperature telemetry, and delivery steps.
              </p>
            </div>
            {selectedShipment && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={steppingCar || selectedShipment.status === 'Delivered'}
                  onClick={() => void handleStepCarGps(selectedShipment.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold hover:border-[#16A34A] disabled:opacity-50 dark:border-slate-700 dark:bg-[#1E293B]"
                >
                  <Navigation className="h-3.5 w-3.5 text-[#16A34A]" />
                  <span>Move Car Live (+1 Step)</span>
                </button>
                <button
                  type="button"
                  disabled={selectedShipment.status === 'Delivered'}
                  onClick={() => setAutoTrack((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                    autoTrack ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#14532D] hover:bg-[#16A34A]'
                  }`}
                >
                  {autoTrack ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  <span>{autoTrack ? 'Stop Auto-Track' : 'Auto-Track Live'}</span>
                </button>
              </div>
            )}
          </div>

          {shipments.length === 0 ? (
            <p className="text-sm text-slate-500">{t.labels.noShipments}</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="space-y-3 lg:col-span-5">
                {shipments.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedShipment(s);
                      setAutoTrack(false);
                    }}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      selectedShipment?.id === s.id
                        ? 'border-[#16A34A] bg-[#16A34A]/5 dark:bg-[#16A34A]/10'
                        : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-[#1E293B]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#16A34A] dark:text-[#A3E635]">
                        {s.shipment_code}
                      </span>
                      <span className="text-xs font-semibold">{s.status}</span>
                    </div>
                    <p className="mt-1 font-display text-sm font-bold">{s.product_name}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {s.origin} → {s.destination}
                    </p>
                    <p className="mt-1 font-mono text-xs text-slate-600 dark:text-slate-300">
                      {s.transporter_name} · {s.current_temp_c}°C · {s.current_humidity_pct}%
                    </p>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7 dark:border-slate-800 dark:bg-[#1E293B]">
                {selectedShipment && (
                  <>
                    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-700 dark:bg-[#0F172A]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          Dispatch Data Destination: {selectedShipment.destination}
                        </span>
                        <span className="font-mono font-bold text-[#16A34A] dark:text-[#A3E635]">
                          {selectedShipment.shipment_code}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-600 dark:text-slate-300">
                        Shared with Transporter (<strong>{selectedShipment.transporter_name}</strong>), Warehouse Depot, &amp; QR Traceability Ledger.
                      </p>
                    </div>

                    <SupplyChainMap shipment={selectedShipment} />

                    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                      <h3 className="font-display text-sm font-bold">Delivery Timeline</h3>
                      <div className="mt-2 space-y-2">
                        {selectedShipment.timeline.map((step, i) => (
                          <div key={i} className="flex items-start justify-between gap-2 text-xs">
                            <span>
                              <strong>{step.status}:</strong> {step.note}
                            </span>
                            <span className="shrink-0 font-mono text-slate-500">{step.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'myPayments' && (
        <div className="space-y-5">
          <h2 className="font-display text-xl font-bold">{t.actions.myPayments.title}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#1E293B]">
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.labels.paidTotal}</p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#16A34A] dark:text-[#A3E635]">
                ₹{paidSum.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#1E293B]">
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.labels.pendingTotal}</p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                ₹{pendingSum.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#1E293B]">
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {payments.map((pay) => (
                <div key={pay.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{pay.product_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {pay.buyer_name} · {pay.created_at}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold tabular-nums">₹{pay.amount_inr.toLocaleString()}</p>
                    <p
                      className={`text-xs font-semibold ${
                        pay.status === 'Paid' ? 'text-[#16A34A] dark:text-[#A3E635]' : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {pay.status === 'Paid' ? t.labels.paid : t.labels.pending}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === 'help' && <FoodBotWidget role="farmer" farmerLang={language} />}

      {/* SEND TRUCK / CHOOSE HARVEST DESTINATION MODAL */}
      {dispatchProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={confirmDispatchTruck}
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-[#1E293B]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3 dark:border-slate-700">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Send Harvest Truck · {dispatchProduct.name}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Batch {dispatchProduct.batch_id} · {dispatchProduct.quantity} {dispatchProduct.unit} from {dispatchProduct.origin}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDispatchProduct(null)}
                aria-label="Close dispatch modal"
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold">Where do you want to send your harvest?</label>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {DESTINATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDispatchDestId(opt.id)}
                      className={`rounded-lg border p-2.5 text-left text-xs transition-colors ${
                        dispatchDestId === opt.id
                          ? 'border-[#16A34A] bg-[#16A34A]/10 font-semibold'
                          : 'border-slate-200 hover:border-[#16A34A]/60 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#16A34A]" />
                        <span className="truncate font-semibold text-slate-900 dark:text-white">{opt.name}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{opt.type}</p>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDispatchDestId('custom')}
                    className={`rounded-lg border p-2.5 text-left text-xs transition-colors sm:col-span-2 ${
                      dispatchDestId === 'custom'
                        ? 'border-[#16A34A] bg-[#16A34A]/10 font-semibold'
                        : 'border-slate-200 hover:border-[#16A34A]/60 dark:border-slate-700'
                    }`}
                  >
                    + Enter Custom Mandi / Cold Storage / Buyer Location
                  </button>
                </div>

                {dispatchDestId === 'custom' && (
                  <input
                    type="text"
                    required
                    value={customDestination}
                    onChange={(e) => setCustomDestination(e.target.value)}
                    placeholder="e.g. Durgapur Cooperative Cold Store"
                    className="mt-2.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold">Assign Transporter Vehicle</label>
                <select
                  value={selectedTransporter}
                  onChange={(e) => setSelectedTransporter(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                >
                  {transporters.map((tr) => (
                    <option key={tr.id} value={tr.full_name}>
                      {tr.full_name} {tr.location ? `(${tr.location})` : ''}
                    </option>
                  ))}
                  <option value="ColdHaul Express Fleet">ColdHaul Express Fleet (Refrigerated Van)</option>
                  <option value="KisanFast Green Van">KisanFast Green Van (Local Express)</option>
                </select>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-700 dark:bg-[#0F172A]">
                <p className="font-semibold text-slate-900 dark:text-white">
                  Where this dispatch information goes:
                </p>
                <ul className="mt-1.5 space-y-1 text-slate-600 dark:text-slate-300">
                  <li>
                    • <strong>Route:</strong> {dispatchProduct.origin} →{' '}
                    {dispatchDestId === 'custom' ? customDestination || 'Custom Hub' : selectedDestOption?.name}
                  </li>
                  <li>
                    • <strong>Notifies:</strong> {selectedTransporter}, Warehouse Hub, &amp; Supply Chain Control
                  </li>
                  <li>
                    • <strong>Includes:</strong> {dispatchProduct.quantity} {dispatchProduct.unit} weight, spoilage risk ({dispatchProduct.risk_level}), &amp; live GPS tracking ID
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDispatchProduct(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={dispatching}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#14532D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16A34A] disabled:opacity-50"
              >
                <Truck className="h-4 w-4" />
                <span>{dispatching ? 'Dispatching...' : 'Confirm & Track Car Live'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* QUICK SPOILAGE RISK CHECKER MODAL FOR FARMERS */}
      {spoilageOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-[#1E293B]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
              <h3 className="font-display text-lg font-bold">Quick Spoilage Risk Calculator</h3>
              <button
                type="button"
                onClick={() => setSpoilageOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleQuickSpoilageCheck} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium">Crop Type</label>
                <select
                  value={spoilCat}
                  onChange={(e) => setSpoilCat(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                >
                  {CROP_PRESETS.map((c) => (
                    <option key={c.category} value={c.category}>{c.category}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-medium">Temp (°C)</label>
                  <input
                    type="number"
                    value={spoilTemp}
                    onChange={(e) => setSpoilTemp(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium">Humidity (%)</label>
                  <input
                    type="number"
                    value={spoilHum}
                    onChange={(e) => setSpoilHum(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium">Delay (hrs)</label>
                  <input
                    type="number"
                    value={spoilDelay}
                    onChange={(e) => setSpoilDelay(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={checkingSpoil}
                className="w-full rounded-lg bg-[#14532D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16A34A]"
              >
                {checkingSpoil ? 'Calculating...' : 'Calculate Spoilage Risk'}
              </button>
            </form>

            {spoilResult && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-700 dark:bg-[#0F172A]">
                <div className="flex items-center justify-between font-bold">
                  <span>Result: {spoilResult.risk_level} Risk</span>
                  <span className="font-mono">{spoilResult.risk_score}/100</span>
                </div>
                <p className="mt-1.5 text-slate-600 dark:text-slate-300">{spoilResult.explanations[0]}</p>
                <p className="mt-1 font-medium text-[#16A34A] dark:text-[#A3E635]">{spoilResult.recommendations[0]}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
