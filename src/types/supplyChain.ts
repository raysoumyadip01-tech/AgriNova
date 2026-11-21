export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface Product {
  id: string;
  batch_id: string;
  farmer_id: string;
  farmer_name: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  harvest_date: string;
  shelf_life_days: number;
  origin: string;
  destination: string;
  storage_temp_c: number;
  storage_humidity_pct: number;
  current_temp_c: number;
  current_humidity_pct: number;
  transport_delay_hours: number;
  risk_score: number;
  risk_level: RiskLevel;
  explanations: string[];
  recommendations: string[];
  listed_for_sale: boolean;
  price_per_unit: number;
  image_url: string;
  status: string;
  created_at: string;
}

export interface ShipmentTimelineItem {
  status: string;
  time: string;
  note: string;
}

export interface Shipment {
  id: string;
  shipment_code: string;
  product_id: string;
  product_name: string;
  farmer_id: string;
  transporter_id: string | null;
  transporter_name: string;
  origin: string;
  origin_lat: number;
  origin_lng: number;
  destination: string;
  dest_lat: number;
  dest_lng: number;
  current_lat: number;
  current_lng: number;
  status: string;
  current_temp_c: number;
  current_humidity_pct: number;
  delay_hours: number;
  eta_hours: number;
  risk_level: RiskLevel;
  timeline: ShipmentTimelineItem[];
  created_at: string;
  updated_at: string;
}

export interface SpoilagePrediction {
  risk_score: number;
  risk_level: RiskLevel;
  explanations: string[];
  recommendations: string[];
  model_note: string;
}

export interface IotReading {
  id: string;
  shipment_id: string;
  device_id: string;
  temperature_c: number;
  humidity_pct: number;
  recorded_at: string;
  is_simulated: number;
}

export interface RedistributionItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  location: string;
  mode: 'ngo' | 'discount';
  ngo_name: string;
  discount_pct: number;
  status: 'Available' | 'Requested' | 'Dispatched' | 'Rescued';
  requested_by: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string | null;
  role_target: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  is_read: boolean;
  created_at: string;
}

export interface FarmerPayment {
  id: string;
  farmer_id: string;
  product_name: string;
  amount_inr: number;
  status: 'Paid' | 'Pending';
  buyer_name: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  user_name: string;
  role: string;
  subject: string;
  message: string;
  status: 'Open' | 'Resolved';
  created_at: string;
}

export interface WeatherData {
  source: string;
  latitude: number;
  longitude: number;
  temperature_c: number;
  humidity_pct: number;
  weather_code: number;
  updated_at: string;
}

export interface DashboardMetrics {
  total_users: number;
  total_products: number;
  total_inventory_kg: number;
  safe_stock_kg: number;
  at_risk_stock_kg: number;
  total_shipments: number;
  active_shipments: number;
  completed_shipments: number;
  estimated_food_saved_kg: number;
  estimated_value_inr: number;
}
