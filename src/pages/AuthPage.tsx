import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, Mail, Phone, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { ThemeSelector } from '../components/ThemeSelector';
import {
  DEMO_ROLE_DIRECTORY,
  type FarmerLanguage,
  type PublicRegisterRole,
  type UserRole,
} from '../types/auth';

type AuthMode = 'login' | 'register' | 'reset' | 'otp';

export function AuthPage() {
  const { user, login, register, demoLogin, firebaseGoogleLogin, verifyOtpDemo } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>('login');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Email Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<PublicRegisterRole>('farmer');
  const [regLang, setRegLang] = useState<FarmerLanguage>('en');

  // Phone OTP Demo
  const [otpPhone, setOtpPhone] = useState('+919876543210');
  const [otpCode, setOtpCode] = useState('');
  const [issuedDemoOtp, setIssuedDemoOtp] = useState<string | null>(null);

  // Reset Password
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [issuedResetCode, setIssuedResetCode] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      const signed = await login(loginEmail, loginPassword);
      showToast(`Welcome back, ${signed.full_name}`, 'success');
      navigate('/dashboard');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      const created = await register({
        full_name: regName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        language_preference: regRole === 'farmer' || regRole === 'transporter' ? regLang : 'en',
      });
      showToast(`Account created for ${created.full_name}`, 'success');
      navigate('/dashboard');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDemoRole = async (role: UserRole) => {
    setErrorMsg(null);
    setBusy(true);
    try {
      const signed = await demoLogin(role);
      showToast(`Signed in as ${signed.full_name}`, 'success');
      navigate('/dashboard');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Demo login failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setBusy(true);
    try {
      const signed = await firebaseGoogleLogin(regRole);
      showToast(`Signed in with Google as ${signed.full_name}`, 'success');
      navigate('/dashboard');
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Google Sign-In failed. Ensure popups are allowed or use email/demo sign-in.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRequestOtp = async () => {
    setErrorMsg(null);
    setBusy(true);
    try {
      const res = await api.requestOtpDemo({ phone: otpPhone, role: 'farmer' });
      setIssuedDemoOtp(res.demo_otp_code);
      setOtpCode(res.demo_otp_code);
      showToast('Simulated 6-digit OTP generated.', 'info');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not generate OTP.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      const signed = await verifyOtpDemo({ phone: otpPhone, otp_code: otpCode, role: 'farmer' });
      showToast(`Signed in via Phone OTP Demo`, 'success');
      navigate('/dashboard');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid OTP code.');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestReset = async () => {
    setErrorMsg(null);
    setBusy(true);
    try {
      const res = await api.forgotPassword(resetEmail);
      setIssuedResetCode(res.simulated_reset_code);
      if (res.simulated_reset_code) setResetCode(res.simulated_reset_code);
      showToast(res.message, 'info');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Reset request failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      const res = await api.resetPassword({ email: resetEmail, reset_code: resetCode, new_password: resetNewPass });
      showToast(res.message, 'success');
      setLoginEmail(resetEmail);
      setMode('login');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Password update failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 dark:bg-[#0F172A] dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0F172A]">
        <div className="mx-auto flex max-w-[960px] items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#14532D] dark:text-slate-300">
            <ArrowLeft className="h-4 w-4" />
            <span>Home</span>
          </Link>
          <span className="font-display text-base font-bold text-[#14532D] dark:text-[#A3E635]">
            AgriNova
          </span>
          <ThemeSelector compact />
        </div>
      </header>

      <main className="mx-auto max-w-[960px] px-4 py-10 sm:px-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          {/* Main Clean Login / Register Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 md:col-span-7 dark:border-slate-800 dark:bg-[#1E293B]">
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {mode === 'login' && 'Sign In'}
              {mode === 'register' && 'Create Account'}
              {mode === 'otp' && 'Phone OTP Login (Demo)'}
              {mode === 'reset' && 'Reset Password'}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {mode === 'login' && 'Enter your email and password, or use a quick demo button on the right.'}
              {mode === 'register' && 'Register a new account in under 30 seconds.'}
              {mode === 'otp' && 'Simulated OTP login so no real SMS or personal number is needed.'}
              {mode === 'reset' && 'Request a simulated reset code to set a new password.'}
            </p>

            {errorMsg && (
              <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {errorMsg}
              </div>
            )}

            {mode === 'login' && (
              <form onSubmit={handleEmailLogin} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium">Email</label>
                  <div className="relative mt-1">
                    <Mail className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-slate-400" />
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-9 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="login-password" className="block text-sm font-medium">Password</label>
                    <button
                      type="button"
                      onClick={() => { setMode('reset'); setErrorMsg(null); }}
                      className="text-xs font-medium text-[#16A34A] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative mt-1">
                    <KeyRound className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-slate-400" />
                    <input
                      id="login-password"
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-9 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-[44px] rounded-lg bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#16A34A] disabled:opacity-50"
                >
                  {busy ? 'Signing in...' : 'Sign In'}
                </button>

                <div className="grid grid-cols-1 gap-2.5 pt-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleGoogleSignIn}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-[#16A34A] dark:border-slate-700 dark:bg-[#0F172A] dark:text-slate-200"
                  >
                    Sign in with Google
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('otp'); setErrorMsg(null); }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-[#16A34A] dark:border-slate-700 dark:bg-[#0F172A] dark:text-slate-200"
                  >
                    <Smartphone className="h-3.5 w-3.5 text-[#16A34A]" />
                    <span>Phone OTP (Demo)</span>
                  </button>
                </div>

                <p className="pt-2 text-center text-sm text-slate-600 dark:text-slate-300">
                  New here?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setErrorMsg(null); }}
                    className="font-semibold text-[#16A34A] hover:underline"
                  >
                    Create an account
                  </button>
                </p>
              </form>
            )}

            {mode === 'register' && (
              <form onSubmit={handleRegister} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium">Full Name</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Your name"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Email</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium">Role</label>
                    <select
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value as PublicRegisterRole)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                    >
                      <option value="farmer">Farmer</option>
                      <option value="transporter">Transporter</option>
                      <option value="warehouse">Warehouse Manager</option>
                      <option value="retailer">Retailer</option>
                    </select>
                  </div>
                  {(regRole === 'farmer' || regRole === 'transporter') && (
                    <div>
                      <label className="block text-sm font-medium">Language</label>
                      <select
                        value={regLang}
                        onChange={(e) => setRegLang(e.target.value as FarmerLanguage)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                      >
                        <option value="en">English</option>
                        <option value="bn">বাংলা (Bengali)</option>
                        <option value="hi">हिन्दी (Hindi)</option>
                        <option value="as">অসমীয়া (Assamese)</option>
                        <option value="or">ଓଡ଼ିଆ (Odia)</option>
                        <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
                        <option value="mr">मराठी (Marathi)</option>
                        <option value="ta">தமிழ் (Tamil)</option>
                        <option value="te">తెలుగు (Telugu)</option>
                        <option value="gu">ગુજરાતી (Gujarati)</option>
                        <option value="kn">ಕನ್ನಡ (Kannada)</option>
                        <option value="ml">മലയാളം (Malayalam)</option>
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium">Password (min 8 characters)</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-[44px] rounded-lg bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#16A34A]"
                >
                  {busy ? 'Creating...' : 'Create Account'}
                </button>
                <p className="text-center text-sm text-slate-600 dark:text-slate-300">
                  Already have an account?{' '}
                  <button type="button" onClick={() => setMode('login')} className="font-semibold text-[#16A34A] hover:underline">
                    Sign In
                  </button>
                </p>
              </form>
            )}

            {mode === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium">Phone Number</label>
                  <div className="relative mt-1">
                    <Phone className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={otpPhone}
                      onChange={(e) => setOtpPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-9 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={busy}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold hover:border-[#16A34A] dark:border-slate-700"
                >
                  Get Demo OTP
                </button>
                {issuedDemoOtp && (
                  <div className="rounded-lg border border-[#16A34A]/40 bg-[#16A34A]/10 px-4 py-2.5 text-sm">
                    Demo OTP: <strong className="font-mono">{issuedDemoOtp}</strong>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium">6-Digit OTP</label>
                  <input
                    type="text"
                    required
                    minLength={6}
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-[44px] rounded-lg bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#16A34A]"
                >
                  Verify &amp; Sign In
                </button>
                <button type="button" onClick={() => setMode('login')} className="block w-full text-center text-xs font-semibold text-slate-500 hover:underline">
                  Back to Email Sign In
                </button>
              </form>
            )}

            {mode === 'reset' && (
              <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium">Account Email</label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRequestReset}
                  disabled={busy || !resetEmail}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold dark:border-slate-700"
                >
                  Generate Demo Reset Code
                </button>
                {issuedResetCode && (
                  <div className="rounded-lg border border-[#16A34A]/40 bg-[#16A34A]/10 px-4 py-2.5 text-sm">
                    Reset Code: <strong className="font-mono">{issuedResetCode}</strong>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="Reset code"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                  />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={resetNewPass}
                    onChange={(e) => setResetNewPass(e.target.value)}
                    placeholder="New password"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
                  />
                </div>
                <button type="submit" disabled={busy} className="w-full rounded-lg bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white">
                  Update Password
                </button>
                <button type="button" onClick={() => setMode('login')} className="block w-full text-center text-xs font-semibold text-slate-500 hover:underline">
                  Back to Sign In
                </button>
              </form>
            )}
          </div>

          {/* Simple One-Click Demo Launch Panel */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 md:col-span-5 dark:border-slate-800 dark:bg-[#1E293B]">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Quick Demo Access
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              One click to enter any role immediately. (Manual password: <span className="font-mono">Demo@2026!</span>)
            </p>

            <div className="mt-4 space-y-2.5">
              {DEMO_ROLE_DIRECTORY.map((item) => (
                <button
                  key={item.role}
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDemoRole(item.role)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-[#16A34A] hover:bg-[#14532D] hover:text-white disabled:opacity-50 dark:border-slate-700 dark:bg-[#0F172A]"
                >
                  <div>
                    <div className="font-display text-sm font-bold">{item.label}</div>
                    <div className="font-mono text-[11px] opacity-75">{item.email}</div>
                  </div>
                  <span className="text-xs font-semibold">Enter →</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
