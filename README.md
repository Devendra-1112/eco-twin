# 🌍 EcoTwin — Smart City Digital Twin Platform

## Project Overview
- **Name**: EcoTwin Smart City Digital Twin
- **Goal**: A comprehensive, AI-assisted sustainability intelligence platform for tracking, predicting, and optimizing global environmental metrics
- **Tech Stack**: Hono + TypeScript + Vanilla CSS + Plotly + Three.js + Chart.js + Google Gemini API
- **Deployment**: Edge-ready SSR (Cloudflare Pages / Node.js)

## 🚀 Getting Started

### Prerequisites
- Node.js v18.0.0+ (v20+ recommended)
- npm v9+

### Startup
```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Or build production SSR bundle & preview
npm run build
npm run preview
```
- **Local Dev URL**: `http://localhost:5173`
- **Demo Credentials**:
  - **Admin**: `admin@ecotwin.ai` / `admin123`
  - **Analyst**: `analyst@ecotwin.ai` / `demo123`

---

## 🧩 Core Modules & Architecture

### 1. 📊 Executive Dashboard & Global Telemetry
- Global KPI cards (60+ countries, composite planet health score, CO₂ run rates, renewable shares)
- Top 10 countries sustainability ranking
- Scatter correlation between renewable penetration and per-capita emissions
- 10-year historical trajectory trendlines (2015–2025)
- Real-time animated ticker with live carbon pricing corridors and atmospheric CO₂ levels

### 2. 🗺️ Interactive World Sustainability Map & 3D Globe
- Choropleth world map (Plotly Geo) with green/amber/crimson performance categorization
- Interactive Three.js 3D WebGL globe with atmospheric glow, starfields, and clickable telemetry beacons
- Country profile drawer with socio-economic context enriched via REST Countries API
- 5-year trend projections and empirical SDG progress

### 3. 🔮 Predictive Scenario Simulator
- Multi-factor dynamic projection model (2025–2035) with adjustable policy levers:
  - Renewable Energy Share (%)
  - Recycling Rate (%)
  - Clean Water Access (%)
  - CO₂ Emissions Target (t/capita)
  - Population Growth Rate (%)
- Deterministic simulation mode with configurable PRNG seed ($42$) for reproducible scientific analysis
- Confidence bounds envelope (upper/lower variance bounds) computed over the 10-year temporal horizon
- Scenario comparison engine evaluating baseline vs. intervention deltas and net emissions avoided

### 4. ⚖️ Explainable Feature Attribution (SHAP-style)
- Additive linear feature contribution analysis
- Waterfall decomposition explaining exactly how each environmental lever shifts the predicted score from the baseline ($61.0$)
- Strict mathematical adherence: $\sum \text{contributions} = \text{Score} - \text{Base}$

### 5. 🧠 Policy Target Optimizer
- Parameterized gradient-decay multi-objective search algorithm
- Finds balanced lever allocations that converge toward desired sustainability targets
- Visual convergence curves showing metric optimization over evaluation cycles

### 6. 🛰️ Remote Sensing & NASA Satellite Imagery
- Integration with NASA GIBS VIIRS True-Color Corrected Reflectance optical tiles (250m resolution)
- Synthetic computer vision defect localization overlays (deforestation zones, industrial heat islands, glacial retreat)
- Hotspot telemetry and environmental threat correlation via live NASA EONET feed

### 7. ⚠️ Environmental Anomaly Detection & Hazard Triage
- 30-day temporal baseline monitoring with severity thresholding
- Detection of industrial pollution spikes, wildfire surges, and power grid stress events
- Triage action recommendations and historical incident log

### 8. 🎯 UN SDG Progress Tracker & City Benchmarking
- Tracking of SDGs 6, 7, 11, 13, 14, and 15 with multi-axis radar charts and sparklines
- Municipal benchmarking across 15 global cities with live Open-Meteo weather and AQI enrichment
- Policy simulation matrix computing cost-effectiveness, job creation, and carbon mitigation

### 9. 💬 Resilient EcoTwin AI Analyst
- Conversational intelligence powered by Google Gemini (`gemini-1.5-flash`)
- Server-side execution ensuring API keys are never exposed to the client
- Automatic failover cascading across fallback keys (`GEMINI_API_KEY_FALLBACK_1`, `FALLBACK_2`)
- Local telemetry fallback grounding if external APIs are unreachable or offline

### 10. 🛡️ Secure Role-Based Administration
- Bcrypt password hashing ($10$ rounds) and cryptographically random session tokens (`et_...`)
- Role-based route authorization (`admin` vs `analyst` vs `viewer`)
- Complete credential zeroization (passwords and OTPs never transmitted to client)
- Audit log and active session management

---

## 🏷️ Data Provenance Framework

EcoTwin maintains complete transparency regarding data provenance. Every metric and layer is classified into five rigorous tiers:
- 🟢 **Live external data**: Retrieved directly from external APIs (Open-Meteo, NASA EONET, Gemini AI).
- 🔵 **Retrieved external data**: Real cached datasets (REST Countries, NASA GIBS optical tiles).
- 💠 **Calculated estimate**: Deterministic formulas from scientific baselines (IPCC AR6 Carbon Budget).
- 🟣 **Heuristic result**: Parameterized algorithms (Scenario Projections, Additive Feature Attribution, Policy Optimization).
- 🟡 **Simulated demo data**: Procedurally generated IoT telemetry and synthetic vision overlays for demonstration.

For full technical specifications, see [`DATA_TRUST_REPORT.md`](file:///c:/Users/HP/Downloads/eco%20twin/eco%20twin/DATA_TRUST_REPORT.md).

---

## 🧪 Verification & Testing

EcoTwin includes 270 comprehensive regression tests across 4 suites:

```bash
# Run security & authentication tests (46 tests)
node test_security.js

# Run Gemini AI failover & error resilience tests (45 tests)
node test_part3.js

# Run data trust, honest representation & provenance tests (98 tests)
node test_part4.js

# Run end-to-end QA, journey workflows & edge resilience tests (81 tests)
node test_part5.js
```

---

## 📖 Live Demonstration Runbook
For the 3–5 minute live presentation flow and technical judge Q&A guide, refer to [`HACKATHON_DEMO_RUNBOOK.md`](file:///c:/Users/HP/Downloads/eco%20twin/eco%20twin/HACKATHON_DEMO_RUNBOOK.md).
