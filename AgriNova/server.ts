import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { verifyFirebaseIdToken } from './src/lib/firebase-admin.ts';

dotenv.config();

const geminiAi = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

const PORT = Number(process.env.PORT || 3000);
const SECRET_KEY = process.env.SECRET_KEY || 'dev-smartfoodchain-change-in-production-key';
const USE_PYTHON_BACKEND = process.env.USE_PYTHON_BACKEND === 'true';
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000';
const DB_PATH = path.resolve(process.cwd(), 'smartfoodchain.db');

type UserRole = 'farmer' | 'transporter' | 'warehouse' | 'retailer' | 'admin';
type ThemeMode = 'light' | 'coffee' | 'dark' | 'system';
type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  role: UserRole;
  language_preference: string;
  theme_preference: ThemeMode;
  auth_provider: string;
  location: string | null;
  is_demo: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  token_jti: string;
  device_info: string;
  ip_address: string | null;
  created_at: string;
  expires_at: string;
  revoked: number;
}

interface ProductRow {
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
  explanations_json: string;
  recommendations_json: string;
  listed_for_sale: number;
  price_per_unit: number;
  image_url: string;
  status: string;
  created_at: string;
}

interface ShipmentRow {
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
  timeline_json: string;
  created_at: string;
  updated_at: string;
}

interface AuthRequest extends Request {
  authUser?: UserRow;
  authJti?: string;
}

const VALID_ROLES = new Set<UserRole>(['farmer', 'transporter', 'warehouse', 'retailer', 'admin']);
const PUBLIC_ROLES = new Set<UserRole>(['farmer', 'transporter', 'warehouse', 'retailer']);
const MULTILINGUAL_ROLES = new Set<UserRole>(['farmer', 'transporter']);
const VALID_THEMES = new Set<ThemeMode>(['light', 'coffee', 'dark', 'system']);
const FARMER_LANGS = new Set(['en', 'bn', 'hi', 'as', 'or', 'pa', 'mr', 'ta', 'te', 'gu', 'kn', 'ml']);

const DEMO_USER_SEEDS: Array<{
  full_name: string;
  email: string;
  legacyEmail: string;
  phone: string;
  role: UserRole;
  language_preference: string;
  location: string;
}> = [
  {
    full_name: 'Ramesh Mandal',
    email: 'farmer@agrinova.ai',
    legacyEmail: 'farmer@smartfoodchain.ai',
    phone: '+919800010001',
    role: 'farmer',
    language_preference: 'bn',
    location: 'Hooghly, West Bengal, India',
  },
  {
    full_name: 'Vikram Logistics Fleet',
    email: 'transporter@agrinova.ai',
    legacyEmail: 'transporter@smartfoodchain.ai',
    phone: '+919800010002',
    role: 'transporter',
    language_preference: 'en',
    location: 'Kolkata Hub, West Bengal, India',
  },
  {
    full_name: 'Ananya Cold Storage',
    email: 'warehouse@agrinova.ai',
    legacyEmail: 'warehouse@smartfoodchain.ai',
    phone: '+919800010003',
    role: 'warehouse',
    language_preference: 'en',
    location: 'Siliguri Depot, West Bengal, India',
  },
  {
    full_name: 'GreenBasket Fresh Mart',
    email: 'retailer@agrinova.ai',
    legacyEmail: 'retailer@smartfoodchain.ai',
    phone: '+919800010004',
    role: 'retailer',
    language_preference: 'en',
    location: 'Bengaluru Central, Karnataka, India',
  },
  {
    full_name: 'Arjun Sen (System Admin)',
    email: 'admin@agrinova.ai',
    legacyEmail: 'admin@smartfoodchain.ai',
    phone: '+919800010005',
    role: 'admin',
    language_preference: 'en',
    location: 'AgriNova HQ, Kolkata, India',
  },
];

