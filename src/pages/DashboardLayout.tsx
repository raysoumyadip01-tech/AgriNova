import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  Bot,
  CheckCheck,
  CreditCard,
  HeartHandshake,
  HelpCircle,
  Home,
  IndianRupee,
  KeyRound,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PlusCircle,
  QrCode,
  Search,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Sprout,
  Trash2,
  Truck,
  User as UserIcon,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { api, ApiError } from '../services/api';
import { ThemeSelector } from '../components/ThemeSelector';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FarmerWorkspace, type FarmerView } from '../components/FarmerWorkspace';
import { FoodBotWidget } from '../components/FoodBotWidget';
import { FARMER_TRANSLATIONS, SUPPORTED_FARMER_LANGUAGES } from '../i18n/farmerTranslations';
import { TRANSPORTER_TRANSLATIONS } from '../i18n/transporterTranslations';
import { speakInLanguage, stopSpeaking, unlockWebAudioOnGesture } from '../utils/speech';
import {
  AiSpoilageIotTab,
  FarmerPaymentsSettlementCard,
  ProductsInventoryTab,
  QrReportsTab,
  RedistributionTab,
  ShipmentsMapTab,
} from '../components/EnterpriseOperationsTabs';
import type { FarmerLanguage, ThemeMode, User, UserRole, UserSession } from '../types/auth';
import type {
  AppNotification,
  DashboardMetrics,
  FarmerPayment,
  Product,
  RedistributionItem,
  Shipment,
} from '../types/supplyChain';

type WorkspaceTab =
  | 'overview'
  | 'products'
  | 'shipments'
  | 'ai_iot'
  | 'redistribution'
  | 'qr_reports'
  | 'foodbot'
  | 'plans'
  | 'rbac'
  | 'settings';

type SidebarItemId =
  | WorkspaceTab
  | 'farmer:home'
  | 'farmer:myCrops'
  | 'farmer:addCrops'
  | 'farmer:sellProducts'
  | 'farmer:trackDelivery'
  | 'farmer:myPayments'
  | 'farmer:help';

interface SideNavItem {
  id: SidebarItemId;
  label: string;
  Icon: typeof LayoutDashboard;
}

interface SideNavGroup {
  title: string;
  items: SideNavItem[];
}

interface RoleSideNavConfig {
  roleTitle: string;
  consoleSubtitle: string;
  defaultItem: SidebarItemId;
  groups: SideNavGroup[];
}

const ROLE_OVERVIEW_COPY: Record<'warehouse' | 'retailer' | 'admin', { title: string; subtitle: string }> = {
  warehouse: {
    title: 'Warehouse Storage Overview',
    subtitle: 'Monitor chamber inventory batches, cooling risks, and inbound/outbound dock loads.',
  },
  retailer: {
    title: 'Retail Freshness & Payout Overview',
    subtitle: 'Track incoming produce quality, shelf freshness, and settled farmer payouts.',
  },
  admin: {
    title: 'Supply Chain Overview',
    subtitle: 'Live metrics across platform inventory, shipments, AI spoilage records, and governance.',
  },
};

