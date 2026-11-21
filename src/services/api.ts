import type {
  AuthResponse,
  FarmerLanguage,
  PublicRegisterRole,
  ThemeMode,
  User,
  UserRole,
  UserSession,
} from '../types/auth';
import type {
  AppNotification,
  DashboardMetrics,
  FarmerPayment,
  IotReading,
  Product,
  RedistributionItem,
  Shipment,
  SpoilagePrediction,
  SupportTicket,
  WeatherData,
} from '../types/supplyChain';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';
const TOKEN_STORAGE_KEY = 'sfc_access_token';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }

  if (!res.ok) {
    const detail =
      typeof data === 'object' && data !== null && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : `Request failed with status ${res.status}`;
    throw new ApiError(res.status, detail);
  }

  return data as T;
}

export const api = {
  health: () => request<{ status: string; service: string; phase: number }>('/api/health'),

  // Auth
  register: (payload: {
    full_name: string;
    email: string;
    phone?: string;
    password: string;
    role: PublicRegisterRole;
    location?: string;
    language_preference?: FarmerLanguage;
  }) => request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),

  login: (payload: { email: string; password: string }) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),

  demoLogin: (role: UserRole) =>
    request<AuthResponse>('/api/auth/demo-login', { method: 'POST', body: JSON.stringify({ role }) }),

  firebaseLogin: (payload: {
    idToken: string;
    role?: PublicRegisterRole;
    language_preference?: FarmerLanguage;
  }) => request<AuthResponse>('/api/auth/firebase', { method: 'POST', body: JSON.stringify(payload) }),

  refreshSession: () => request<AuthResponse>('/api/auth/refresh', { method: 'POST' }),

  googleDemoLogin: (payload: { email: string; full_name: string; role: PublicRegisterRole }) =>
    request<AuthResponse>('/api/auth/google-demo', { method: 'POST', body: JSON.stringify(payload) }),

  requestOtpDemo: (payload: { phone: string; role: PublicRegisterRole }) =>
    request<{ simulated: boolean; message: string; demo_otp_code: string; phone: string }>(
      '/api/auth/otp/request-demo',
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  verifyOtpDemo: (payload: { phone: string; otp_code: string; role: PublicRegisterRole; full_name?: string }) =>
    request<AuthResponse>('/api/auth/otp/verify-demo', { method: 'POST', body: JSON.stringify(payload) }),

  forgotPassword: (email: string) =>
    request<{ message: string; simulated_reset_code: string | null }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (payload: { email: string; reset_code: string; new_password: string }) =>
    request<{ message: string }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(payload) }),

  logout: () => request<{ message: string }>('/api/auth/logout', { method: 'POST' }),
  me: () => request<User>('/api/auth/me'),

  updateProfile: (payload: {
    full_name?: string;
    phone?: string;
    location?: string;
    theme_preference?: ThemeMode;
    language_preference?: FarmerLanguage;
  }) => request<User>('/api/auth/profile', { method: 'PUT', body: JSON.stringify(payload) }),

  changePassword: (payload: { current_password: string; new_password: string }) =>
    request<{ message: string }>('/api/auth/change-password', { method: 'PUT', body: JSON.stringify(payload) }),

  listSessions: () => request<UserSession[]>('/api/auth/sessions'),
  revokeSession: (sessionId: string) =>
    request<{ message: string }>(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' }),

  deleteAccount: (payload: { confirmation: 'DELETE'; password?: string }) =>
    request<{ message: string }>('/api/auth/account', { method: 'DELETE', body: JSON.stringify(payload) }),

  // Dashboard & RBAC
  dashboardOverview: () => request<{ user: User; metrics: DashboardMetrics }>('/api/dashboard/overview'),
  checkFarmerRbac: () =>
    request<{ access: string; resource: string; verified_role: string; message: string }>('/api/rbac/farmer/summary'),
  checkSupplyChainRbac: () =>
    request<{ access: string; resource: string; verified_role: string; message: string }>(
      '/api/rbac/supply-chain/summary',
    ),
  adminListUsers: () => request<User[]>('/api/rbac/admin/users'),
  adminUpdateUserRole: (userId: string, role: UserRole) =>
    request<User>(`/api/rbac/admin/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),

  // Products / Farmer Crops
  listProducts: () => request<Product[]>('/api/products'),
  createProduct: (payload: {
    name: string;
    category: string;
    quantity: number;
    unit?: string;
    harvest_date?: string;
    origin?: string;
    destination?: string;
    current_temp_c?: number;
    current_humidity_pct?: number;
    listed_for_sale?: boolean;
    price_per_unit?: number;
    image_url?: string;
  }) => request<Product>('/api/products', { method: 'POST', body: JSON.stringify(payload) }),
  updateProduct: (
    productId: string,
    payload: Partial<{
      name: string;
      category: string;
      quantity: number;
      current_temp_c: number;
      current_humidity_pct: number;
      transport_delay_hours: number;
      listed_for_sale: boolean;
      price_per_unit: number;
      status: string;
    }>,
  ) => request<Product>(`/api/products/${productId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteProduct: (productId: string) =>
    request<{ message: string }>(`/api/products/${productId}`, { method: 'DELETE' }),

  // Shipments & Tracking
  listTransporters: () =>
    request<Array<{ id: string; full_name: string; location: string | null }>>('/api/transporters'),
  listShipments: () => request<Shipment[]>('/api/shipments'),
  lookupShipment: (code: string) =>
    request<{ shipment: Shipment; product: Product | null }>(`/api/shipments/lookup/${encodeURIComponent(code)}`),
  createShipment: (payload: {
    product_id: string;
    destination?: string;
    transporter_name?: string;
    current_temp_c?: number;
    current_humidity_pct?: number;
    dest_lat?: number;
    dest_lng?: number;
  }) => request<Shipment>('/api/shipments', { method: 'POST', body: JSON.stringify(payload) }),
  advanceLiveShipment: (shipmentId: string) =>
    request<Shipment>(`/api/shipments/${shipmentId}/advance-live`, { method: 'POST' }),
  updateShipment: (
    shipmentId: string,
    payload: {
      status?: string;
      current_temp_c?: number;
      current_humidity_pct?: number;
      delay_hours?: number;
      note?: string;
      advance_gps?: boolean;
    },
  ) => request<Shipment>(`/api/shipments/${shipmentId}/update`, { method: 'PUT', body: JSON.stringify(payload) }),

  // AI Spoilage & IoT
  predictSpoilage: (payload: {
    category: string;
    temperature_c: number;
    humidity_pct: number;
    storage_hours?: number;
    transport_delay_hours?: number;
  }) => request<SpoilagePrediction>('/api/ai/predict-spoilage', { method: 'POST', body: JSON.stringify(payload) }),

  listIotReadings: (shipmentId: string) =>
    request<IotReading[]>(`/api/iot/readings?shipment_id=${encodeURIComponent(shipmentId)}`),
  simulateIotReading: (payload: { shipment_id: string; temperature_c?: number; humidity_pct?: number }) =>
    request<IotReading>('/api/iot/simulate', { method: 'POST', body: JSON.stringify(payload) }),

  // Redistribution, Payments, Notifications, Tickets, Weather
  listRedistributions: () => request<RedistributionItem[]>('/api/redistributions'),
  createRedistribution: (payload: { product_id: string; mode: 'ngo' | 'discount'; ngo_name: string; discount_pct?: number }) =>
    request<RedistributionItem>('/api/redistributions', { method: 'POST', body: JSON.stringify(payload) }),
  updateRedistributionStatus: (id: string, status: string) =>
    request<RedistributionItem>(`/api/redistributions/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  listPayments: () => request<FarmerPayment[]>('/api/payments'),
  settlePayment: (id: string) => request<FarmerPayment>(`/api/payments/${id}/settle`, { method: 'PUT' }),

  synthesizeSpeech: (payload: { text: string; language: string }) =>
    request<{ audio_base64: string; mime_type: string; language: string }>('/api/tts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  transcribeAudio: (payload: { audio_base64: string; mime_type: string; language: string }) =>
    request<{ transcript: string }>('/api/transcribe', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listNotifications: () => request<AppNotification[]>('/api/notifications'),
  markAllNotificationsRead: () => request<{ message: string }>('/api/notifications/read-all', { method: 'PUT' }),
  deleteNotification: (id: string) => request<{ message: string }>(`/api/notifications/${id}`, { method: 'DELETE' }),

  listTickets: () => request<SupportTicket[]>('/api/tickets'),
  createTicket: (payload: { subject: string; message: string }) =>
    request<SupportTicket>('/api/tickets', { method: 'POST', body: JSON.stringify(payload) }),

  getWeather: (lat: number, lng: number) => request<WeatherData>(`/api/weather?lat=${lat}&lng=${lng}`),

  geminiChat: (payload: {
    message: string;
    history: Array<{ role: 'user' | 'model'; text: string }>;
    model?: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
    language?: string;
  }) =>
    request<{ reply: string; model: string }>('/api/gemini/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