const DESTINATION_HUBS: Record<string, { lat: number; lng: number }> = {
  'siliguri cold storage depot': { lat: 26.7271, lng: 88.3953 },
  'kolkata north agri hub': { lat: 22.615, lng: 88.405 },
  'kolkata central market': { lat: 22.5726, lng: 88.3639 },
  'howrah wholesale mandi': { lat: 22.5958, lng: 88.2636 },
  'howrah wholesale yard': { lat: 22.5958, lng: 88.2636 },
  'burdwan cold chain center': { lat: 23.2324, lng: 87.8615 },
  'greenbasket fresh mart (bengaluru)': { lat: 12.9716, lng: 77.5946 },
  'annapurna food rescue (ngo)': { lat: 22.5626, lng: 88.3539 },
};
const LANG_NAMES: Record<string, string> = {
  en: 'English',
  bn: 'Bengali',
  hi: 'Hindi',
  as: 'Assamese',
  or: 'Odia',
  pa: 'Punjabi',
  mr: 'Marathi',
  ta: 'Tamil',
  te: 'Telugu',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
};
const VALID_SHIPMENT_STATUSES = [
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

const CATEGORY_BASELINES: Record<
  string,
  { minT: number; maxT: number; minH: number; maxH: number; maxDays: number; sensitivity: number }
> = {
  tomato: { minT: 10, maxT: 15, minH: 80, maxH: 90, maxDays: 10, sensitivity: 1.35 },
  mango: { minT: 10, maxT: 14, minH: 85, maxH: 92, maxDays: 12, sensitivity: 1.25 },
  banana: { minT: 13, maxT: 15, minH: 85, maxH: 95, maxDays: 10, sensitivity: 1.3 },
  potato: { minT: 4, maxT: 10, minH: 85, maxH: 95, maxDays: 60, sensitivity: 0.75 },
  onion: { minT: 0, maxT: 8, minH: 65, maxH: 75, maxDays: 90, sensitivity: 0.65 },
  rice: { minT: 10, maxT: 22, minH: 50, maxH: 65, maxDays: 180, sensitivity: 0.4 },
  wheat: { minT: 10, maxT: 22, minH: 50, maxH: 65, maxDays: 180, sensitivity: 0.4 },
};

function predictSpoilage(params: {
  category: string;
  temperature_c: number;
  humidity_pct: number;
  storage_hours?: number;
  transport_delay_hours?: number;
}) {
  const key = params.category.trim().toLowerCase();
  const base = CATEGORY_BASELINES[key] || CATEGORY_BASELINES.tomato;
  const storageHours = params.storage_hours ?? 12;
  const delayHours = params.transport_delay_hours ?? 0;

  let score = 8;
  const explanations: string[] = [];
  const recommendations: string[] = [];

  if (params.temperature_c > base.maxT) {
    const excess = params.temperature_c - base.maxT;
    score += Math.min(45, excess * 2.4 * base.sensitivity);
    explanations.push(
      `Temperature (${params.temperature_c.toFixed(1)}°C) exceeds safe range (${base.minT}–${base.maxT}°C) by ${excess.toFixed(1)}°C.`,
    );
    recommendations.push(`Lower cooling chamber or reefer setpoint toward ${base.maxT}°C immediately.`);
  } else if (params.temperature_c < base.minT) {
    const deficit = base.minT - params.temperature_c;
    score += Math.min(28, deficit * 2.0 * base.sensitivity);
    explanations.push(`Temperature (${params.temperature_c.toFixed(1)}°C) is below safe range, risking chilling injury.`);
    recommendations.push(`Raise storage temperature above ${base.minT}°C to avoid cold damage.`);
  }

  if (params.humidity_pct > base.maxH) {
    const humExcess = params.humidity_pct - base.maxH;
    score += Math.min(20, humExcess * 1.1);
    explanations.push(`High humidity (${params.humidity_pct.toFixed(0)}%) increases fungal/mold growth risk.`);
    recommendations.push('Increase crate ventilation or activate dehumidifier airflow.');
  } else if (params.humidity_pct < base.minH) {
    const humDef = base.minH - params.humidity_pct;
    score += Math.min(16, humDef * 0.7);
    explanations.push(`Low humidity (${params.humidity_pct.toFixed(0)}%) accelerates moisture loss and wilting.`);
    recommendations.push('Use breathable moisture-retaining crate liners.');
  }

  if (delayHours > 0) {
    score += Math.min(28, delayHours * 4.5 * base.sensitivity);
    explanations.push(`Transit delay of ${delayHours.toFixed(1)} hours increases cumulative thermal stress.`);
    recommendations.push('Prioritize express dispatch or divert to nearest cold hub.');
  }

  const ageRatio = Math.min(1, Math.max(0, storageHours / (base.maxDays * 24)));
  score += ageRatio * 22;
  if (ageRatio > 0.55) {
    explanations.push(`Batch has elapsed ${Math.round(ageRatio * 100)}% of expected shelf window.`);
    recommendations.push('Schedule priority retail markdown or NGO food rescue.');
  }

  const risk_score = Math.max(1, Math.min(99, Math.round(score)));
  let risk_level: RiskLevel = 'Low';
  if (risk_score >= 75) {
    risk_level = 'Critical';
    recommendations.push('Urgent: Divert immediately to discounted sale or NGO food rescue within 6 hours.');
  } else if (risk_score >= 52) {
    risk_level = 'High';
    recommendations.push('Inspect crates upon arrival and prioritize first-out dispatch.');
  } else if (risk_score >= 28) {
    risk_level = 'Medium';
    recommendations.push('Increase sensor checks to every 30 minutes.');
  } else {
    if (explanations.length === 0) {
      explanations.push('Temperature, humidity, and transit schedule are within optimal cold-chain limits.');
    }
    if (recommendations.length === 0) {
      recommendations.push('Maintain current cold-chain settings and standard dispatch queue.');
    }
  }

  return {
    risk_score,
    risk_level,
    explanations,
    recommendations: Array.from(new Set(recommendations)),
    model_note: 'Transparent rule-based baseline calibrated by produce category (ready for historical IoT training).',
  };
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hashHex] = parts;
  const derived = crypto.scryptSync(plain, salt, 64);
  const expected = Buffer.from(hashHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function signJwt(payload: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(
    crypto.createHmac('sha256', SECRET_KEY).update(`${header}.${body}`).digest(),
  );
  return `${header}.${body}.${signature}`;
}

function verifyJwt(token: string): Record<string, unknown> | null {
  const segments = token.split('.');
  if (segments.length !== 3) return null;
  const [header, body, sig] = segments;
  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', SECRET_KEY).update(`${header}.${body}`).digest(),
  );
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(body)) as Record<string, unknown>;
    if (typeof parsed.exp === 'number' && parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function sanitizeUser(row: UserRow) {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    language_preference: row.language_preference,
    theme_preference: row.theme_preference,
    auth_provider: row.auth_provider,
    location: row.location,
    is_demo: Boolean(row.is_demo),
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
  };
}

function formatProduct(row: ProductRow) {
  return {
    ...row,
    listed_for_sale: Boolean(row.listed_for_sale),
    explanations: JSON.parse(row.explanations_json || '[]') as string[],
    recommendations: JSON.parse(row.recommendations_json || '[]') as string[],
  };
}

function formatShipment(row: ShipmentRow) {
  return {
    ...row,
    timeline: JSON.parse(row.timeline_json || '[]') as Array<{ status: string; time: string; note: string }>,
  };
}

function enforceRoleLanguage(role: UserRole, requested?: string | null): string {
  if (MULTILINGUAL_ROLES.has(role) && requested && FARMER_LANGS.has(requested)) {
    return requested;
  }
  return 'en';
}

interface DbStatement {
  run: (...params: unknown[]) => { changes?: number | bigint; lastInsertRowid?: number | bigint };
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
}

interface DbLike {
  exec: (sql: string) => void;
  prepare: (sql: string) => DbStatement;
}

async function openCompatibleSqlite(dbPath: string): Promise<DbLike> {
  if (process.env.FORCE_SQLJS !== '1') {
    try {
      const mod = (await import('node:sqlite')) as { DatabaseSync: new (p: string) => DbLike };
      return new mod.DatabaseSync(dbPath);
    } catch {
      // Fallback below for Node 18 / 20 / early 22 on Windows 11 where node:sqlite is absent
    }
  }
  const sqlModule = await import('sql.js');
  const initSqlJs = sqlModule.default;
  const wasmDir = path.resolve(process.cwd(), 'node_modules', 'sql.js', 'dist');
  const SQL = await initSqlJs({
    locateFile: (file: string) => path.join(wasmDir, file),
    useOldExtensionFunctions: false,
  });
  const existingBytes = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : undefined;
  const sqlDb = existingBytes && existingBytes.length > 0 ? new SQL.Database(existingBytes) : new SQL.Database();
  const flush = () => {
    fs.writeFileSync(dbPath, Buffer.from(sqlDb.export()));
  };
  const sanitize = (params: unknown[]) =>
    params.map((v) => (v === undefined ? null : v)) as Array<string | number | null | Uint8Array>;

  return {
    exec: (sql: string) => {
      sqlDb.run(sql);
      flush();
    },
    prepare: (sql: string) => ({
      run: (...params: unknown[]) => {
        const stmt = sqlDb.prepare(sql);
        const bound = sanitize(params);
        try {
          if (bound.length > 0) stmt.run(bound);
          else stmt.run();
        } finally {
          stmt.free();
        }
        flush();
        return { changes: sqlDb.getRowsModified() };
      },
      get: (...params: unknown[]) => {
        const stmt = sqlDb.prepare(sql);
        const bound = sanitize(params);
        try {
          if (bound.length > 0) stmt.bind(bound);
          if (!stmt.step()) return undefined;
          return stmt.getAsObject();
        } finally {
          stmt.free();
        }
      },
      all: (...params: unknown[]) => {
        const stmt = sqlDb.prepare(sql);
        const bound = sanitize(params);
        try {
          if (bound.length > 0) stmt.bind(bound);
          const rows: unknown[] = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          return rows;
        } finally {
          stmt.free();
        }
      },
    }),
  };
}

async function initDatabase(): Promise<DbLike> {
  const db = await openCompatibleSqlite(DB_PATH);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'farmer',
      language_preference TEXT NOT NULL DEFAULT 'en',
      theme_preference TEXT NOT NULL DEFAULT 'system',
      auth_provider TEXT NOT NULL DEFAULT 'email',
      location TEXT DEFAULT 'India',
      is_demo INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_jti TEXT UNIQUE NOT NULL,
      device_info TEXT NOT NULL DEFAULT 'Web Browser',
      ip_address TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      reset_code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      batch_id TEXT UNIQUE NOT NULL,
      farmer_id TEXT NOT NULL,
      farmer_name TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT 'kg',
      harvest_date TEXT NOT NULL,
      shelf_life_days INTEGER NOT NULL DEFAULT 10,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      storage_temp_c REAL NOT NULL DEFAULT 12,
      storage_humidity_pct REAL NOT NULL DEFAULT 85,
      current_temp_c REAL NOT NULL DEFAULT 12,
      current_humidity_pct REAL NOT NULL DEFAULT 85,
      transport_delay_hours REAL NOT NULL DEFAULT 0,
      risk_score INTEGER NOT NULL DEFAULT 15,
      risk_level TEXT NOT NULL DEFAULT 'Low',
      explanations_json TEXT NOT NULL DEFAULT '[]',
      recommendations_json TEXT NOT NULL DEFAULT '[]',
      listed_for_sale INTEGER NOT NULL DEFAULT 0,
      price_per_unit REAL NOT NULL DEFAULT 30,
      image_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Stored',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shipments (
      id TEXT PRIMARY KEY,
      shipment_code TEXT UNIQUE NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      farmer_id TEXT NOT NULL,
      transporter_id TEXT,
      transporter_name TEXT NOT NULL,
      origin TEXT NOT NULL,
      origin_lat REAL NOT NULL,
      origin_lng REAL NOT NULL,
      destination TEXT NOT NULL,
      dest_lat REAL NOT NULL,
      dest_lng REAL NOT NULL,
      current_lat REAL NOT NULL,
      current_lng REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Created',
      current_temp_c REAL NOT NULL DEFAULT 12,
      current_humidity_pct REAL NOT NULL DEFAULT 85,
      delay_hours REAL NOT NULL DEFAULT 0,
      eta_hours REAL NOT NULL DEFAULT 6,
      risk_level TEXT NOT NULL DEFAULT 'Low',
      timeline_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS iot_readings (
      id TEXT PRIMARY KEY,
      shipment_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      temperature_c REAL NOT NULL,
      humidity_pct REAL NOT NULL,
      recorded_at TEXT NOT NULL,
      is_simulated INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS redistributions (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      location TEXT NOT NULL,
      mode TEXT NOT NULL,
      ngo_name TEXT NOT NULL,
      discount_pct INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Available',
      requested_by TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      role_target TEXT NOT NULL DEFAULT 'all',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      farmer_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      amount_inr REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      buyer_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      role TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open',
      created_at TEXT NOT NULL
    );
  `);

  const now = new Date().toISOString();
  const insertUser = db.prepare(`
    INSERT INTO users (
      id, full_name, email, phone, password_hash, role,
      language_preference, theme_preference, auth_provider,
      location, is_demo, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'coffee', 'email', ?, 1, 1, ?, ?)
  `);

  for (const item of DEMO_USER_SEEDS) {
    const existing = db
      .prepare('SELECT id FROM users WHERE email = ? OR email = ?')
      .get(item.email, item.legacyEmail);
    if (!existing) {
      const phoneTaken = db.prepare('SELECT id FROM users WHERE phone = ?').get(item.phone);
      insertUser.run(
        crypto.randomUUID(),
        item.full_name,
        item.email,
        phoneTaken ? null : item.phone,
        hashPassword('Demo@2026!'),
        item.role,
        item.language_preference,
        item.location,
        now,
        now,
      );
    }
  }

  // Seed realistic supply chain data once
  const prodCount = (db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }).c;
  if (prodCount === 0) {
    const farmer = db
      .prepare("SELECT id, full_name FROM users WHERE role = 'farmer' ORDER BY is_demo DESC LIMIT 1")
      .get() as { id: string; full_name: string };
    const transporter = db
      .prepare("SELECT id, full_name FROM users WHERE role = 'transporter' ORDER BY is_demo DESC LIMIT 1")
      .get() as { id: string; full_name: string };

    const seedProducts = [
      {
        id: 'prod-101',
        batch_id: 'BCH-TOM-101',
        name: 'Vine Tomatoes (Grade A)',
        category: 'Tomato',
        quantity: 450,
        unit: 'kg',
        harvest_date: '2026-11-18',
        shelf_life_days: 10,
        origin: 'Hooghly Farm Cluster',
        destination: 'Kolkata Central Market',
        temp: 12.5,
        hum: 84,
        delay: 0,
        listed: 1,
        price: 32,
        image: '/src/assets/images/farmer_mobile_harvest_1795105201987.jpg',
        status: 'In Transit',
      },
      {
        id: 'prod-102',
        batch_id: 'BCH-TOM-102',
        name: 'Roma Tomatoes (Warm Lot)',
        category: 'Tomato',
        quantity: 280,
        unit: 'kg',
        harvest_date: '2026-11-16',
        shelf_life_days: 8,
        origin: 'Hooghly Farm Cluster',
        destination: 'Howrah Wholesale Yard',
        temp: 31.0,
        hum: 86,
        delay: 5.0,
        listed: 1,
        price: 22,
        image: '/src/assets/images/farmer_mobile_harvest_1795105201987.jpg',
        status: 'At Risk',
      },
      {
        id: 'prod-103',
        batch_id: 'BCH-MNG-103',
        name: 'Himsagar Mangoes',
        category: 'Mango',
        quantity: 620,
        unit: 'kg',
        harvest_date: '2026-11-17',
        shelf_life_days: 12,
        origin: 'Malda Orchard Coop',
        destination: 'Siliguri Cold Hub',
        temp: 13.0,
        hum: 88,
        delay: 1.0,
        listed: 1,
        price: 78,
        image: '/src/assets/images/hero_supply_chain_1795105202293.jpg',
        status: 'At Warehouse',
      },
      {
        id: 'prod-104',
        batch_id: 'BCH-POT-104',
        name: 'Jyoti Potatoes',
        category: 'Potato',
        quantity: 1200,
        unit: 'kg',
        harvest_date: '2026-11-12',
        shelf_life_days: 60,
        origin: 'Bardhaman Growers',
        destination: 'Bengaluru Retail DC',
        temp: 7.2,
        hum: 89,
        delay: 0,
        listed: 0,
        price: 24,
        image: '/src/assets/images/cold_storage_warehouse_1795105201955.jpg',
        status: 'Stored',
      },
      {
        id: 'prod-105',
        batch_id: 'BCH-BAN-105',
        name: 'Martaman Bananas',
        category: 'Banana',
        quantity: 340,
        unit: 'kg',
        harvest_date: '2026-11-15',
        shelf_life_days: 9,
        origin: 'Nadia Farm Unit',
        destination: 'Kolkata North Hub',
        temp: 24.5,
        hum: 91,
        delay: 2.5,
        listed: 1,
        price: 40,
        image: '/src/assets/images/farmer_mobile_harvest_1795105201987.jpg',
        status: 'Near Expiry',
      },
      {
        id: 'prod-106',
        batch_id: 'BCH-RIC-106',
        name: 'Gobindobhog Rice',
        category: 'Rice',
        quantity: 1800,
        unit: 'kg',
        harvest_date: '2026-11-05',
        shelf_life_days: 180,
        origin: 'Purba Bardhaman',
        destination: 'GreenBasket Mart',
        temp: 18.0,
        hum: 58,
        delay: 0,
        listed: 1,
        price: 64,
        image: '/src/assets/images/cold_storage_warehouse_1795105201955.jpg',
        status: 'Delivered',
      },
    ];

    const insertProd = db.prepare(`
      INSERT INTO products (
        id, batch_id, farmer_id, farmer_name, name, category, quantity, unit,
        harvest_date, shelf_life_days, origin, destination, storage_temp_c, storage_humidity_pct,
        current_temp_c, current_humidity_pct, transport_delay_hours, risk_score, risk_level,
        explanations_json, recommendations_json, listed_for_sale, price_per_unit, image_url, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of seedProducts) {
      const ai = predictSpoilage({
        category: p.category,
        temperature_c: p.temp,
        humidity_pct: p.hum,
        storage_hours: 36,
        transport_delay_hours: p.delay,
      });
      insertProd.run(
        p.id,
        p.batch_id,
        farmer.id,
        farmer.full_name,
        p.name,
        p.category,
        p.quantity,
        p.unit,
        p.harvest_date,
        p.shelf_life_days,
        p.origin,
        p.destination,
        12,
        85,
        p.temp,
        p.hum,
        p.delay,
        ai.risk_score,
        ai.risk_level,
        JSON.stringify(ai.explanations),
        JSON.stringify(ai.recommendations),
        p.listed,
        p.price,
        p.image,
        p.status,
        now,
      );
    }

    const insertShip = db.prepare(`
      INSERT INTO shipments (
        id, shipment_code, product_id, product_name, farmer_id, transporter_id, transporter_name,
        origin, origin_lat, origin_lng, destination, dest_lat, dest_lng, current_lat, current_lng,
        status, current_temp_c, current_humidity_pct, delay_hours, eta_hours, risk_level, timeline_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedShipments = [
      {
        id: 'ship-101',
        code: 'SFC-2026-101',
        prodId: 'prod-101',
        prodName: 'Vine Tomatoes (Grade A) · 450 kg',
        origin: 'Hooghly, WB',
        oLat: 22.9089,
        oLng: 88.3967,
        dest: 'Kolkata Central Market',
        dLat: 22.5726,
        dLng: 88.3639,
        cLat: 22.74,
        cLng: 88.38,
        status: 'In Transit',
        temp: 12.5,
        hum: 84,
        delay: 0,
        eta: 1.5,
        risk: 'Low',
        timeline: [
          { status: 'Created', time: '06:30 AM', note: 'Batch registered by Ramesh Mandal' },
          { status: 'Picked Up', time: '07:45 AM', note: 'Loaded into reefer van WB-09-TR-4412' },
          { status: 'In Transit', time: '09:10 AM', note: 'Cold-chain steady at 12.5°C' },
        ],
      },
      {
        id: 'ship-102',
        code: 'SFC-2026-102',
        prodId: 'prod-102',
        prodName: 'Roma Tomatoes (Warm Lot) · 280 kg',
        origin: 'Hooghly, WB',
        oLat: 22.9089,
        oLng: 88.3967,
        dest: 'Howrah Wholesale Yard',
        dLat: 22.5958,
        dLng: 88.2636,
        cLat: 22.71,
        cLng: 88.31,
        status: 'Delayed',
        temp: 31.0,
        hum: 86,
        delay: 5.0,
        eta: 3.5,
        risk: 'Critical',
        timeline: [
          { status: 'Created', time: '05:00 AM', note: 'Batch registered' },
          { status: 'In Transit', time: '06:20 AM', note: 'Departed Hooghly' },
          { status: 'Delayed', time: '11:20 AM', note: '5h highway congestion · Cooling fan alert triggered' },
        ],
      },
      {
        id: 'ship-103',
        code: 'SFC-2026-103',
        prodId: 'prod-103',
        prodName: 'Himsagar Mangoes · 620 kg',
        origin: 'Malda, WB',
        oLat: 25.0108,
        oLng: 88.1411,
        dest: 'Siliguri Cold Hub',
        dLat: 26.7271,
        dLng: 88.3953,
        cLat: 26.7271,
        cLng: 88.3953,
        status: 'At Warehouse',
        temp: 13.0,
        hum: 88,
        delay: 1.0,
        eta: 0,
        risk: 'Medium',
        timeline: [
          { status: 'Created', time: 'Yesterday', note: 'Orchard harvest verified' },
          { status: 'In Transit', time: 'Yesterday', note: 'NH-12 route' },
          { status: 'At Warehouse', time: '08:00 AM', note: 'Stored in Siliguri Chamber B2' },
        ],
      },
      {
        id: 'ship-104',
        code: 'SFC-2026-104',
        prodId: 'prod-106',
        prodName: 'Gobindobhog Rice · 1800 kg',
        origin: 'Bardhaman, WB',
        oLat: 23.2324,
        oLng: 87.8615,
        dest: 'GreenBasket Mart, Bengaluru',
        dLat: 12.9716,
        dLng: 77.5946,
        cLat: 12.9716,
        cLng: 77.5946,
        status: 'Delivered',
        temp: 18.0,
        hum: 58,
        delay: 0,
        eta: 0,
        risk: 'Low',
        timeline: [
          { status: 'Created', time: 'Nov 14', note: 'Dry grain lot packed' },
          { status: 'Out for Delivery', time: 'Nov 17', note: 'Arrived Bengaluru hub' },
          { status: 'Delivered', time: 'Nov 18', note: 'Received by GreenBasket Fresh Mart' },
        ],
      },
    ];

    for (const s of seedShipments) {
      insertShip.run(
        s.id,
        s.code,
        s.prodId,
        s.prodName,
        farmer.id,
        transporter.id,
        transporter.full_name,
        s.origin,
        s.oLat,
        s.oLng,
        s.dest,
        s.dLat,
        s.dLng,
        s.cLat,
        s.cLng,
        s.status,
        s.temp,
        s.hum,
        s.delay,
        s.eta,
        s.risk,
        JSON.stringify(s.timeline),
        now,
        now,
      );
    }

    // Seed simulated IoT readings
    const insertIot = db.prepare(
      'INSERT INTO iot_readings (id, shipment_id, device_id, temperature_c, humidity_pct, recorded_at, is_simulated) VALUES (?, ?, ?, ?, ?, ?, 1)',
    );
    const iotSamples = [
      ['ship-101', 'ESP32-VAN-01', 12.1, 83, '08:00'],
      ['ship-101', 'ESP32-VAN-01', 12.4, 84, '09:00'],
      ['ship-101', 'ESP32-VAN-01', 12.5, 84, '10:00'],
      ['ship-102', 'ESP32-VAN-02', 24.5, 82, '08:00'],
      ['ship-102', 'ESP32-VAN-02', 28.8, 85, '09:30'],
      ['ship-102', 'ESP32-VAN-02', 31.0, 86, '11:00'],
    ];
    for (const [sid, dev, t, h, tm] of iotSamples) {
      insertIot.run(crypto.randomUUID(), sid, dev, t, h, `Today ${tm}`, );
    }

    // Seed Food Redistribution & NGO connections
    const insertRedist = db.prepare(`
      INSERT INTO redistributions (id, product_id, product_name, quantity, unit, location, mode, ngo_name, discount_pct, status, requested_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertRedist.run(
      'red-101',
      'prod-102',
      'Roma Tomatoes (Warm Lot)',
      280,
      'kg',
      'Howrah Wholesale Yard',
      'ngo',
      'Annapurna Food Rescue (Demo NGO)',
      0,
      'Available',
      '',
      now,
    );
    insertRedist.run(
      'red-102',
      'prod-105',
      'Martaman Bananas',
      340,
      'kg',
      'Kolkata North Hub',
      'discount',
      'GreenHope Community Mart (Demo)',
      45,
      'Requested',
      'GreenHope Community Mart',
      now,
    );

    // Seed Farmer Payments
    const insertPay = db.prepare(
      'INSERT INTO payments (id, farmer_id, product_name, amount_inr, status, buyer_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    insertPay.run('pay-101', farmer.id, 'Gobindobhog Rice · 1800 kg', 115200, 'Paid', 'GreenBasket Fresh Mart', '2026-11-18');
    insertPay.run('pay-102', farmer.id, 'Vine Tomatoes (Grade A) · 450 kg', 14400, 'Pending', 'Kolkata Central Market', '2026-11-19');

    // Seed Alerts / Notifications
    const insertNotif = db.prepare(
      'INSERT INTO notifications (id, user_id, role_target, title, message, severity, is_read, created_at) VALUES (?, NULL, ?, ?, ?, ?, 0, ?)',
    );
    insertNotif.run(
      'notif-1',
      'all',
      'Critical Spoilage Risk: Roma Tomatoes (SFC-2026-102)',
      'Temperature reached 31.0°C with 86% humidity and a 5h transit delay. Immediate NGO rescue or local discount recommended.',
      'critical',
      now,
    );
    insertNotif.run(
      'notif-2',
      'farmer',
      'Payment Pending: ₹14,400 for Vine Tomatoes',
      'Your Vine Tomatoes shipment SFC-2026-101 is in transit to Kolkata Central Market.',
      'info',
      now,
    );
  }

  return db;
}

const demoOtpStore = new Map<string, { code: string; role: UserRole; expiresAt: number }>();
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function authRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = `${req.ip || 'local'}:${req.path}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  if (bucket.count >= 60) {
    return res.status(429).json({ detail: 'Too many requests. Please wait a minute and try again.' });
  }
  bucket.count += 1;
  return next();
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '5mb' }));

  if (USE_PYTHON_BACKEND) {
    app.use('/api', async (req: Request, res: Response) => {
      try {
        const targetUrl = `${PYTHON_BACKEND_URL}${req.originalUrl}`;
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        if (req.headers.authorization) headers.authorization = req.headers.authorization;
        const response = await fetch(targetUrl, {
          method: req.method,
          headers,
          body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
        });
        const text = await response.text();
        res.status(response.status);
        res.setHeader('content-type', response.headers.get('content-type') || 'application/json');
        res.send(text);
      } catch {
        res.status(502).json({ detail: 'Unable to reach Python FastAPI backend at ' + PYTHON_BACKEND_URL });
      }
    });
  } else {
    const db = await initDatabase();

    const SESSION_COOKIE_NAME = 'agrinova_session';
    const SESSION_TTL_SECONDS = 12 * 60 * 60;

    const parseCookieHeader = (cookieHeader: string | undefined, name: string): string | null => {
      if (!cookieHeader) return null;
      const parts = cookieHeader.split(';');
      for (const part of parts) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        const k = part.slice(0, idx).trim();
        if (k === name) {
          return decodeURIComponent(part.slice(idx + 1).trim());
        }
      }
      return null;
    };

    const setSessionCookie = (res: Response, token: string) => {
      const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
      res.setHeader(
        'Set-Cookie',
        `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secureFlag}`,
      );
    };

    const clearSessionCookie = (res: Response) => {
      res.setHeader(
        'Set-Cookie',
        `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
      );
    };

    const issueSessionToken = (user: UserRow, req: Request, res?: Response): string => {
      const nowMs = Date.now();
      const expiresMs = nowMs + SESSION_TTL_SECONDS * 1000;
      const jti = crypto.randomUUID();
      const token = signJwt({
        sub: user.id,
        email: user.email,
        role: user.role,
        jti,
        iat: Math.floor(nowMs / 1000),
        exp: Math.floor(expiresMs / 1000),
      });
      const deviceInfo = String(req.headers['user-agent'] || 'Web Browser').slice(0, 190);
      const ipAddress = req.ip || '127.0.0.1';
      db.prepare(`
        INSERT INTO user_sessions (id, user_id, token_jti, device_info, ip_address, created_at, expires_at, revoked)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        crypto.randomUUID(),
        user.id,
        jti,
        deviceInfo,
        ipAddress,
        new Date(nowMs).toISOString(),
        new Date(expiresMs).toISOString(),
      );
      if (res) {
        setSessionCookie(res, token);
      }
      return token;
    };

    const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;
      const bearerToken =
        authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
      const cookieToken = parseCookieHeader(req.headers.cookie, SESSION_COOKIE_NAME);
      const token = bearerToken || cookieToken;
      if (!token) {
        return res.status(401).json({ detail: 'Authentication required. Please sign in.' });
      }
      const payload = verifyJwt(token);
      if (!payload || typeof payload.sub !== 'string' || typeof payload.jti !== 'string') {
        return res.status(401).json({ detail: 'Invalid or expired session token.' });
      }
      const session = db
        .prepare('SELECT * FROM user_sessions WHERE token_jti = ? AND user_id = ?')
        .get(payload.jti, payload.sub) as SessionRow | undefined;

      if (!session || session.revoked) {
        return res.status(401).json({ detail: 'Session has been revoked.' });
      }
      if (new Date(session.expires_at).getTime() < Date.now()) {
        return res.status(401).json({ detail: 'Session expired. Please sign in again.' });
      }
      const user = db
        .prepare('SELECT * FROM users WHERE id = ? AND is_active = 1')
        .get(payload.sub) as UserRow | undefined;
      if (!user) {
        return res.status(401).json({ detail: 'Account not found or inactive.' });
      }
      req.authUser = user;
      req.authJti = payload.jti;
      return next();
    };

    const requireRoles = (allowedRoles: UserRole[]) => {
      const allowed = new Set(allowedRoles);
      return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.authUser) return res.status(401).json({ detail: 'Authentication required.' });
        if (!allowed.has(req.authUser.role)) {
          return res.status(403).json({
            detail: `Access denied. Role '${req.authUser.role}' is not permitted for this resource.`,
          });
        }
        return next();
      };
    };

    app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok', service: 'AgriNova Full-Stack API', phase: 5 });
    });

    // ==================== AUTH & RBAC ROUTES ====================
    app.post('/api/auth/register', authRateLimit, (req, res) => {
      const { full_name, email, phone, password, role, location, language_preference } = req.body ?? {};
      if (typeof full_name !== 'string' || full_name.trim().length < 2) {
        return res.status(400).json({ detail: 'Full name must be at least 2 characters.' });
      }
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ detail: 'Please provide a valid email address.' });
      }
      if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ detail: 'Password must be at least 8 characters.' });
      }
      const cleanRole: UserRole = PUBLIC_ROLES.has(role) ? role : 'farmer';
      const cleanEmail = email.trim().toLowerCase();
      const cleanPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : null;

      if (db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail)) {
        return res.status(409).json({ detail: 'An account with this email already exists.' });
      }
      if (cleanPhone && db.prepare('SELECT id FROM users WHERE phone = ?').get(cleanPhone)) {
        return res.status(409).json({ detail: 'An account with this phone number already exists.' });
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const lang = enforceRoleLanguage(cleanRole, language_preference);
      db.prepare(`
        INSERT INTO users (
          id, full_name, email, phone, password_hash, role,
          language_preference, theme_preference, auth_provider,
          location, is_demo, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'coffee', 'email', ?, 0, 1, ?, ?)
      `).run(
        id,
        full_name.trim(),
        cleanEmail,
        cleanPhone,
        hashPassword(password),
        cleanRole,
        lang,
        typeof location === 'string' && location.trim() ? location.trim() : 'India',
        now,
        now,
      );

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow;
      const token = issueSessionToken(user, req, res);
      return res.status(201).json({
        access_token: token,
        token_type: 'bearer',
        expires_in: SESSION_TTL_SECONDS,
        user: sanitizeUser(user),
      });
    });

    app.post('/api/auth/login', authRateLimit, (req, res) => {
      const { email, password } = req.body ?? {};
      if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ detail: 'Email and password are required.' });
      }
      const cleanEmail = email.trim().toLowerCase();
      let user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as
        | UserRow
        | undefined;
      if (!user) {
        const seed = DEMO_USER_SEEDS.find(
          (d) => d.email === cleanEmail || d.legacyEmail === cleanEmail,
        );
        if (seed) {
          user = db
            .prepare('SELECT * FROM users WHERE (email = ? OR email = ?) AND is_demo = 1')
            .get(seed.email, seed.legacyEmail) as UserRow | undefined;
        }
      }
      if (!user || !verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ detail: 'Invalid email or password.' });
      }
      if (!user.is_active) {
        return res.status(403).json({ detail: 'This account is currently inactive.' });
      }
      const token = issueSessionToken(user, req, res);
      return res.json({
        access_token: token,
        token_type: 'bearer',
        expires_in: SESSION_TTL_SECONDS,
        user: sanitizeUser(user),
      });
    });

    app.post('/api/auth/demo-login', authRateLimit, (req, res) => {
      const { role } = req.body ?? {};
      if (!VALID_ROLES.has(role)) return res.status(400).json({ detail: 'Invalid role selected.' });
      const seed = DEMO_USER_SEEDS.find((d) => d.role === role)!;
      let user = db
        .prepare('SELECT * FROM users WHERE email = ? OR email = ? OR (role = ? AND is_demo = 1) LIMIT 1')
        .get(seed.email, seed.legacyEmail, role) as UserRow | undefined;

      // Auto-restore demo account cleanly if a user previously tested Delete Account on a demo profile
      if (!user) {
        const newId = crypto.randomUUID();
        const nowTs = new Date().toISOString();
        const phoneTaken = db.prepare('SELECT id FROM users WHERE phone = ?').get(seed.phone);
        db.prepare(`
          INSERT INTO users (
            id, full_name, email, phone, password_hash, role,
            language_preference, theme_preference, auth_provider,
            location, is_demo, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'coffee', 'email', ?, 1, 1, ?, ?)
        `).run(
          newId,
          seed.full_name,
          seed.email,
          phoneTaken ? null : seed.phone,
          hashPassword('Demo@2026!'),
          seed.role,
          seed.language_preference,
          seed.location,
          nowTs,
          nowTs,
        );
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(newId) as unknown as UserRow;
      }

      const token = issueSessionToken(user, req, res);
      return res.json({
        access_token: token,
        token_type: 'bearer',
        expires_in: SESSION_TTL_SECONDS,
        user: sanitizeUser(user),
      });
    });

    // Firebase Auth ID Token Verification -> Issues backend JWT session
    app.post('/api/auth/firebase', authRateLimit, async (req, res) => {
      const { idToken, role, language_preference } = req.body ?? {};
      if (typeof idToken !== 'string' || !idToken.trim()) {
        return res.status(400).json({ detail: 'Firebase ID token is required.' });
      }
      try {
        const decoded = await verifyFirebaseIdToken(idToken.trim());
        const email = (decoded.email || '').trim().toLowerCase();
        if (!email) {
          return res.status(400).json({ detail: 'Verified Firebase account email is required.' });
        }
        const displayName =
          typeof decoded.name === 'string' && decoded.name.trim().length >= 2
            ? decoded.name.trim()
            : email.split('@')[0];

        let user = db.prepare('SELECT * FROM users WHERE email = ? OR id = ?').get(email, decoded.uid) as
          | UserRow
          | undefined;
        const cleanRole: UserRole = PUBLIC_ROLES.has(role) ? role : 'farmer';
        const now = new Date().toISOString();

        if (!user) {
          db.prepare(`
            INSERT INTO users (
              id, full_name, email, phone, password_hash, role,
              language_preference, theme_preference, auth_provider,
              location, is_demo, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, NULL, ?, ?, ?, 'coffee', 'firebase_google', 'India', 0, 1, ?, ?)
          `).run(
            decoded.uid,
            displayName,
            email,
            hashPassword(crypto.randomBytes(24).toString('hex')),
            cleanRole,
            enforceRoleLanguage(cleanRole, language_preference),
            now,
            now,
          );
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.uid) as unknown as UserRow;
        } else if (!user.is_active) {
          return res.status(403).json({ detail: 'This account is currently inactive.' });
        }

        const token = issueSessionToken(user, req, res);
        return res.json({
          access_token: token,
          token_type: 'bearer',
          expires_in: SESSION_TTL_SECONDS,
          user: sanitizeUser(user),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Firebase token verification failed.';
        return res.status(401).json({ detail: msg });
      }
    });

    app.post('/api/auth/google-demo', authRateLimit, (req, res) => {
      const { email, full_name, role } = req.body ?? {};
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ detail: 'Valid email required for Google demo flow.' });
      }
      const cleanEmail = email.trim().toLowerCase();
      const cleanRole: UserRole = PUBLIC_ROLES.has(role) ? role : 'farmer';
      let user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as UserRow | undefined;
      if (!user) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        db.prepare(`
          INSERT INTO users (
            id, full_name, email, phone, password_hash, role,
            language_preference, theme_preference, auth_provider,
            location, is_demo, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, NULL, ?, ?, ?, 'coffee', 'google_demo', 'India', 1, 1, ?, ?)
        `).run(
          id,
          typeof full_name === 'string' && full_name.trim() ? full_name.trim() : 'Google Demo User',
          cleanEmail,
          hashPassword(crypto.randomBytes(24).toString('hex')),
          cleanRole,
          enforceRoleLanguage(cleanRole, 'en'),
          now,
          now,
        );
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow;
      }
      const token = issueSessionToken(user, req, res);
      return res.json({
        access_token: token,
        token_type: 'bearer',
        expires_in: SESSION_TTL_SECONDS,
        user: sanitizeUser(user),
      });
    });

    app.post('/api/auth/otp/request-demo', authRateLimit, (req, res) => {
      const { phone, role } = req.body ?? {};
      if (typeof phone !== 'string' || phone.trim().length < 6) {
        return res.status(400).json({ detail: 'Enter a valid phone number (at least 6 characters).' });
      }
      const cleanPhone = phone.trim();
      const cleanRole: UserRole = PUBLIC_ROLES.has(role) ? role : 'farmer';
      const code = String(crypto.randomInt(100000, 999999));
      demoOtpStore.set(cleanPhone, { code, role: cleanRole, expiresAt: Date.now() + 10 * 60 * 1000 });
      return res.json({
        simulated: true,
        message: 'Simulated demo OTP generated for testing (no real SMS sent).',
        demo_otp_code: code,
        phone: cleanPhone,
      });
    });

    app.post('/api/auth/otp/verify-demo', authRateLimit, (req, res) => {
      const { phone, otp_code, role, full_name } = req.body ?? {};
      const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
      const entry = demoOtpStore.get(cleanPhone);
      if (!entry || entry.expiresAt < Date.now() || entry.code !== String(otp_code || '').trim()) {
        return res.status(400).json({ detail: 'Invalid or expired demo OTP code.' });
      }
      demoOtpStore.delete(cleanPhone);

      const cleanRole: UserRole = PUBLIC_ROLES.has(role) ? role : entry.role;
      let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanPhone) as UserRow | undefined;
      if (!user) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const digits = cleanPhone.replace(/\D/g, '') || '0000';
        const displayRole = cleanRole.charAt(0).toUpperCase() + cleanRole.slice(1);
        db.prepare(`
          INSERT INTO users (
            id, full_name, email, phone, password_hash, role,
            language_preference, theme_preference, auth_provider,
            location, is_demo, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'system', 'otp_demo', 'India', 1, 1, ?, ?)
        `).run(
          id,
          typeof full_name === 'string' && full_name.trim()
            ? full_name.trim()
            : `Mobile ${displayRole} (${digits.slice(-4)})`,
          `otp.${digits.slice(-8)}.${crypto.randomInt(10, 99)}@demo.smartfoodchain.ai`,
          cleanPhone,
          hashPassword(crypto.randomBytes(24).toString('hex')),
          cleanRole,
          enforceRoleLanguage(cleanRole, 'en'),
          now,
          now,
        );
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow;
      }
      const token = issueSessionToken(user, req, res);
      return res.json({
        access_token: token,
        token_type: 'bearer',
        expires_in: SESSION_TTL_SECONDS,
        user: sanitizeUser(user),
      });
    });

    app.post('/api/auth/forgot-password', authRateLimit, (req, res) => {
      const { email } = req.body ?? {};
      if (typeof email !== 'string') return res.status(400).json({ detail: 'Email is required.' });
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) as
        | UserRow
        | undefined;
      if (!user) {
        return res.json({
          message: 'If an account exists for that email, a reset code has been generated.',
          simulated_reset_code: null,
        });
      }
      const code = String(crypto.randomInt(100000, 999999));
      db.prepare(`
        INSERT INTO password_reset_tokens (id, user_id, reset_code, expires_at, used)
        VALUES (?, ?, ?, ?, 0)
      `).run(crypto.randomUUID(), user.id, code, new Date(Date.now() + 15 * 60 * 1000).toISOString());
      return res.json({
        message: 'Simulated password reset code generated (valid 15 minutes).',
        simulated_reset_code: code,
      });
    });

    app.post('/api/auth/reset-password', authRateLimit, (req, res) => {
      const { email, reset_code, new_password } = req.body ?? {};
      if (typeof email !== 'string' || typeof reset_code !== 'string' || typeof new_password !== 'string') {
        return res.status(400).json({ detail: 'Email, reset code, and new password are required.' });
      }
      if (new_password.length < 8) {
        return res.status(400).json({ detail: 'New password must be at least 8 characters.' });
      }
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) as
        | UserRow
        | undefined;
      if (!user) return res.status(404).json({ detail: 'Account not found.' });
      const tokenRow = db
        .prepare(
          'SELECT * FROM password_reset_tokens WHERE user_id = ? AND reset_code = ? AND used = 0 ORDER BY expires_at DESC LIMIT 1',
        )
        .get(user.id, reset_code.trim()) as { id: string; expires_at: string; used: number } | undefined;
      if (!tokenRow) return res.status(400).json({ detail: 'Invalid or already used reset code.' });
      if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
        return res.status(400).json({ detail: 'Reset code has expired.' });
      }
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
        hashPassword(new_password),
        new Date().toISOString(),
        user.id,
      );
      db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(tokenRow.id);
      return res.json({ message: 'Password updated successfully. You can now sign in.' });
    });

    app.post('/api/auth/refresh', requireAuth, (req: AuthRequest, res) => {
      db.prepare('UPDATE user_sessions SET revoked = 1 WHERE user_id = ? AND token_jti = ?').run(
        req.authUser!.id,
        req.authJti!,
      );
      const token = issueSessionToken(req.authUser!, req, res);
      return res.json({
        access_token: token,
        token_type: 'bearer',
        expires_in: SESSION_TTL_SECONDS,
        user: sanitizeUser(req.authUser!),
      });
    });

    app.post('/api/auth/logout', requireAuth, (req: AuthRequest, res) => {
      db.prepare('UPDATE user_sessions SET revoked = 1 WHERE user_id = ? AND token_jti = ?').run(
        req.authUser!.id,
        req.authJti!,
      );
      clearSessionCookie(res);
      return res.json({ message: 'Signed out and session revoked.' });
    });

    app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
      const sessionCountRow = db
        .prepare('SELECT COUNT(*) as c FROM user_sessions WHERE user_id = ? AND revoked = 0')
        .get(req.authUser!.id) as { c: number };
      return res.json({
        ...sanitizeUser(req.authUser!),
        active_sessions_count: sessionCountRow?.c ?? 1,
      });
    });

    app.put('/api/auth/profile', requireAuth, (req: AuthRequest, res) => {
      const user = req.authUser!;
      const { full_name, phone, location, theme_preference, language_preference } = req.body ?? {};
      let nextName = user.full_name;
      if (typeof full_name === 'string') {
        if (full_name.trim().length < 2) {
          return res.status(400).json({ detail: 'Full name must be at least 2 characters.' });
        }
        nextName = full_name.trim();
      }
      let nextPhone = user.phone;
      if (phone !== undefined) {
        const cleaned = typeof phone === 'string' && phone.trim() ? phone.trim() : null;
        if (cleaned && cleaned !== user.phone) {
          const dup = db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(cleaned, user.id);
          if (dup) return res.status(409).json({ detail: 'Phone number already in use.' });
        }
        nextPhone = cleaned;
      }
      const nextLocation = typeof location === 'string' ? location.trim() : user.location;
      const nextTheme: ThemeMode = VALID_THEMES.has(theme_preference) ? theme_preference : user.theme_preference;
      let nextLang = user.language_preference;
      if (language_preference !== undefined) {
        if (!MULTILINGUAL_ROLES.has(user.role) && language_preference !== 'en') {
          return res.status(403).json({
            detail: 'Multilingual interface options are available strictly for Farmer and Transporter accounts.',
          });
        }
        nextLang = enforceRoleLanguage(user.role, language_preference);
      }
      db.prepare(`
        UPDATE users
        SET full_name = ?, phone = ?, location = ?, theme_preference = ?, language_preference = ?, updated_at = ?
        WHERE id = ?
      `).run(nextName, nextPhone, nextLocation, nextTheme, nextLang, new Date().toISOString(), user.id);
      const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as unknown as UserRow;
      return res.json(sanitizeUser(updated));
    });

    app.put('/api/auth/change-password', requireAuth, (req: AuthRequest, res) => {
      const user = req.authUser!;
      const { current_password, new_password } = req.body ?? {};
      if (typeof current_password !== 'string' || typeof new_password !== 'string') {
        return res.status(400).json({ detail: 'Current and new passwords are required.' });
      }
      if (new_password.length < 8) {
        return res.status(400).json({ detail: 'New password must be at least 8 characters.' });
      }
      if (!verifyPassword(current_password, user.password_hash)) {
        return res.status(400).json({ detail: 'Current password is incorrect.' });
      }
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
        hashPassword(new_password),
        new Date().toISOString(),
        user.id,
      );
      return res.json({ message: 'Password changed successfully.' });
    });

    app.get('/api/auth/sessions', requireAuth, (req: AuthRequest, res) => {
      const rows = db
        .prepare('SELECT * FROM user_sessions WHERE user_id = ? ORDER BY created_at DESC')
        .all(req.authUser!.id) as unknown as SessionRow[];
      return res.json(
        rows.map((s) => ({
          id: s.id,
          device_info: s.device_info,
          ip_address: s.ip_address,
          created_at: s.created_at,
          expires_at: s.expires_at,
          revoked: Boolean(s.revoked),
          is_current: s.token_jti === req.authJti,
        })),
      );
    });

    app.delete('/api/auth/sessions/:sessionId', requireAuth, (req: AuthRequest, res) => {
      const row = db
        .prepare('SELECT id FROM user_sessions WHERE id = ? AND user_id = ?')
        .get(req.params.sessionId, req.authUser!.id);
      if (!row) return res.status(404).json({ detail: 'Session not found.' });
      db.prepare('UPDATE user_sessions SET revoked = 1 WHERE id = ?').run(req.params.sessionId);
      return res.json({ message: 'Session revoked.' });
    });

    app.delete('/api/auth/account', requireAuth, (req: AuthRequest, res) => {
      const user = req.authUser!;
      const { confirmation, password } = req.body ?? {};
      if (confirmation !== 'DELETE') {
        return res.status(400).json({ detail: "Please confirm deletion by typing 'DELETE'." });
      }
      if (user.auth_provider === 'email' && !user.is_demo) {
        if (typeof password !== 'string' || !verifyPassword(password, user.password_hash)) {
          return res.status(400).json({ detail: 'Password verification failed.' });
        }
      }
      db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(user.id);
      db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);
      db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
      return res.json({ message: 'Account and associated sessions permanently deleted.' });
    });

    app.get('/api/rbac/farmer/summary', requireAuth, requireRoles(['farmer', 'admin']), (req: AuthRequest, res) => {
      return res.json({
        access: 'granted',
        resource: 'farmer_summary',
        verified_role: req.authUser!.role,
        message: 'Backend RBAC verified Farmer/Admin access.',
      });
    });

    app.get(
      '/api/rbac/supply-chain/summary',
      requireAuth,
      requireRoles(['transporter', 'warehouse', 'retailer', 'admin']),
      (req: AuthRequest, res) => {
        return res.json({
          access: 'granted',
          resource: 'supply_chain_summary',
          verified_role: req.authUser!.role,
          message: 'Backend RBAC verified Commercial Supply Chain access.',
        });
      },
    );

    app.get('/api/rbac/admin/users', requireAuth, requireRoles(['admin']), (_req: AuthRequest, res) => {
      const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as unknown as UserRow[];
      return res.json(users.map(sanitizeUser));
    });

    app.put('/api/rbac/admin/users/:userId/role', requireAuth, requireRoles(['admin']), (req: AuthRequest, res) => {
      const { role } = req.body ?? {};
      if (!VALID_ROLES.has(role)) return res.status(400).json({ detail: 'Invalid role provided.' });
      const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId) as UserRow | undefined;
      if (!target) return res.status(404).json({ detail: 'Target user not found.' });
      if (target.id === req.authUser!.id && role !== 'admin') {
        return res.status(400).json({ detail: 'Admin cannot demote their own active account.' });
      }
      const nextLang = MULTILINGUAL_ROLES.has(role) ? target.language_preference : 'en';
      db.prepare('UPDATE users SET role = ?, language_preference = ?, updated_at = ? WHERE id = ?').run(
        role,
        nextLang,
        new Date().toISOString(),
        target.id,
      );
      const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(target.id) as unknown as UserRow;
      return res.json(sanitizeUser(updated));
    });

    // ==================== WORKING SUPPLY CHAIN & AI ROUTES ====================
    app.get('/api/dashboard/overview', requireAuth, (req: AuthRequest, res) => {
      const user = req.authUser!;
      const products = db.prepare('SELECT * FROM products').all() as unknown as ProductRow[];
      const shipments = db.prepare('SELECT * FROM shipments').all() as unknown as ShipmentRow[];
      const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;

      const totalInventoryKg = products.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const atRiskKg = products
        .filter((p) => p.risk_level === 'High' || p.risk_level === 'Critical')
        .reduce((sum, p) => sum + (p.quantity || 0), 0);
      const safeKg = Math.max(0, totalInventoryKg - atRiskKg);
      const activeShipments = shipments.filter((s) => !['Delivered', 'Cancelled'].includes(s.status)).length;
      const completedShipments = shipments.filter((s) => s.status === 'Delivered').length;
      const estimatedRevenueInr = products.reduce((sum, p) => sum + p.quantity * p.price_per_unit, 0);

      return res.json({
        user: sanitizeUser(user),
        metrics: {
          total_users: totalUsers,
          total_products: products.length,
          total_inventory_kg: Math.round(totalInventoryKg),
          safe_stock_kg: Math.round(safeKg),
          at_risk_stock_kg: Math.round(atRiskKg),
          total_shipments: shipments.length,
          active_shipments: activeShipments,
          completed_shipments: completedShipments,
          estimated_food_saved_kg: Math.round(safeKg * 0.28),
          estimated_value_inr: Math.round(estimatedRevenueInr),
        },
      });
    });

    // AI Spoilage Prediction Endpoint
    app.post('/api/ai/predict-spoilage', requireAuth, (req: AuthRequest, res) => {
      const { category, temperature_c, humidity_pct, storage_hours, transport_delay_hours } = req.body ?? {};
      const result = predictSpoilage({
        category: String(category || 'Tomato'),
        temperature_c: Number(temperature_c ?? 25),
        humidity_pct: Number(humidity_pct ?? 80),
        storage_hours: Number(storage_hours ?? 12),
        transport_delay_hours: Number(transport_delay_hours ?? 0),
      });
      return res.json(result);
    });

    // Products / Farmer Crops CRUD
    app.get('/api/products', requireAuth, (req: AuthRequest, res) => {
      const user = req.authUser!;
      let rows: ProductRow[];
      if (user.role === 'farmer' && !user.is_demo) {
        rows = db
          .prepare('SELECT * FROM products WHERE farmer_id = ? ORDER BY created_at DESC')
          .all(user.id) as unknown as ProductRow[];
      } else {
        rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all() as unknown as ProductRow[];
      }
      return res.json(rows.map(formatProduct));
    });

    app.post('/api/products', requireAuth, (req: AuthRequest, res) => {
      const user = req.authUser!;
      const body = req.body ?? {};
      const name = String(body.name || '').trim();
      const category = String(body.category || 'Tomato').trim();
      const quantity = Number(body.quantity || 0);
      if (name.length < 2 || quantity <= 0) {
        return res.status(400).json({ detail: 'Valid crop/product name and positive quantity are required.' });
      }

      const temp = Number(body.current_temp_c ?? 16);
      const hum = Number(body.current_humidity_pct ?? 82);
      const delay = Number(body.transport_delay_hours ?? 0);
      const ai = predictSpoilage({
        category,
        temperature_c: temp,
        humidity_pct: hum,
        storage_hours: 12,
        transport_delay_hours: delay,
      });

      const id = `prod-${crypto.randomUUID().slice(0, 8)}`;
      const batchId = `BCH-${category.slice(0, 3).toUpperCase()}-${crypto.randomInt(100, 999)}`;
      const now = new Date().toISOString();
      const imageUrl =
        typeof body.image_url === 'string' && body.image_url.trim()
          ? body.image_url.trim()
          : '/src/assets/images/farmer_mobile_harvest_1795105201987.jpg';

      db.prepare(`
        INSERT INTO products (
          id, batch_id, farmer_id, farmer_name, name, category, quantity, unit,
          harvest_date, shelf_life_days, origin, destination, storage_temp_c, storage_humidity_pct,
          current_temp_c, current_humidity_pct, transport_delay_hours, risk_score, risk_level,
          explanations_json, recommendations_json, listed_for_sale, price_per_unit, image_url, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        batchId,
        user.id,
        user.full_name,
        name,
        category,
        quantity,
        String(body.unit || 'kg'),
        String(body.harvest_date || now.slice(0, 10)),
        Number(body.shelf_life_days || 10),
        String(body.origin || user.location || 'Local Farm'),
        String(body.destination || 'Regional Cold Hub'),
        Number(body.storage_temp_c ?? 12),
        Number(body.storage_humidity_pct ?? 85),
        temp,
        hum,
        delay,
        ai.risk_score,
        ai.risk_level,
        JSON.stringify(ai.explanations),
        JSON.stringify(ai.recommendations),
        body.listed_for_sale ? 1 : 0,
        Number(body.price_per_unit ?? 30),
        imageUrl,
        body.listed_for_sale ? 'Listed for Sale' : 'Stored',
        now,
      );

      if (ai.risk_level === 'High' || ai.risk_level === 'Critical') {
        db.prepare(
          'INSERT INTO notifications (id, user_id, role_target, title, message, severity, is_read, created_at) VALUES (?, NULL, ?, ?, ?, ?, 0, ?)',
        ).run(
          crypto.randomUUID(),
          'all',
          `${ai.risk_level} Spoilage Risk: ${name}`,
          `${ai.explanations[0] || 'Check storage conditions immediately.'}`,
          ai.risk_level === 'Critical' ? 'critical' : 'warning',
          now,
        );
      }

      const created = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as unknown as ProductRow;
      return res.status(201).json(formatProduct(created));
    });

    app.put('/api/products/:productId', requireAuth, (req: AuthRequest, res) => {
      const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.productId) as
        | ProductRow
        | undefined;
      if (!existing) return res.status(404).json({ detail: 'Product not found.' });

      const body = req.body ?? {};
      const nextTemp = body.current_temp_c !== undefined ? Number(body.current_temp_c) : existing.current_temp_c;
      const nextHum = body.current_humidity_pct !== undefined ? Number(body.current_humidity_pct) : existing.current_humidity_pct;
      const nextDelay =
        body.transport_delay_hours !== undefined ? Number(body.transport_delay_hours) : existing.transport_delay_hours;
      const nextCat = body.category !== undefined ? String(body.category) : existing.category;
      const nextQty = body.quantity !== undefined ? Number(body.quantity) : existing.quantity;
      const nextListed = body.listed_for_sale !== undefined ? (body.listed_for_sale ? 1 : 0) : existing.listed_for_sale;
      const nextPrice = body.price_per_unit !== undefined ? Number(body.price_per_unit) : existing.price_per_unit;
      const nextStatus =
        body.status !== undefined
          ? String(body.status)
          : nextListed && existing.status === 'Stored'
            ? 'Listed for Sale'
            : existing.status;

      const ai = predictSpoilage({
        category: nextCat,
        temperature_c: nextTemp,
        humidity_pct: nextHum,
        storage_hours: 24,
        transport_delay_hours: nextDelay,
      });

      db.prepare(`
        UPDATE products
        SET name = ?, category = ?, quantity = ?, current_temp_c = ?, current_humidity_pct = ?,
            transport_delay_hours = ?, risk_score = ?, risk_level = ?, explanations_json = ?,
            recommendations_json = ?, listed_for_sale = ?, price_per_unit = ?, status = ?
        WHERE id = ?
      `).run(
        body.name !== undefined ? String(body.name) : existing.name,
        nextCat,
        nextQty,
        nextTemp,
        nextHum,
        nextDelay,
        ai.risk_score,
        ai.risk_level,
        JSON.stringify(ai.explanations),
        JSON.stringify(ai.recommendations),
        nextListed,
        nextPrice,
        nextStatus,
        existing.id,
      );

      // If newly listed for sale and no payment entry yet, record pending payment preview
      if (nextListed && !existing.listed_for_sale) {
        const payId = `pay-${crypto.randomUUID().slice(0, 6)}`;
        db.prepare(
          'INSERT INTO payments (id, farmer_id, product_name, amount_inr, status, buyer_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).run(
          payId,
          existing.farmer_id,
          `${existing.name} · ${nextQty} ${existing.unit}`,
          Math.round(nextQty * nextPrice),
          'Pending',
          'Open Market Listing',
          new Date().toISOString().slice(0, 10),
        );
      }

      const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id) as unknown as ProductRow;
      return res.json(formatProduct(updated));
    });

    app.delete('/api/products/:productId', requireAuth, (req: AuthRequest, res) => {
      const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.productId) as
        | ProductRow
        | undefined;
      if (!existing) return res.status(404).json({ detail: 'Product not found.' });
      db.prepare('DELETE FROM products WHERE id = ?').run(existing.id);
      return res.json({ message: 'Product deleted.' });
    });

    // Shipments & Tracking
    app.get('/api/transporters', requireAuth, (_req: AuthRequest, res) => {
      const rows = db
        .prepare("SELECT id, full_name, location FROM users WHERE role = 'transporter' AND is_active = 1")
        .all() as Array<{ id: string; full_name: string; location: string | null }>;
      return res.json(
        rows.length > 0
          ? rows
          : [
              { id: 'fleet-1', full_name: 'Vikram Logistics Fleet', location: 'Kolkata Hub' },
              { id: 'fleet-2', full_name: 'Bengal Cold Express', location: 'Hooghly Corridor' },
            ],
      );
    });

    app.get('/api/shipments', requireAuth, (_req: AuthRequest, res) => {
      const rows = db.prepare('SELECT * FROM shipments ORDER BY updated_at DESC').all() as unknown as ShipmentRow[];
      return res.json(rows.map(formatShipment));
    });

    app.get('/api/shipments/lookup/:code', requireAuth, (req: AuthRequest, res) => {
      const raw = decodeURIComponent(req.params.code || '').trim();
      const sfcMatch = raw.toUpperCase().match(/SFC-\d{4}-\d{3,4}/);
      const bchMatch = raw.toUpperCase().match(/BCH-[A-Z]{3}-\d{3,4}/);
      const code = (sfcMatch ? sfcMatch[0] : bchMatch ? bchMatch[0] : raw).toUpperCase();

      let row = db
        .prepare('SELECT * FROM shipments WHERE UPPER(shipment_code) = ? OR id = ?')
        .get(code, raw) as ShipmentRow | undefined;

      if (!row && bchMatch) {
        const prod = db
          .prepare('SELECT id FROM products WHERE UPPER(batch_id) = ?')
          .get(bchMatch[0]) as { id: string } | undefined;
        if (prod) {
          row = db.prepare('SELECT * FROM shipments WHERE product_id = ? LIMIT 1').get(prod.id) as
            | ShipmentRow
            | undefined;
        }
      }

      if (!row) return res.status(404).json({ detail: `No shipment found with ID '${code}'.` });
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(row.product_id) as ProductRow | undefined;
      return res.json({
        shipment: formatShipment(row),
        product: product ? formatProduct(product) : null,
      });
    });

    app.post(
      '/api/shipments',
      requireAuth,
      requireRoles(['farmer', 'warehouse', 'admin', 'transporter']),
      (req: AuthRequest, res) => {
        const { product_id, destination, transporter_name, current_temp_c, current_humidity_pct, dest_lat, dest_lng } =
          req.body ?? {};
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id) as ProductRow | undefined;
        if (!product) return res.status(404).json({ detail: 'Source product batch not found.' });

        const destName = String(destination || product.destination || 'Kolkata North Agri Hub').trim();
        const presetCoords = DESTINATION_HUBS[destName.toLowerCase()];
        const finalDestLat = Number.isFinite(Number(dest_lat)) ? Number(dest_lat) : presetCoords?.lat ?? 22.5726;
        const finalDestLng = Number.isFinite(Number(dest_lng)) ? Number(dest_lng) : presetCoords?.lng ?? 88.3639;
        const origLat = 22.9089;
        const origLng = 88.3967;
        const startLat = Number((origLat + (finalDestLat - origLat) * 0.1).toFixed(4));
        const startLng = Number((origLng + (finalDestLng - origLng) * 0.1).toFixed(4));

        const id = `ship-${crypto.randomUUID().slice(0, 6)}`;
        const code = `SFC-2026-${crypto.randomInt(200, 999)}`;
        const now = new Date().toISOString();
        const fleet = String(transporter_name || 'Vikram Logistics Fleet').trim();
        const timeline = [
          {
            status: 'Created',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            note: `Dispatched to ${destName} via ${fleet} (by ${req.authUser!.full_name})`,
          },
        ];
        const temp = Number(current_temp_c ?? product.current_temp_c);
        const hum = Number(current_humidity_pct ?? product.current_humidity_pct);

        db.prepare(`
          INSERT INTO shipments (
            id, shipment_code, product_id, product_name, farmer_id, transporter_id, transporter_name,
            origin, origin_lat, origin_lng, destination, dest_lat, dest_lng, current_lat, current_lng,
            status, current_temp_c, current_humidity_pct, delay_hours, eta_hours, risk_level, timeline_json,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'In Transit', ?, ?, 0, 5.5, ?, ?, ?, ?)
        `).run(
          id,
          code,
          product.id,
          `${product.name} · ${product.quantity} ${product.unit}`,
          product.farmer_id,
          fleet,
          product.origin,
          origLat,
          origLng,
          destName,
          finalDestLat,
          finalDestLng,
          startLat,
          startLng,
          temp,
          hum,
          product.risk_level,
          JSON.stringify(timeline),
          now,
          now,
        );

        db.prepare("UPDATE products SET status = 'In Transit', destination = ? WHERE id = ?").run(destName, product.id);
        db.prepare(
          'INSERT INTO notifications (id, user_id, role_target, title, message, severity, is_read, created_at) VALUES (?, NULL, ?, ?, ?, ?, 0, ?)',
        ).run(
          crypto.randomUUID(),
          'all',
          `Truck Dispatched (${code}): ${product.name}`,
          `Destination: ${destName} · Fleet: ${fleet} · Live car tracking active.`,
          'info',
          now,
        );

        const created = db.prepare('SELECT * FROM shipments WHERE id = ?').get(id) as unknown as ShipmentRow;
        return res.status(201).json(formatShipment(created));
      },
    );

    // Live Vehicle GPS Ping (accessible for tracking by Farmer, Transporter, Warehouse, Retailer, Admin)
    app.post('/api/shipments/:shipmentId/advance-live', requireAuth, (req: AuthRequest, res) => {
      const existing = db.prepare('SELECT * FROM shipments WHERE id = ?').get(req.params.shipmentId) as
        | ShipmentRow
        | undefined;
      if (!existing) return res.status(404).json({ detail: 'Shipment not found.' });

      const nextLat = Number((existing.current_lat + (existing.dest_lat - existing.current_lat) * 0.28).toFixed(4));
      const nextLng = Number((existing.current_lng + (existing.dest_lng - existing.current_lng) * 0.28).toFixed(4));
      const distRemaining = Math.hypot(existing.dest_lat - nextLat, existing.dest_lng - nextLng);
      const nextEta = distRemaining < 0.03 ? 0 : Math.max(0.5, Number((existing.eta_hours * 0.72).toFixed(1)));
      const nextStatus =
        distRemaining < 0.03 ? 'Delivered' : existing.status === 'Created' ? 'In Transit' : existing.status;

      const timeline = JSON.parse(existing.timeline_json || '[]') as Array<{
        status: string;
        time: string;
        note: string;
      }>;
      timeline.push({
        status: nextStatus,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        note:
          distRemaining < 0.03
            ? `Vehicle arrived at ${existing.destination}`
            : `Live GPS checkpoint (${nextLat}, ${nextLng}) · ${existing.current_temp_c}°C`,
      });

      const now = new Date().toISOString();
      db.prepare(`
        UPDATE shipments
        SET current_lat = ?, current_lng = ?, eta_hours = ?, status = ?, timeline_json = ?, updated_at = ?
        WHERE id = ?
      `).run(nextLat, nextLng, nextEta, nextStatus, JSON.stringify(timeline), now, existing.id);

      const updated = db.prepare('SELECT * FROM shipments WHERE id = ?').get(existing.id) as unknown as ShipmentRow;
      return res.json(formatShipment(updated));
    });

    app.put(
      '/api/shipments/:shipmentId/update',
      requireAuth,
      requireRoles(['transporter', 'warehouse', 'retailer', 'admin']),
      (req: AuthRequest, res) => {
        const existing = db.prepare('SELECT * FROM shipments WHERE id = ?').get(req.params.shipmentId) as
          | ShipmentRow
          | undefined;
        if (!existing) return res.status(404).json({ detail: 'Shipment not found.' });

        const { status, current_temp_c, current_humidity_pct, delay_hours, note, advance_gps } = req.body ?? {};
        const nextStatus = VALID_SHIPMENT_STATUSES.includes(status) ? status : existing.status;
        const nextTemp = current_temp_c !== undefined ? Number(current_temp_c) : existing.current_temp_c;
        const nextHum = current_humidity_pct !== undefined ? Number(current_humidity_pct) : existing.current_humidity_pct;
        const nextDelay = delay_hours !== undefined ? Number(delay_hours) : existing.delay_hours;

        let nextLat = existing.current_lat;
        let nextLng = existing.current_lng;
        if (advance_gps) {
          nextLat = Number((existing.current_lat + (existing.dest_lat - existing.current_lat) * 0.35).toFixed(4));
          nextLng = Number((existing.current_lng + (existing.dest_lng - existing.current_lng) * 0.35).toFixed(4));
        }

        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(existing.product_id) as
          | ProductRow
          | undefined;
        const ai = predictSpoilage({
          category: product?.category || 'Tomato',
          temperature_c: nextTemp,
          humidity_pct: nextHum,
          storage_hours: 24,
          transport_delay_hours: nextDelay,
        });

        const timeline = JSON.parse(existing.timeline_json || '[]') as Array<{
          status: string;
          time: string;
          note: string;
        }>;
        timeline.push({
          status: nextStatus,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          note:
            String(note || '').trim() ||
            `Updated by ${req.authUser!.full_name} · ${nextTemp.toFixed(1)}°C, ${nextHum.toFixed(0)}% RH`,
        });

        const now = new Date().toISOString();
        db.prepare(`
          UPDATE shipments
          SET status = ?, current_temp_c = ?, current_humidity_pct = ?, delay_hours = ?,
              current_lat = ?, current_lng = ?, risk_level = ?, timeline_json = ?, updated_at = ?
          WHERE id = ?
        `).run(
          nextStatus,
          nextTemp,
          nextHum,
          nextDelay,
          nextLat,
          nextLng,
          ai.risk_level,
          JSON.stringify(timeline),
          now,
          existing.id,
        );

        db.prepare(
          'INSERT INTO iot_readings (id, shipment_id, device_id, temperature_c, humidity_pct, recorded_at, is_simulated) VALUES (?, ?, ?, ?, ?, ?, 1)',
        ).run(
          crypto.randomUUID(),
          existing.id,
          'MANUAL-OR-SIM',
          nextTemp,
          nextHum,
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        );

        if (ai.risk_level === 'High' || ai.risk_level === 'Critical' || nextStatus === 'Delayed') {
          db.prepare(
            'INSERT INTO notifications (id, user_id, role_target, title, message, severity, is_read, created_at) VALUES (?, NULL, ?, ?, ?, ?, 0, ?)',
          ).run(
            crypto.randomUUID(),
            'all',
            `Alert on ${existing.shipment_code}: ${nextStatus} (${ai.risk_level} Risk)`,
            `Temp ${nextTemp.toFixed(1)}°C, Humidity ${nextHum.toFixed(0)}%, Delay ${nextDelay}h.`,
            ai.risk_level === 'Critical' ? 'critical' : 'warning',
            now,
          );
        }

        const updated = db.prepare('SELECT * FROM shipments WHERE id = ?').get(existing.id) as unknown as ShipmentRow;
        return res.json(formatShipment(updated));
      },
    );

    // IoT Simulated Readings
    app.get('/api/iot/readings', requireAuth, (req: AuthRequest, res) => {
      const shipmentId = req.query.shipment_id ? String(req.query.shipment_id) : 'ship-101';
      const rows = db
        .prepare('SELECT * FROM iot_readings WHERE shipment_id = ? ORDER BY rowid ASC')
        .all(shipmentId);
      return res.json(rows);
    });

    app.post('/api/iot/simulate', requireAuth, (req: AuthRequest, res) => {
      const shipmentId = String(req.body?.shipment_id || 'ship-101');
      const temp = Number(req.body?.temperature_c ?? (11.5 + Math.random() * 4).toFixed(1));
      const hum = Number(req.body?.humidity_pct ?? (80 + Math.random() * 10).toFixed(0));
      const id = crypto.randomUUID();
      const label = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      db.prepare(
        'INSERT INTO iot_readings (id, shipment_id, device_id, temperature_c, humidity_pct, recorded_at, is_simulated) VALUES (?, ?, ?, ?, ?, ?, 1)',
      ).run(id, shipmentId, 'ESP32-SIM-NODE', temp, hum, label);
      return res.status(201).json({ id, shipment_id: shipmentId, temperature_c: temp, humidity_pct: hum, recorded_at: label });
    });

    // Food Redistribution & NGO Rescue
    app.get('/api/redistributions', requireAuth, (_req: AuthRequest, res) => {
      const rows = db.prepare('SELECT * FROM redistributions ORDER BY created_at DESC').all();
      return res.json(rows);
    });

    app.post('/api/redistributions', requireAuth, (req: AuthRequest, res) => {
      const { product_id, mode, ngo_name, discount_pct } = req.body ?? {};
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id) as ProductRow | undefined;
      if (!product) return res.status(404).json({ detail: 'Product not found.' });
      const id = `red-${crypto.randomUUID().slice(0, 6)}`;
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO redistributions (id, product_id, product_name, quantity, unit, location, mode, ngo_name, discount_pct, status, requested_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', '', ?)
      `).run(
        id,
        product.id,
        product.name,
        product.quantity,
        product.unit,
        product.destination,
        mode === 'discount' ? 'discount' : 'ngo',
        String(ngo_name || 'Annapurna Food Rescue (Demo NGO)'),
        Number(discount_pct || 40),
        now,
      );
      return res.status(201).json(db.prepare('SELECT * FROM redistributions WHERE id = ?').get(id));
    });

    app.put('/api/redistributions/:id/status', requireAuth, (req: AuthRequest, res) => {
      const { status } = req.body ?? {};
      db.prepare('UPDATE redistributions SET status = ?, requested_by = ? WHERE id = ?').run(
        String(status || 'Requested'),
        req.authUser!.full_name,
        req.params.id,
      );
      return res.json(db.prepare('SELECT * FROM redistributions WHERE id = ?').get(req.params.id));
    });

    // Farmer Payments
    app.get('/api/payments', requireAuth, (_req: AuthRequest, res) => {
      const rows = db.prepare('SELECT * FROM payments ORDER BY created_at DESC').all();
      return res.json(rows);
    });

    app.put('/api/payments/:id/settle', requireAuth, requireRoles(['admin', 'retailer']), (req: AuthRequest, res) => {
      const existing = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ detail: 'Payment record not found.' });
      db.prepare("UPDATE payments SET status = 'Paid' WHERE id = ?").run(req.params.id);
      return res.json(db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id));
    });

    // Universal Server-Side Multilingual Text-to-Speech (Gemini TTS Tier 1 + Zero-Key MP3 Fallback Tier 2)
    app.post('/api/tts', requireAuth, async (req: AuthRequest, res) => {
      const text = String(req.body?.text || '').trim();
      const language = String(req.body?.language || 'en').trim();
      if (!text || text.length > 1200) {
        return res.status(400).json({ detail: 'Provide text between 1 and 1200 characters.' });
      }
      const langName = LANG_NAMES[language] || 'English';

      // Tier 1: Gemini Neural TTS (when GEMINI_API_KEY is configured)
      if (geminiAi) {
        const geminiAiAlpha = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          apiVersion: 'v1alpha',
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const attempts: Array<() => Promise<string | undefined>> = [
          async () => {
            const r = await geminiAiAlpha.models.generateContent({
              model: 'gemini-3.8-flash-lite-tts',
              contents: [
                {
                  role: 'user',
                  parts: [{ text, speechMetadata: { style: `Clear, warm, natural native ${langName} assistant` } }],
                },
              ],
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
              },
            });
            return r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          },
          async () => {
            const r = await geminiAi.models.generateContent({
              model: 'gemini-3.8-flash-lite-tts',
              contents: [{ role: 'user', parts: [{ text: `Read aloud naturally in ${langName}: ${text}` }] }],
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
              },
            });
            return r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          },
        ];

        for (const run of attempts) {
          try {
            const base64Audio = await run();
            if (base64Audio) {
              return res.json({ audio_base64: base64Audio, mime_type: 'audio/wav', language });
            }
          } catch {
            // Fall through cleanly to Tier 2
          }
        }
      }

      // Tier 2: Zero-API-Key Universal Server MP3 Fallback (works on all user laptops even without GEMINI_API_KEY)
      try {
        const tlMap: Record<string, string> = { as: 'bn', or: 'hi' };
        const tl = tlMap[language] || (FARMER_LANGS.has(language) ? language : 'en');
        const words = text.split(/\s+/);
        const chunks: string[] = [];
        let current = '';
        for (const w of words) {
          if ((current + ' ' + w).trim().length > 175) {
            if (current) chunks.push(current.trim());
            current = w;
          } else {
            current = (current + ' ' + w).trim();
          }
        }
        if (current) chunks.push(current.trim());

        const audioBuffers: Buffer[] = [];
        for (const chunk of chunks.slice(0, 6)) {
          const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${encodeURIComponent(tl)}&client=tw-ob`;
          const ttsRes = await fetch(ttsUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          if (!ttsRes.ok) throw new Error(`Fallback TTS HTTP ${ttsRes.status}`);
          audioBuffers.push(Buffer.from(await ttsRes.arrayBuffer()));
        }
        const combined = Buffer.concat(audioBuffers);
        return res.json({
          audio_base64: combined.toString('base64'),
          mime_type: 'audio/mpeg',
          language,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'TTS audio unavailable.';
        return res.status(502).json({ detail: msg });
      }
    });

    // Multi-turn Server-Side Gemini Chatbot (ai.chats.create)
    app.post('/api/gemini/chat', requireAuth, async (req: AuthRequest, res) => {
      if (!geminiAi) {
        return res.status(503).json({
          detail: 'Gemini assistant is unavailable because GEMINI_API_KEY is not configured on the server.',
        });
      }

      const rawMessage = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
      if (!rawMessage || rawMessage.length > 4000) {
        return res.status(400).json({ detail: 'Message must be between 1 and 4000 characters.' });
      }

      const requestedModel = String(req.body?.model || 'gemini-4-hydrogen').trim();
      const allowedModels = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
      const model = allowedModels.has(requestedModel) ? requestedModel : 'gemini-4-hydrogen';

      const user = req.authUser!;
      const langCode = String(req.body?.language || user.language_preference || 'en');
      const langName = LANG_NAMES[langCode] || 'English';

      const productCount = (db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }).c;
      const highRiskCount = (
        db.prepare("SELECT COUNT(*) as c FROM products WHERE risk_level IN ('High', 'Critical')").get() as {
          c: number;
        }
      ).c;
      const activeShipmentCount = (
        db.prepare("SELECT COUNT(*) as c FROM shipments WHERE status NOT IN ('Delivered', 'Cancelled')").get() as {
          c: number;
        }
      ).c;

      const systemInstruction = [
        `You are AgriNova Assistant, a concise, practical supply-chain advisor helping ${user.full_name} (role: ${user.role}).`,
        `Respond in ${langName} unless the user writes clearly in another language.`,
        `Current live supply-chain summary: ${productCount} produce batches tracked (${highRiskCount} High/Critical spoilage risk), ${activeShipmentCount} active cold-chain shipments.`,
        `Focus on harvest dispatch hubs (Siliguri Cold Storage Depot, Kolkata North Agri Hub, Howrah Wholesale Mandi, Burdwan Cold Chain Center, GreenBasket Fresh Mart, Annapurna Food Rescue NGO), spoilage prevention (temperature, humidity, transit delay), QR batch traceability, and RBAC workflow guidance. Keep responses clear, practical, and under 180 words unless asked for detail.`,
      ].join(' ');

      const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];
      const history = rawHistory
        .filter(
          (item: unknown): item is { role: 'user' | 'model'; text: string } =>
            Boolean(item) &&
            typeof item === 'object' &&
            ((item as { role?: unknown }).role === 'user' || (item as { role?: unknown }).role === 'model') &&
            typeof (item as { text?: unknown }).text === 'string' &&
            Boolean((item as { text: string }).text.trim()),
        )
        .slice(-20)
        .map((item: { role: 'user' | 'model'; text: string }) => ({
          role: item.role,
          parts: [{ text: item.text.trim() }],
        }));

      try {
        const chat = geminiAi.chats.create({
          model,
          history,
          config: {
            systemInstruction,
          },
        });
        const response = await chat.sendMessage({ message: rawMessage });
        const reply = (response.text ?? '').trim();
        if (!reply) {
          return res.status(502).json({ detail: 'Gemini returned an empty response.' });
        }
        return res.json({ reply, model });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gemini chat request failed.';
        return res.status(502).json({ detail: msg });
      }
    });

    // Server-Side Speech Transcription (Gemini Transcribe fallback when Web Speech API is absent)
    app.post('/api/transcribe', requireAuth, async (req: AuthRequest, res) => {
      if (!geminiAi) {
        return res.status(503).json({
          detail: 'Server-side transcription requires GEMINI_API_KEY configured.',
        });
      }
      const audioBase64 = String(req.body?.audio_base64 || '');
      const mimeType = String(req.body?.mime_type || 'audio/webm');
      const language = String(req.body?.language || 'en');
      if (!audioBase64) return res.status(400).json({ detail: 'Audio payload required.' });
      const langName = LANG_NAMES[language] || 'English';
      try {
        const response = await geminiAi.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              { inlineData: { mimeType, data: audioBase64 } },
              { text: `Transcribe this spoken ${langName} audio accurately in plain text.` },
            ],
          },
        });
        return res.json({ transcript: (response.text || '').trim() });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Audio transcription failed.';
        return res.status(502).json({ detail: msg });
      }
    });

    // Notifications
    app.get('/api/notifications', requireAuth, (_req: AuthRequest, res) => {
      const rows = db.prepare('SELECT * FROM notifications ORDER BY rowid DESC LIMIT 25').all();
      return res.json(
        (rows as Array<Record<string, unknown>>).map((n) => ({ ...n, is_read: Boolean(n.is_read) })),
      );
    });

    app.put('/api/notifications/read-all', requireAuth, (_req: AuthRequest, res) => {
      db.prepare('UPDATE notifications SET is_read = 1').run();
      return res.json({ message: 'All notifications marked as read.' });
    });

    app.delete('/api/notifications/:id', requireAuth, (req: AuthRequest, res) => {
      db.prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id);
      return res.json({ message: 'Notification removed.' });
    });

    // Support Tickets
    app.get('/api/tickets', requireAuth, (req: AuthRequest, res) => {
      const user = req.authUser!;
      const rows =
        user.role === 'admin'
          ? db.prepare('SELECT * FROM support_tickets ORDER BY created_at DESC').all()
          : db.prepare('SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
      return res.json(rows);
    });

    app.post('/api/tickets', requireAuth, (req: AuthRequest, res) => {
      const { subject, message } = req.body ?? {};
      if (!subject || !message) return res.status(400).json({ detail: 'Subject and message are required.' });
      const id = `TKT-${crypto.randomInt(1000, 9999)}`;
      db.prepare(
        'INSERT INTO support_tickets (id, user_id, user_name, role, subject, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        id,
        req.authUser!.id,
        req.authUser!.full_name,
        req.authUser!.role,
        String(subject),
        String(message),
        'Open',
        new Date().toISOString(),
      );
      return res.status(201).json(db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id));
    });

    // Weather via Open-Meteo (real live API, no API key required)
    app.get('/api/weather', requireAuth, async (req: AuthRequest, res) => {
      const lat = Number(req.query.lat || 22.5726);
      const lng = Number(req.query.lng || 88.3639);
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code`;
        const weatherRes = await fetch(url);
        if (!weatherRes.ok) throw new Error('Open-Meteo unavailable');
        const data = (await weatherRes.json()) as {
          current?: { temperature_2m: number; relative_humidity_2m: number; weather_code: number; time: string };
        };
        return res.json({
          source: 'Open-Meteo Live API',
          latitude: lat,
          longitude: lng,
          temperature_c: data.current?.temperature_2m ?? 28.5,
          humidity_pct: data.current?.relative_humidity_2m ?? 76,
          weather_code: data.current?.weather_code ?? 1,
          updated_at: data.current?.time ?? new Date().toISOString(),
        });
      } catch {
        return res.json({
          source: 'Fallback Regional Baseline (Open-Meteo unreachable)',
          latitude: lat,
          longitude: lng,
          temperature_c: 29.0,
          humidity_pct: 74,
          weather_code: 2,
          updated_at: new Date().toISOString(),
        });
      }
    });
  }

  // Same-origin cached map tile proxy so every computer loads real street maps without "API Key Required" or "Access blocked" errors
  const tileCache = new Map<string, { buf: Buffer; contentType: string }>();
  app.get('/api/map-tiles/:z/:x/:y.png', async (req, res) => {
    const z = Number(req.params.z);
    const x = Number(req.params.x);
    const y = Number(req.params.y);
    if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) || z < 0 || z > 19) {
      return res.status(400).end();
    }
    const cacheKey = `${z}/${x}/${y}`;
    const cached = tileCache.get(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(cached.buf);
    }

    const providers = [
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`,
      `https://a.tile.openstreetmap.fr/osmfr/${z}/${x}/${y}.png`,
      `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    ];
    for (const url of providers) {
      try {
        const tileRes = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AgriNovaApp/1.0)' },
        });
        if (tileRes.ok) {
          const contentType = tileRes.headers.get('content-type') || 'image/png';
          if (!contentType.startsWith('image/')) continue;
          const buf = Buffer.from(await tileRes.arrayBuffer());
          if (buf.byteLength > 100) {
            if (tileCache.size >= 450) {
              const oldest = tileCache.keys().next().value;
              if (oldest) tileCache.delete(oldest);
            }
            tileCache.set(cacheKey, { buf, contentType });
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.send(buf);
          }
        }
      } catch {
        // Try next tile provider
      }
    }
    return res.status(502).end();
  });

  app.get('/export/AgriNova.zip', (_req, res) => {
    const tmpZip = '/tmp/AgriNova.zip';
    if (!fs.existsSync(tmpZip)) {
      return res.status(404).json({ detail: 'Archive not found.' });
    }
    return res.download(tmpZip, 'AgriNova.zip');
  });

  app.use('/api', (_req, res) => {
    return res.status(404).json({ detail: 'API endpoint not found.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Listen without an IPv4-only host so Windows 11 Chrome localhost (IPv6 ::1) AND 127.0.0.1 both connect cleanly
  const server = httpServer.listen(PORT, () => {
    console.log(`SmartFoodChain AI running at http://localhost:${PORT} (IPv4: http://127.0.0.1:${PORT})`);
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Close the existing server or set PORT=3001 before running npm run dev.`);
    } else {
      console.error('Server listen error:', err.message);
    }
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
