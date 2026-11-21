import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { SafeImage } from '../components/SafeImage';
import { ThemeSelector } from '../components/ThemeSelector';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { DEMO_ROLE_DIRECTORY, type UserRole } from '../types/auth';

const HERO_IMG = '/src/assets/images/hero_supply_chain_1795105202293.jpg';
const FARMER_IMG = '/src/assets/images/farmer_mobile_harvest_1795105201987.jpg';
const WAREHOUSE_IMG = '/src/assets/images/cold_storage_warehouse_1795105201955.jpg';

export function LandingPage() {
  const { demoLogin, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loadingRole, setLoadingRole] = useState<UserRole | null>(null);

  const handleQuickDemo = async (role: UserRole) => {
    setLoadingRole(role);
    try {
      const signedUser = await demoLogin(role);
      showToast(`Signed in as ${signedUser.full_name}`, 'success');
      navigate('/dashboard');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to start demo session.', 'error');
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 dark:bg-[#0F172A] dark:text-slate-100">
      <Navbar />

      <main>
        {/* Clean, Uncluttered Hero Section */}
        <section id="platform" className="mx-auto max-w-[1200px] px-4 pt-10 pb-12 sm:px-6 lg:px-8 lg:pt-14">
          <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="flex flex-col justify-between gap-6 lg:col-span-6">
              <div>
                <p className="text-xs font-semibold text-[#16A34A] dark:text-[#A3E635]">
                  AgriNova · Farm-to-Market Cold Chain &amp; Harvest Platform
                </p>
                <h1
                  className="mt-3 font-display font-extrabold tracking-tight text-slate-900 dark:text-white"
                  style={{ fontSize: 'clamp(2.2rem, 3.8vw, 3.4rem)', lineHeight: 1.08, textWrap: 'balance' }}
                >
                  Smarter Supply Chains. Fresher Food. Less Waste.
                </h1>
                <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-600 dark:text-slate-300">
                  Track crops from farm to retail, predict spoilage before produce spoils, monitor cold-chain transport
                  on live maps, and give farmers &amp; transporters simple access in 12 Indian languages including
                  English, বাংলা &amp; हिन्दी.
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-3.5">
                  <button
                    type="button"
                    onClick={() => (user ? navigate('/dashboard') : handleQuickDemo('admin'))}
                    disabled={loadingRole !== null}
                    className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-[#14532D] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#16A34A]"
                  >
                    <span>{user ? 'Open Working App' : 'Try Live Operations Console'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemo('farmer')}
                    disabled={loadingRole !== null}
                    className="inline-flex min-h-[44px] items-center whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:border-[#16A34A] dark:border-slate-700 dark:bg-[#1E293B] dark:text-slate-100"
                  >
                    Open Farmer Mode (বাংলা / हिन्दी / EN)
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Farmer · Warehouse · Transporter · Retailer · NGO Rescue
                </span>
                <ThemeSelector />
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[290px] overflow-hidden rounded-xl border border-slate-200 bg-slate-900 dark:border-slate-800">
                <SafeImage
                  src={HERO_IMG}
                  alt="Fresh produce crates loaded into a refrigerated cold-chain truck"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
                <p className="absolute right-5 bottom-4 left-5 font-display text-sm font-semibold text-white sm:text-base">
                  Farmer → Warehouse → Transporter → Retailer → Consumer
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Simple Two-Photo Feature Showcase */}
        <section id="supply-chain" className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#1E293B]">
              <SafeImage
                src={FARMER_IMG}
                alt="Farmer holding a wooden crate of freshly harvested tomatoes"
                className="h-56 w-full object-cover"
              />
              <div className="p-6">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Simple Farmer Access
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Add crops with photos, list for sale, track delivery trucks, and check payments in 12 Indian
                  languages (including বাংলা &amp; हिन्दी) with voice assistance.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#1E293B]">
              <SafeImage
                src={WAREHOUSE_IMG}
                alt="Modern temperature-controlled cold storage warehouse"
                className="h-56 w-full object-cover"
              />
              <div className="p-6">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  AI Spoilage Prediction &amp; Live Tracking
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Calculate spoilage risk from temperature, humidity, and transit delays, monitor routes on live maps,
                  scan QR codes, and rescue surplus food via NGOs.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Clean 5-Role Instant Launch Strip */}
        <section id="roles" className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900 sm:text-2xl dark:text-white">
                Instant Working Role Demos
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Click any role to enter the live workspace immediately, or{' '}
                <Link to="/auth" className="font-semibold text-[#16A34A] hover:underline">
                  sign in / register your own account
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
            {DEMO_ROLE_DIRECTORY.map((item) => (
              <div
                key={item.role}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#1E293B]"
              >
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">{item.label}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{item.summary}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleQuickDemo(item.role)}
                  disabled={loadingRole !== null}
                  className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#14532D] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#16A34A] disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{loadingRole === item.role ? 'Opening...' : `Enter ${item.label}`}</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0F172A]">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <span className="font-display text-sm font-bold text-[#14532D] dark:text-[#A3E635]">
            AgriNova
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Smarter Supply Chains. Fresher Food. Less Waste.
          </span>
          <div className="flex items-center gap-3">
            <ThemeSelector compact />
          </div>
        </div>
      </footer>
    </div>
  );
}