function getRoleSideNavConfig(
  role: UserRole,
  tTrans: (typeof TRANSPORTER_TRANSLATIONS)['en'],
  tFarmer: (typeof FARMER_TRANSLATIONS)['en'],
): RoleSideNavConfig {
  switch (role) {
    case 'farmer':
      return {
        roleTitle: 'Farmer',
        consoleSubtitle: `Farmer · ${tFarmer.nativeName}`,
        defaultItem: 'farmer:home',
        groups: [
          {
            title: 'Farm Workspace',
            items: [
              { id: 'farmer:home', label: 'Farmer Home', Icon: Home },
              { id: 'farmer:myCrops', label: tFarmer.actions.myCrops.title, Icon: Sprout },
              { id: 'farmer:addCrops', label: tFarmer.actions.addCrops.title, Icon: PlusCircle },
              { id: 'farmer:sellProducts', label: tFarmer.actions.sellProducts.title, Icon: ShoppingBag },
              { id: 'farmer:trackDelivery', label: tFarmer.actions.trackDelivery.title, Icon: Truck },
              { id: 'farmer:myPayments', label: tFarmer.actions.myPayments.title, Icon: IndianRupee },
            ],
          },
          {
            title: 'Support & Account',
            items: [
              { id: 'farmer:help', label: tFarmer.helpTitle, Icon: HelpCircle },
              { id: 'settings', label: tFarmer.profile, Icon: Settings },
            ],
          },
        ],
      };

    case 'transporter':
      return {
        roleTitle: 'Transporter',
        consoleSubtitle: tTrans.consoleTitle,
        defaultItem: 'overview',
        groups: [
          {
            title: 'Fleet & Cold Chain',
            items: [
              { id: 'overview', label: tTrans.nav.overview, Icon: LayoutDashboard },
              { id: 'shipments', label: tTrans.nav.shipments, Icon: Truck },
              { id: 'ai_iot', label: tTrans.nav.ai_iot, Icon: Activity },
              { id: 'qr_reports', label: tTrans.nav.qr_reports, Icon: QrCode },
            ],
          },
          {
            title: 'Support & Account',
            items: [
              { id: 'foodbot', label: tTrans.nav.foodbot, Icon: Bot },
              { id: 'settings', label: tTrans.nav.settings, Icon: Settings },
            ],
          },
        ],
      };

    case 'warehouse':
      return {
        roleTitle: 'Warehouse Manager',
        consoleSubtitle: 'Warehouse · Cold Storage Console',
        defaultItem: 'overview',
        groups: [
          {
            title: 'Storage & Docks',
            items: [
              { id: 'overview', label: 'Storage Overview', Icon: LayoutDashboard },
              { id: 'products', label: 'Warehouse Inventory', Icon: Package },
              { id: 'ai_iot', label: 'Chamber IoT & Spoilage', Icon: Activity },
              { id: 'shipments', label: 'Inbound & Outbound Docks', Icon: Truck },
            ],
          },
          {
            title: 'Rescue & Account',
            items: [
              { id: 'redistribution', label: 'Expiry & Surplus Rescue', Icon: HeartHandshake },
              { id: 'qr_reports', label: 'Batch QR & Reports', Icon: QrCode },
              { id: 'foodbot', label: 'Help & Support', Icon: Bot },
              { id: 'settings', label: 'Account & Security', Icon: Settings },
            ],
          },
        ],
      };

    case 'retailer':
      return {
        roleTitle: 'Retailer',
        consoleSubtitle: 'Retailer · Store Freshness Console',
        defaultItem: 'overview',
        groups: [
          {
            title: 'Store & Procurement',
            items: [
              { id: 'overview', label: 'Store Overview & Payouts', Icon: LayoutDashboard },
              { id: 'shipments', label: 'Incoming Produce', Icon: Truck },
              { id: 'products', label: 'Store Stock & Freshness', Icon: Package },
              { id: 'qr_reports', label: 'QR Origin Verification', Icon: QrCode },
            ],
          },
          {
            title: 'Surplus & Account',
            items: [
              { id: 'redistribution', label: 'Surplus Rescue', Icon: HeartHandshake },
              { id: 'ai_iot', label: 'Freshness & Spoilage AI', Icon: Activity },
              { id: 'foodbot', label: 'Help & Support', Icon: Bot },
              { id: 'settings', label: 'Account & Security', Icon: Settings },
            ],
          },
        ],
      };

    case 'admin':
    default:
      return {
        roleTitle: 'System Admin',
        consoleSubtitle: 'Admin · Governance Console',
        defaultItem: 'overview',
        groups: [
          {
            title: 'Supply Chain Operations',
            items: [
              { id: 'overview', label: 'Overview & Analytics', Icon: LayoutDashboard },
              { id: 'products', label: 'Products & Inventory', Icon: Package },
              { id: 'shipments', label: 'Shipments & Live Map', Icon: Truck },
              { id: 'ai_iot', label: 'AI Spoilage & IoT', Icon: Activity },
              { id: 'redistribution', label: 'Food Redistribution', Icon: HeartHandshake },
              { id: 'qr_reports', label: 'QR & Reports', Icon: QrCode },
            ],
          },
          {
            title: 'Governance & Account',
            items: [
              { id: 'plans', label: 'Plans & Revenue', Icon: CreditCard },
              { id: 'rbac', label: 'Users & RBAC', Icon: Users },
              { id: 'foodbot', label: 'Help & Support', Icon: Bot },
              { id: 'settings', label: 'Account & Security', Icon: Settings },
            ],
          },
        ],
      };
  }
}

interface SideNavMenuProps {
  config: RoleSideNavConfig;
  activeItemId: SidebarItemId;
  user: User;
  signOutLabel: string;
  onSelect: (id: SidebarItemId) => void;
  onSignOutClick: () => void;
  onCloseMobile?: () => void;
}

