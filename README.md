# AgriNova

> **Smarter Supply Chains. Fresher Food. Less Waste.**  
> Farm-to-Market Supply Chain & Cold-Chain Intelligence Platform (`Farmer -> Warehouse -> Transporter -> Retailer -> Consumer`)

---

## Key Features

- **5 Role Workspaces with Real Backend RBAC**:
  - **Farmer Mode (Simple UI)**: 5 large touch-friendly actions (*My Crops, Add Crops, Sell My Products, Track My Delivery, My Payments*) plus Help, Alerts, and Account.
  - **Transporter Console (12 Languages + Voice Help)** & **Warehouse Manager, Retailer & Admin Consoles (English-only)**: Full inventory CRUD, shipment dispatch & 9-stage status updates, live maps, AI spoilage assessment, IoT charts, food redistribution, QR traceability, subscriptions, payment settlements, and RBAC user management.
- **Farmer & Transporter Multilingual Experience (12 Languages)**:
  - English (`en`), Bengali (`bn`), Hindi (`hi`), Assamese (`as`), Odia (`or`), Punjabi (`pa`), Marathi (`mr`), Tamil (`ta`), Telugu (`te`), Gujarati (`gu`), Kannada (`kn`), and Malayalam (`ml`).
  - Browser Speech-to-Text & Text-to-Speech with **automatic Server-Side Gemini AI Voice (`POST /api/tts` & `POST /api/transcribe`)** fallback so Bengali and regional voices play naturally in any browser even without OS speech packs.
  - Admin, Warehouse, and Retailer interfaces remain strictly English-only (enforced on both UI and backend API).
- **AI Spoilage Prediction & IoT Cold-Chain Monitoring**:
  - Transparent category-calibrated spoilage risk scoring (`Low`, `Medium`, `High`, `Critical`) based on temperature, humidity, storage duration, and transport delay.
  - Simulated ESP32/Arduino telemetry feed chart + live **Open-Meteo** weather integration.
- **Live Leaflet Map, QR Traceability & Reports**:
  - Track origin, live simulated truck marker, and destination on OpenStreetMap.
  - Scannable QR codes, Camera QR Scanner (with manual fallback), and downloadable **PNG, JPG, and Print/PDF** shipment reports.
- **Surplus Food Redistribution & FoodBot**:
  - Route at-risk produce to NGO food rescue or discounted surplus buyers.
  - Built-in **FoodBot** assistant, Searchable Help Guides & FAQ, and Support Tickets.
- **Coffee, Light, Dark & Auto Themes**:
  - Default artisanal warm **Coffee** theme alongside **Light**, **Dark**, and **Auto** system themes persisted to `localStorage` and user profile.

---

## Transparent Demo & Simulation Disclosures

For fair competition judging and transparency:
- **Google Login (Demo)** & **Phone OTP (Demo)** are simulated flows requiring no external OAuth keys or SMS gateways.
- **IoT Cold-Chain Feed** is a simulated ESP32/Arduino data stream (webhook-ready for hardware integration).
- **Spoilage AI Engine** is a transparent rule-based baseline calibrated per crop category (ready for historical ML training data).
- **Subscriptions, Multi-Currency Revenue & Demo Invoices** are simulated demonstration figures.
- **Weather Data** uses the real public **Open-Meteo API** (with automatic offline fallback).

---

## Demo Login Credentials (Password for all: `Demo@2026!`)

| Role | Email | Interface Language |
| --- | --- | --- |
| **Farmer** | `farmer@agrinova.ai` | 12 Indian Regional Languages + English |
| **Transporter** | `transporter@agrinova.ai` | 12 Indian Regional Languages + English |
| **Warehouse Manager** | `warehouse@agrinova.ai` | English Only |
| **Retailer** | `retailer@agrinova.ai` | English Only |
| **System Admin** | `admin@agrinova.ai` | English Only |

---

## Beginner Setup Guide (Windows 11 & VS Code)

### Prerequisites
1. Install **Node.js 20+** from [nodejs.org](https://nodejs.org/)
2. Install **Python 3.11+** from [python.org](https://www.python.org/) (check *"Add Python to PATH"* during install)
3. Install **Git** and **VS Code**

### Option A: Quick Single-Command Start (Recommended for Demo & Development)
This runs Express + Vite + SQLite (`smartfoodchain.db`) on **http://localhost:3000**:

```powershell
# 1. Install dependencies
npm install

# 2. Start the full-stack development server
npm run dev
```
Open **http://localhost:3000** in your browser.

### Option B: Run with Python FastAPI Backend + React Frontend
1. Open Terminal 1 (Python FastAPI on port `8000`):
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
2. Open Terminal 2 (Frontend + API proxy on port `3000`):
```powershell
$env:USE_PYTHON_BACKEND="true"
npm run dev
```

### Production Build Check
```powershell
npm run lint
npm run build
```

---

## Core Backend API Endpoints

- `GET /api/health` — Service & phase status
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/demo-login`, `POST /api/auth/logout`
- `POST /api/auth/google-demo`, `POST /api/auth/otp/request-demo`, `POST /api/auth/otp/verify-demo`
- `GET /api/auth/me`, `PUT /api/auth/profile`, `PUT /api/auth/change-password`, `DELETE /api/auth/account`
- `GET /api/auth/sessions`, `DELETE /api/auth/sessions/{id}`
- `GET /api/dashboard/overview` — Live inventory, spoilage & shipment metrics
- `GET /api/rbac/farmer/summary`, `GET /api/rbac/supply-chain/summary`, `GET /api/rbac/admin/users`
- `GET/POST/PUT/DELETE /api/products` — Crop & cold-chain batch management
- `GET/POST /api/shipments`, `GET /api/shipments/lookup/{code}`, `PUT /api/shipments/{id}/update`
- `POST /api/ai/predict-spoilage` — Spoilage risk score & preventive guidance
- `GET /api/iot/readings`, `POST /api/iot/simulate` — Simulated IoT sensor stream
- `GET/POST /api/redistributions`, `PUT /api/redistributions/{id}/status` — NGO & surplus food rescue
- `GET /api/payments`, `PUT /api/payments/{id}/settle`, `POST /api/tts`, `POST /api/transcribe`, `GET/PUT/DELETE /api/notifications`, `GET/POST /api/tickets`, `GET /api/weather`

---

## Pushing to GitHub (`AgriNova`)

```powershell
git init
git add .
git commit -m "Complete AgriNova Supply Chain Platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/AgriNova.git
git push -u origin main
```

---

## Production Deployment Tips
- **Database**: Set `DATABASE_URL` in `.env` to a managed **PostgreSQL** instance when deploying FastAPI to Render / Railway / Fly.io.
- **Security**: Set a strong random `SECRET_KEY` environment variable in production (never commit `.env`).
- **Frontend**: Deploy `dist/` built via `npm run build` on Vercel / Cloudflare Pages with `VITE_API_BASE_URL` pointing to your backend URL, or deploy the Node full-stack server (`npm run build && npm start`) directly.
