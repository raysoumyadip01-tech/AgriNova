export type UserRole = 'farmer' | 'transporter' | 'warehouse' | 'retailer' | 'admin';
export type PublicRegisterRole = 'farmer' | 'transporter' | 'warehouse' | 'retailer';
export type ThemeMode = 'light' | 'coffee' | 'dark' | 'system';
export type FarmerLanguage =
  | 'en'
  | 'bn'
  | 'hi'
  | 'as'
  | 'or'
  | 'pa'
  | 'mr'
  | 'ta'
  | 'te'
  | 'gu'
  | 'kn'
  | 'ml';

export interface User {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  language_preference: string;
  theme_preference: ThemeMode;
  auth_provider: string;
  location: string | null;
  is_demo: boolean;
  is_active: boolean;
  created_at: string;
}

export interface UserSession {
  id: string;
  device_info: string;
  ip_address: string | null;
  created_at: string;
  expires_at: string;
  revoked: boolean;
  is_current: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface DashboardOverview {
  user: User;
  rbac: {
    workspace_mode: string;
    multilingual_enabled: boolean;
    allowed_modules: string[];
  };
  phase: number;
}

export interface RoleMetadata {
  role: UserRole;
  label: string;
  email: string;
  summary: string;
  permissions: string[];
}

export const DEMO_ROLE_DIRECTORY: RoleMetadata[] = [
  {
    role: 'farmer',
    label: 'Farmer',
    email: 'farmer@agrinova.ai',
    summary: 'Simple multilingual workspace for crop registration, selling, choosing where to send trucks, and live car tracking.',
    permissions: ['Crop registration', 'Destination dispatch', 'Live truck tracking', 'Payment history', '12-language voice'],
  },
  {
    role: 'transporter',
    label: 'Transporter',
    email: 'transporter@agrinova.ai',
    summary: 'Multilingual (12 languages) fleet console for assigned dispatches, GPS routing, and cold-chain updates.',
    permissions: ['Assigned shipments', 'Delivery status updates', 'Temperature & humidity logs', 'Delay reporting', 'Multilingual UI'],
  },
  {
    role: 'warehouse',
    label: 'Warehouse Manager',
    email: 'warehouse@agrinova.ai',
    summary: 'English-only storage operations for inventory batches, chamber conditions, and spoilage risk checks.',
    permissions: ['Warehouse inventory', 'Storage condition monitoring', 'Expiry alerts', 'Inbound & outbound docks'],
  },
  {
    role: 'retailer',
    label: 'Retailer',
    email: 'retailer@agrinova.ai',
    summary: 'English-only store console for incoming produce, QR verification, freshness alerts, and surplus rescue.',
    permissions: ['Incoming shipments', 'Retail stock tracking', 'QR verification', 'Farmer payout settlement'],
  },
  {
    role: 'admin',
    label: 'System Admin',
    email: 'admin@agrinova.ai',
    summary: 'English-only governance console with full user management, RBAC oversight, and analytics.',
    permissions: ['User & role management', 'Global shipments', 'Platform analytics', 'Subscriptions & audit'],
  },
];