function SideNavMenu({
  config,
  activeItemId,
  user,
  signOutLabel,
  onSelect,
  onSignOutClick,
  onCloseMobile,
}: SideNavMenuProps) {
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="min-h-0 overflow-y-auto">
        <div className="flex items-center justify-between px-2 py-1.5">
          <Link to="/" className="font-display text-lg font-bold tracking-tight text-[#14532D] dark:text-[#A3E635]">
            AgriNova
          </Link>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <p className="px-2 text-xs text-slate-500 dark:text-slate-400">{config.consoleSubtitle}</p>

        <nav aria-label="Role navigation" className="mt-5 space-y-5">
          {config.groups.map((group) => (
            <div key={group.title}>
              <p className="px-2.5 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500">
                {group.title}
              </p>
              <div className="mt-1.5 space-y-1">
                {group.items.map(({ id, label, Icon }) => {
                  const isActive = activeItemId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onSelect(id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-[#14532D] text-white'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
        <div className="px-2 pb-3">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{user.full_name}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={onSignOutClick}
          className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="truncate">{signOutLabel}</span>
        </button>
      </div>
    </div>
  );
}

const SUBSCRIPTION_PLANS = [
  { id: 'free', name: 'Free', priceInr: 0, price: '₹0/mo', limits: 'Up to 10 shipments · 2 team users', audience: 'Individual farmers & pilots' },
  { id: 'starter', name: 'Starter', priceInr: 2499, price: '₹2,499/mo', limits: 'Up to 100 shipments · 10 users', audience: 'Regional co-ops & transporters' },
  { id: 'pro', name: 'Professional', priceInr: 7999, price: '₹7,999/mo', limits: 'Unlimited shipments · 50 users · IoT', audience: 'Cold storage & retail chains' },
  { id: 'enterprise', name: 'Enterprise', priceInr: 24999, price: '₹24,999/mo', limits: 'Multi-region · Dedicated PostgreSQL & SLA', audience: 'National food networks' },
];

type DisplayCurrency = 'INR' | 'USD' | 'GBP' | 'AED';
const CURRENCY_RATES_FROM_USD: Record<DisplayCurrency, { symbol: string; rateFromUsd: number }> = {
  INR: { symbol: '₹', rateFromUsd: 84.5 },
  USD: { symbol: '$', rateFromUsd: 1 },
  GBP: { symbol: '£', rateFromUsd: 0.79 },
  AED: { symbol: 'AED ', rateFromUsd: 3.67 },
};

const COUNTRY_REVENUE_DEMO = [
  { countryCode: 'IN', country: 'India', nativeCurrency: 'INR' as const, nativeAmount: 485000, savedKg: 4200, usdRate: 1 / 84.5 },
  { countryCode: 'AE', country: 'UAE', nativeCurrency: 'AED' as const, nativeAmount: 19800, savedKg: 1450, usdRate: 1 / 3.67 },
  { countryCode: 'GB', country: 'UK', nativeCurrency: 'GBP' as const, nativeAmount: 4200, savedKg: 980, usdRate: 1 / 0.79 },
  { countryCode: 'US', country: 'USA', nativeCurrency: 'USD' as const, nativeAmount: 5400, savedKg: 1320, usdRate: 1 },
];

export function DashboardLayout() {
  const { user, loading, logout, updateProfile, deleteAccount, refreshUser } = useAuth();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [farmerView, setFarmerView] = useState<FarmerView>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [redistributions, setRedistributions] = useState<RedistributionItem[]>([]);
  const [payments, setPayments] = useState<FarmerPayment[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [transporterSpeaking, setTransporterSpeaking] = useState(false);

  // Plans & Multi-Currency Analytics state
  const [activePlan, setActivePlan] = useState('pro');
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('INR');

  // RBAC Admin & Tester state
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminUsersError, setAdminUsersError] = useState<string | null>(null);
  const [rbacProbeLog, setRbacProbeLog] = useState<string | null>(null);

  // Settings forms state
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileLocation, setProfileLocation] = useState('');
  const [profileLang, setProfileLang] = useState<FarmerLanguage>('en');
  const [profileSavedMsg, setProfileSavedMsg] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [savingPass, setSavingPass] = useState(false);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Dialog states
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [loading, user, navigate]);

  const loadWorkspaceData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      const [ov, prods, ships, reds, pays, notifs] = await Promise.all([
        api.dashboardOverview(),
        api.listProducts(),
        api.listShipments(),
        api.listRedistributions(),
        api.listPayments(),
        api.listNotifications(),
      ]);
      setMetrics(ov.metrics);
      setProducts(prods);
      setShipments(ships);
      setRedistributions(reds);
      setPayments(pays);
      setNotifications(notifs);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load workspace data.', 'error');
    } finally {
      setDataLoading(false);
    }
  }, [user, showToast]);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    setSessionsLoading(true);
    try {
      setSessions(await api.listSessions());
    } catch {
      // ignore
    } finally {
      setSessionsLoading(false);
    }
  }, [user]);

  const loadAdminUsers = useCallback(async () => {
    if (!user) return;
    setAdminUsersError(null);
    try {
      setAdminUsers(await api.adminListUsers());
    } catch (err) {
      setAdminUsersError(err instanceof ApiError ? `${err.status} Forbidden: ${err.message}` : 'Access denied.');
      setAdminUsers([]);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      setProfileName(user.full_name);
      setProfilePhone(user.phone || '');
      setProfileLocation(user.location || '');
      setProfileLang(
        SUPPORTED_FARMER_LANGUAGES.some((l) => l.code === user.language_preference)
          ? (user.language_preference as FarmerLanguage)
          : 'en',
      );
      void loadWorkspaceData();
    }
  }, [user, loadWorkspaceData]);

  useEffect(() => {
    if (user && activeTab === 'settings') void loadSessions();
    if (user && activeTab === 'rbac') void loadAdminUsers();
  }, [user, activeTab, loadSessions, loadAdminUsers]);

  useEffect(() => {
    if (!user) return;
    const tTransTemp = TRANSPORTER_TRANSLATIONS.en;
    const tFarmerTemp = FARMER_TRANSLATIONS.en;
    const cfg = getRoleSideNavConfig(user.role, tTransTemp, tFarmerTemp);
    const allowedIds = new Set(cfg.groups.flatMap((g) => g.items.map((item) => item.id)));
    if (user.role === 'farmer') {
      if (activeTab !== 'overview' && activeTab !== 'settings') {
        setActiveTab('overview');
      }
    } else if (!allowedIds.has(activeTab)) {
      setActiveTab('overview');
    }
  }, [user, activeTab]);

  useEffect(() => {
    stopSpeaking();
    setTransporterSpeaking(false);
    return () => stopSpeaking();
  }, [user?.language_preference, user?.role]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] dark:bg-[#0F172A]">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm font-medium dark:border-slate-800 dark:bg-[#1E293B]">
          Loading AgriNova...
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // ignore
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await api.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // ignore
    }
  };

  const handleFarmerLangChange = async (lang: FarmerLanguage) => {
    try {
      await updateProfile({ language_preference: lang });
      showToast('Language saved.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save language.', 'error');
    }
  };

  const handleThemePersist = async (mode: ThemeMode) => {
    try {
      await updateProfile({ theme_preference: mode });
    } catch {
      // ThemeContext already persisted locally
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSavedMsg(null);
    try {
      await updateProfile({
        full_name: profileName.trim(),
        phone: profilePhone.trim(),
        location: profileLocation.trim(),
        theme_preference: theme,
        language_preference:
          user.role === 'farmer' || user.role === 'transporter' ? profileLang : 'en',
      });
      setProfileSavedMsg('Profile & preferences saved.');
      showToast('Profile saved.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Profile update failed.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPass(true);
    try {
      const res = await api.changePassword({ current_password: currPass, new_password: newPass });
      showToast(res.message, 'success');
      setCurrPass('');
      setNewPass('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Password change failed.', 'error');
    } finally {
      setSavingPass(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await api.revokeSession(sessionId);
      showToast('Session revoked.', 'success');
      await loadSessions();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to revoke session.', 'error');
    }
  };

  const handleLogoutConfirmed = async () => {
    await logout();
    setLogoutConfirmOpen(false);
    showToast('Signed out securely.', 'info');
    navigate('/');
  };

  const handleDeleteConfirmed = async () => {
    if (deleteConfirmText !== 'DELETE') {
      showToast("Type 'DELETE' to confirm.", 'warning');
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount({ confirmation: 'DELETE', password: deletePassword || undefined });
      setDeleteDialogOpen(false);
      showToast('Account deleted.', 'info');
      navigate('/');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Account deletion failed.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleAdminRoleChange = async (targetUserId: string, nextRole: UserRole) => {
    try {
      await api.adminUpdateUserRole(targetUserId, nextRole);
      showToast(`Updated role to ${nextRole}.`, 'success');
      await loadAdminUsers();
      await refreshUser();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Role update failed.', 'error');
    }
  };

  const renderSettingsPanel = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleSaveProfile}
          className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#1E293B]"
        >
          <h2 className="font-display text-lg font-bold">Profile &amp; Preferences</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Role: <strong className="uppercase text-[#16A34A] dark:text-[#A3E635]">{user.role}</strong> · {user.email}
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium">Full Name</label>
              <input
                type="text"
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Phone</label>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Location</label>
                <input
                  type="text"
                  value={profileLocation}
                  onChange={(e) => setProfileLocation(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                />
              </div>
            </div>
            <div>
              <span className="block text-sm font-medium">Theme</span>
              <div className="mt-1.5">
                <ThemeSelector onSelect={handleThemePersist} />
              </div>
            </div>
            {user.role === 'farmer' || user.role === 'transporter' ? (
              <div>
                <label className="block text-sm font-medium">
                  {user.role === 'transporter' ? 'Transporter Language' : 'Farmer Language'}
                </label>
                <select
                  value={profileLang}
                  onChange={(e) => {
                    const nextLang = e.target.value as FarmerLanguage;
                    setProfileLang(nextLang);
                    void handleFarmerLangChange(nextLang);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                >
                  {SUPPORTED_FARMER_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.native} ({l.label})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-[#0F172A] dark:text-slate-400">
                Interface Language: <strong>English (Locked)</strong>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={savingProfile}
                className="rounded-lg bg-[#14532D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16A34A] disabled:opacity-50"
              >
                {savingProfile
                  ? 'Saving...'
                  : user.role === 'transporter'
                    ? (TRANSPORTER_TRANSLATIONS[profileLang]?.common.saveProfile ?? 'Save Profile')
                    : 'Save Profile'}
              </button>
              {profileSavedMsg && (
                <span className="text-xs font-semibold text-[#16A34A] dark:text-[#A3E635]">
                  {profileSavedMsg}
                </span>
              )}
            </div>
          </div>
        </form>

        <form
          onSubmit={handleChangePassword}
          className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#1E293B]"
        >
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#16A34A]" />
            <h2 className="font-display text-lg font-bold">Change Password</h2>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium">Current Password</label>
              <input
                type="password"
                required
                value={currPass}
                onChange={(e) => setCurrPass(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">New Password (min 8 chars)</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
              />
            </div>
            <button
              type="submit"
              disabled={savingPass}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700"
            >
              {savingPass ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#1E293B]">
        <h2 className="font-display text-lg font-bold">Active Sessions</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                <th className="py-2 pr-4">Device</th>
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {sessionsLoading ? (
                <tr><td colSpan={4} className="py-3">Loading...</td></tr>
              ) : (
                sessions.slice(0, 5).map((s) => (
                  <tr key={s.id} className="h-10">
                    <td className="max-w-xs truncate pr-4">{s.device_info}</td>
                    <td className="pr-4 font-mono">{new Date(s.created_at).toLocaleString()}</td>
                    <td className="pr-4">{s.revoked ? 'Revoked' : s.is_current ? 'Current' : 'Active'}</td>
                    <td className="text-right">
                      {!s.revoked && !s.is_current && (
                        <button
                          type="button"
                          onClick={() => void handleRevokeSession(s.id)}
                          className="font-semibold text-red-600 hover:underline"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-200 bg-white p-6 dark:border-red-900/60 dark:bg-[#1E293B]">
        <div>
          <h2 className="font-display text-base font-bold text-red-600 dark:text-red-400">Delete Account</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Permanently delete your account and sessions.</p>
        </div>
        <button
          type="button"
          onClick={() => setDeleteDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete Account</span>
        </button>
      </div>
    </div>
  );

  const isFarmer = user.role === 'farmer';
  const isTransporter = user.role === 'transporter';
  const validLang = SUPPORTED_FARMER_LANGUAGES.some((l) => l.code === user.language_preference);
  const activeLang: FarmerLanguage =
    (isFarmer || isTransporter) && validLang ? (user.language_preference as FarmerLanguage) : 'en';

  const tFarmer = FARMER_TRANSLATIONS[activeLang] || FARMER_TRANSLATIONS.en;
  const tTrans = TRANSPORTER_TRANSLATIONS[activeLang] || TRANSPORTER_TRANSLATIONS.en;

  const roleNavConfig = getRoleSideNavConfig(user.role, tTrans, tFarmer);
  const allRoleNavItems = roleNavConfig.groups.flatMap((g) => g.items);
  const currentSidebarItemId: SidebarItemId = isFarmer
    ? activeTab === 'settings'
      ? 'settings'
      : (`farmer:${farmerView}` as SidebarItemId)
    : activeTab;
  const currentNavLabel =
    allRoleNavItems.find((item) => item.id === currentSidebarItemId)?.label || roleNavConfig.roleTitle;

  const handleSelectNavItem = (id: SidebarItemId) => {
    if (id === 'settings') {
      setActiveTab('settings');
    } else if (id.startsWith('farmer:')) {
      setActiveTab('overview');
      setFarmerView(id.slice('farmer:'.length) as FarmerView);
    } else {
      setActiveTab(id as WorkspaceTab);
    }
    setSidebarOpen(false);
  };

  const handleTransporterVoice = async () => {
    unlockWebAudioOnGesture();
    if (transporterSpeaking) {
      stopSpeaking();
      setTransporterSpeaking(false);
      return;
    }
    setTransporterSpeaking(true);
    const res = await speakInLanguage(tTrans.voiceSample, activeLang, () => setTransporterSpeaking(false));
    if (!res.ok) {
      setTransporterSpeaking(false);
      showToast(res.message || 'Voice playback unavailable.', 'warning');
    }
  };

  const chartData = products.map((p) => ({
    name: p.category,
    quantity: p.quantity,
    risk: p.risk_score,
  }));

  const overviewCopy =
    user.role === 'warehouse' || user.role === 'retailer' || user.role === 'admin'
      ? ROLE_OVERVIEW_COPY[user.role]
      : ROLE_OVERVIEW_COPY.admin;

  const signOutLabel = isTransporter ? tTrans.common.signOut : 'Sign Out';

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-900 dark:bg-[#0F172A] dark:text-slate-100">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 lg:flex dark:border-slate-800 dark:bg-[#1E293B]">
        <SideNavMenu
          config={roleNavConfig}
          activeItemId={currentSidebarItemId}
          user={user}
          signOutLabel={signOutLabel}
          onSelect={handleSelectNavItem}
          onSignOutClick={() => setLogoutConfirmOpen(true)}
        />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-950/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-10 flex w-64 flex-col bg-white p-4 dark:bg-[#1E293B]">
            <SideNavMenu
              config={roleNavConfig}
              activeItemId={currentSidebarItemId}
              user={user}
              signOutLabel={signOutLabel}
              onSelect={handleSelectNavItem}
              onSignOutClick={() => {
                setSidebarOpen(false);
                setLogoutConfirmOpen(true);
              }}
              onCloseMobile={() => setSidebarOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-6 dark:border-slate-800 dark:bg-[#0F172A]/95">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="rounded-lg border border-slate-200 p-2 lg:hidden dark:border-slate-700"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex min-w-0 items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="hidden sm:inline whitespace-nowrap">{roleNavConfig.roleTitle}</span>
              <span aria-hidden="true" className="hidden sm:inline">/</span>
              <span className="truncate font-semibold text-slate-900 dark:text-white">
                {currentNavLabel}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {!isFarmer && (
              <div className="relative hidden md:block">
                <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search batches..."
                  className="w-48 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-9 text-xs dark:border-slate-700 dark:bg-[#1E293B]"
                />
              </div>
            )}

            {isTransporter && (
              <>
                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-[#1E293B]">
                  <Languages className="h-3.5 w-3.5 text-[#16A34A]" />
                  <select
                    aria-label={tTrans.common.languageLabel}
                    value={activeLang}
                    onChange={(e) => void handleFarmerLangChange(e.target.value as FarmerLanguage)}
                    className="bg-transparent text-xs font-semibold text-slate-900 focus:outline-none dark:text-white"
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
                  onClick={() => void handleTransporterVoice()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold hover:border-[#16A34A] dark:border-slate-700"
                >
                  {transporterSpeaking ? (
                    <VolumeX className="h-3.5 w-3.5 text-red-500" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5 text-[#16A34A]" />
                  )}
                  <span className="hidden sm:inline">
                    {transporterSpeaking ? tTrans.voiceSpeaking : tTrans.voiceButton}
                  </span>
                </button>
              </>
            )}

            <ThemeSelector compact onSelect={handleThemePersist} />

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="Notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#16A34A] px-1 font-mono text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-[#1E293B]">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-700">
                    <span className="font-display text-sm font-bold">Alerts</span>
                    <button
                      type="button"
                      onClick={() => void handleMarkAllRead()}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#16A34A]"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      <span>Mark all read</span>
                    </button>
                  </div>
                  <div className="mt-2 max-h-60 space-y-2 overflow-y-auto">
                    {notifications.map((n) => (
                      <div key={n.id} className={`flex items-start justify-between gap-2 rounded-lg p-2 text-xs ${n.is_read ? 'opacity-60' : 'bg-slate-50 dark:bg-[#0F172A]'}`}>
                        <div>
                          <p className="font-semibold">{n.title}</p>
                          <p className="mt-0.5 text-slate-600 dark:text-slate-300">{n.message}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteNotification(n.id)}
                          aria-label="Delete alert"
                          className="p-1 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="hidden sm:flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-2.5 text-xs font-medium dark:border-slate-700"
            >
              <UserIcon className="h-3.5 w-3.5 text-[#16A34A]" />
              <span className="max-w-[110px] truncate">{user.full_name}</span>
            </button>

            <button
              type="button"
              onClick={() => setLogoutConfirmOpen(true)}
              aria-label={signOutLabel}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 whitespace-nowrap dark:border-slate-700 dark:bg-[#1E293B] dark:text-slate-200 dark:hover:border-red-800 dark:hover:bg-red-950/40 dark:hover:text-red-300"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span>{signOutLabel}</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1200px] flex-1 p-4 sm:p-6 lg:p-8">
          {isFarmer && activeTab !== 'settings' ? (
            <FarmerWorkspace
              user={user}
              language={activeLang}
              onLanguageChange={(l) => void handleFarmerLangChange(l)}
              onOpenAccount={() => setActiveTab('settings')}
              onOpenNotifications={() => setNotifOpen((prev) => !prev)}
              unreadNotifications={unreadCount}
              activeView={farmerView}
              onViewChange={setFarmerView}
            />
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                      {isTransporter ? tTrans.overview.title : overviewCopy.title}
                    </h1>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {isTransporter ? tTrans.overview.subtitle : overviewCopy.subtitle}
                    </p>
                  </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#1E293B]">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isTransporter ? tTrans.overview.totalInventory : 'Total Inventory'}
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
                    {dataLoading ? '...' : `${metrics?.total_inventory_kg.toLocaleString()} kg`}
                  </p>
                  <p className="mt-1 text-xs text-[#16A34A] dark:text-[#A3E635]">
                    Safe: {metrics?.safe_stock_kg.toLocaleString()} kg
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#1E293B]">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isTransporter ? tTrans.overview.atRiskStock : 'At-Risk Stock'}
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
                    {dataLoading ? '...' : `${metrics?.at_risk_stock_kg.toLocaleString()} kg`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Requires cooling or NGO rescue</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#1E293B]">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isTransporter ? tTrans.overview.shipments : 'Shipments'}
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
                    {dataLoading ? '...' : metrics?.total_shipments}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {metrics?.active_shipments} active · {metrics?.completed_shipments} delivered
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#1E293B]">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isTransporter ? tTrans.overview.savedValue : 'Est. Food Saved & Value'}
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#16A34A] dark:text-[#A3E635]">
                    {dataLoading ? '...' : `${metrics?.estimated_food_saved_kg.toLocaleString()} kg`}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    ₹{metrics?.estimated_value_inr.toLocaleString()} inventory value
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#1E293B]">
                <h2 className="font-display text-base font-bold">
                  {isTransporter ? tTrans.overview.chartTitle : 'Inventory Volume (kg) & Spoilage Risk Score'}
                </h2>
                <div className="mt-4 h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.25} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="quantity" name="Quantity (kg)" fill="#16A34A" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="risk" name="Spoilage Risk (0-100)" fill="#D97706" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {(user.role === 'admin' || user.role === 'retailer') && (
                <FarmerPaymentsSettlementCard
                  payments={payments}
                  canSettle={user.role === 'admin' || user.role === 'retailer'}
                  onReload={loadWorkspaceData}
                />
              )}
            </div>
          )}

          {!isFarmer && activeTab === 'products' && (
            <ProductsInventoryTab products={products} searchQuery={searchQuery} onReload={loadWorkspaceData} />
          )}

          {!isFarmer && activeTab === 'shipments' && (
            <ShipmentsMapTab
              shipments={shipments}
              products={products}
              onReload={loadWorkspaceData}
              transporterStrings={isTransporter ? tTrans : undefined}
            />
          )}

          {!isFarmer && activeTab === 'ai_iot' && <AiSpoilageIotTab shipments={shipments} />}

          {!isFarmer && activeTab === 'redistribution' && (
            <RedistributionTab items={redistributions} products={products} onReload={loadWorkspaceData} />
          )}

          {!isFarmer && activeTab === 'qr_reports' && <QrReportsTab shipments={shipments} />}

          {!isFarmer && activeTab === 'foodbot' && (
            <FoodBotWidget role={user.role} farmerLang={isTransporter ? activeLang : 'en'} />
          )}

          {!isFarmer && activeTab === 'plans' && (() => {
            const targetRate = CURRENCY_RATES_FROM_USD[displayCurrency];
            const convertedCountries = COUNTRY_REVENUE_DEMO.map((row) => {
              const usd = row.nativeAmount * row.usdRate;
              const converted = Math.round(usd * targetRate.rateFromUsd);
              return { ...row, converted };
            });
            const totalConverted = convertedCountries.reduce((acc, r) => acc + r.converted, 0);
            const selectedPlanObj = SUBSCRIPTION_PLANS.find((p) => p.id === activePlan) || SUBSCRIPTION_PLANS[2];

            const downloadDemoInvoice = () => {
              const canvas = document.createElement('canvas');
              canvas.width = 840;
              canvas.height = 460;
              const ctx = canvas.getContext('2d');
              if (!ctx) return;
              ctx.fillStyle = '#F8FAFC';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.fillStyle = '#14532D';
              ctx.fillRect(0, 0, canvas.width, 84);
              ctx.fillStyle = '#FFFFFF';
              ctx.font = 'bold 24px sans-serif';
              ctx.fillText('AgriNova — Simulated Demo Invoice', 36, 50);
              ctx.fillStyle = '#0F172A';
              ctx.font = '18px sans-serif';
              ctx.fillText(`Customer: ${user.full_name} (${user.email})`, 36, 136);
              ctx.fillText(`Plan: ${selectedPlanObj.name} (${selectedPlanObj.price})`, 36, 176);
              ctx.fillText(`Billing Status: SIMULATED DEMO RECEIPT (No real charge)`, 36, 216);
              ctx.fillText(`Issued: ${new Date().toLocaleDateString()}`, 36, 256);
              const a = document.createElement('a');
              a.href = canvas.toDataURL('image/png');
              a.download = `agrinova-demo-invoice-${selectedPlanObj.id}.png`;
              a.click();
              showToast('Downloaded simulated invoice PNG.', 'success');
            };

            return (
              <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h1 className="font-display text-2xl font-bold">Subscriptions &amp; Multi-Currency Demo Analytics</h1>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      [Simulated Demo Revenue] Billing plans &amp; country-wise revenue converted dynamically using stored country + currency codes.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold">Display Currency:</label>
                    <select
                      value={displayCurrency}
                      onChange={(e) => setDisplayCurrency(e.target.value as DisplayCurrency)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono dark:border-slate-700 dark:bg-[#1E293B]"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="AED">AED</option>
                    </select>
                    <button
                      type="button"
                      onClick={downloadDemoInvoice}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:border-[#16A34A] dark:border-slate-700"
                    >
                      Download Demo Invoice
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {SUBSCRIPTION_PLANS.map((plan) => (
                    <div
                      key={plan.id}
                      className={`flex flex-col justify-between rounded-xl border p-5 ${
                        activePlan === plan.id
                          ? 'border-[#16A34A] bg-[#16A34A]/5 dark:bg-[#16A34A]/10'
                          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-[#1E293B]'
                      }`}
                    >
                      <div>
                        <h2 className="font-display text-lg font-bold">{plan.name}</h2>
                        <p className="mt-1 font-mono text-2xl font-extrabold text-[#14532D] dark:text-[#A3E635]">
                          {plan.price}
                        </p>
                        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{plan.audience}</p>
                        <p className="mt-2 text-xs font-medium">{plan.limits}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActivePlan(plan.id);
                          showToast(`Simulated plan switched to ${plan.name}.`, 'success');
                        }}
                        className="mt-5 w-full rounded-lg bg-[#14532D] px-3 py-2 text-xs font-semibold text-white hover:bg-[#16A34A]"
                      >
                        {activePlan === plan.id ? 'Current Plan' : `Select ${plan.name}`}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#1E293B]">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="font-display text-base font-bold">
                        Country Revenue &amp; Wastage Prevented [Simulated Demo Data]
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Total Converted Demo Revenue: <strong className="font-mono text-[#16A34A] dark:text-[#A3E635]">{targetRate.symbol}{totalConverted.toLocaleString()}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={convertedCountries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.25} />
                        <XAxis dataKey="country" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="converted" name={`Demo Revenue (${displayCurrency})`} fill="#16A34A" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="savedKg" name="Food Saved (kg)" fill="#A3E635" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            );
          })()}

          {!isFarmer && activeTab === 'rbac' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#1E293B]">
                <h1 className="font-display text-xl font-bold">Live Backend RBAC Verifier</h1>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Test real server-side FastAPI/SQLite role permissions as <strong>{user.role.toUpperCase()}</strong>.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const r = await api.checkFarmerRbac();
                        setRbacProbeLog(`200 OK — ${r.message} (role: ${r.verified_role})`);
                      } catch (e) {
                        setRbacProbeLog(e instanceof ApiError ? `${e.status} Forbidden — ${e.message}` : 'Denied');
                      }
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:border-[#16A34A] dark:border-slate-700"
                  >
                    Test /api/rbac/farmer/summary
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const r = await api.checkSupplyChainRbac();
                        setRbacProbeLog(`200 OK — ${r.message} (role: ${r.verified_role})`);
                      } catch (e) {
                        setRbacProbeLog(e instanceof ApiError ? `${e.status} Forbidden — ${e.message}` : 'Denied');
                      }
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:border-[#16A34A] dark:border-slate-700"
                  >
                    Test /api/rbac/supply-chain/summary
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const list = await api.adminListUsers();
                        setRbacProbeLog(`200 OK — Admin endpoint returned ${list.length} accounts.`);
                      } catch (e) {
                        setRbacProbeLog(e instanceof ApiError ? `${e.status} Forbidden — ${e.message}` : 'Denied');
                      }
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:border-[#16A34A] dark:border-slate-700"
                  >
                    Test /api/rbac/admin/users
                  </button>
                </div>
                {rbacProbeLog && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-xs dark:border-slate-700 dark:bg-[#0F172A]">
                    {rbacProbeLog}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#1E293B]">
                <h2 className="font-display text-lg font-bold">User &amp; Role Management (Admin Only)</h2>
                {adminUsersError ? (
                  <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200">
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-semibold">Backend RBAC Enforced</p>
                      <p className="mt-1 text-xs">{adminUsersError}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-700">
                          <th className="py-2 pr-4">Name</th>
                          <th className="py-2 pr-4">Email</th>
                          <th className="py-2 pr-4">Language</th>
                          <th className="py-2">Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {adminUsers.map((u) => (
                          <tr key={u.id} className="h-11">
                            <td className="pr-4 font-medium">{u.full_name}</td>
                            <td className="pr-4 font-mono text-xs">{u.email}</td>
                            <td className="pr-4 font-mono text-xs uppercase">{u.language_preference}</td>
                            <td>
                              <select
                                value={u.role}
                                disabled={u.id === user.id}
                                onChange={(e) => void handleAdminRoleChange(u.id, e.target.value as UserRole)}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-[#0F172A]"
                              >
                                <option value="farmer">farmer</option>
                                <option value="transporter">transporter</option>
                                <option value="warehouse">warehouse</option>
                                <option value="retailer">retailer</option>
                                <option value="admin">admin</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && renderSettingsPanel()}
            </>
          )}
        </main>
      </div>

      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Sign Out"
        description="Are you sure you want to end your current session?"
        confirmLabel="Sign Out"
        onConfirm={handleLogoutConfirmed}
        onCancel={() => setLogoutConfirmOpen(false)}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Permanently Delete Account"
        description="Type DELETE below to permanently remove your account."
        confirmLabel="Delete Forever"
        destructive
        loading={deleting}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteDialogOpen(false)}
      >
        <div className="space-y-3">
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Type DELETE"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-[#0F172A]"
          />
          {user.auth_provider === 'email' && !user.is_demo && (
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
            />
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
}
