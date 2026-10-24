# EcoTwin — Data Trust & Model Integrity Report

**Platform:** EcoTwin Smart City Digital Twin  
**Audit Date:** October 2026  
**Auditor:** Antigravity AI Engine (Part 4 Verification)  
**Status:** Defensible, Transparent & Audited for Live Demonstration  

---

## 1. Executive Summary

This report establishes the data provenance, algorithmic reality, and operational resilience of all data streams and analytical modules in the EcoTwin Smart City Digital Twin platform.

In preparation for live hackathon demonstration and technical evaluation:
1. **Zero Fake Models:** All claims of non-existent neural networks (e.g., custom trained LSTM forecasting, deep reinforcement learning agents such as DQN/PPO, trained CNN vision models, and trained Isolation Forests) have been replaced with honest, technically defensible descriptions of the deterministic formulas, heuristic optimizers, and synthetic pipelines actually running in the application.
2. **Clear Provenance:** Every metric, map layer, and simulation is classified into one of five rigorous provenance tiers:
   - **Live External Data:** Direct, real-time retrieval from public APIs (Open-Meteo, NASA EONET, Gemini AI).
   - **Retrieved External Data:** Real external datasets cached for freshness and rate-limit preservation (REST Countries, NASA GIBS WMTS imagery).
   - **Deterministic Calculation:** Mathematical transformations based on empirical frameworks (IPCC AR6 Carbon Budget, Paris Agreement trajectories).
   - **Heuristic Result:** Parameterized multi-factor estimation, additive feature contribution, and optimization algorithms.
   - **Simulated Demo Data:** Procedurally generated sensor telemetry and synthetic vision overlays created for interactive platform demonstration.
3. **Resilience & Fallbacks:** All external dependencies are wrapped in bounded timeouts and graceful fallbacks. When an external service is unavailable, the platform automatically switches to cached or baseline data and explicitly flags the fallback in the UI.

---

## 2. Feature & Model Inventory

| Feature & Endpoint | Provenance Tier | Actual Source or Algorithm | Live Dependencies | Fallback Behavior | Known Limitations |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Global Countries Data**<br>`/world_data` | **Retrieved External Data + Base Model** | Base socio-economic indicators from World Bank/UN datasets merged with dynamic metadata (flags, capitals, currencies, languages) from REST Countries v3.1. | REST Countries API (`restcountries.com`) | 1-hour cache; returns baseline static country dataset with `fallback: true` if API is unreachable. | Base sustainability metrics are curated reference baselines; dynamic fluctuations represent demo time-variance. |
| **Real-Time Sensor Feed**<br>`/realtime`, `/sse/live` | **Live External Data + Simulated Sensor Stream** | Live weather (temperature, humidity, wind) and European AQI from Open-Meteo for 12 global cities; energy, water, noise, and traffic sensor readings generated via diurnal sine curves with Gaussian noise. | Open-Meteo Weather & Air Quality APIs | 10-minute cache per city; if Open-Meteo times out (4s), falls back to diurnal synthetic weather and flags `isRealWeather: false`. | Municipal energy, water, and traffic are simulated IoT streams calibrated to typical city diurnal curves, not physical smart meters. |
| **City Weather Enrichment**<br>`/weather/:city`, `/weather/bulk` | **Live External Data** | Real temperature, humidity, wind speed, and weather condition codes directly from Open-Meteo. | Open-Meteo Forecast API | 10-minute cache; graceful JSON fallback with warning flag if city lookup fails. | Limited to 15 configured global cities with geographic coordinates. |
| **Natural Hazard Events**<br>`/threat_forecast` | **Live External Data + Heuristic Model** | Active natural hazard events (wildfires, severe storms, volcanoes, ice events) retrieved directly from NASA EONET v3. | NASA Earth Observatory Natural Event Tracker (EONET v3) | 30-minute cache; falls back to curated historical hazard baseline if NASA EONET is offline. | EONET tracks major natural events; local municipal micro-hazards are not captured. |
| **EcoTwin AI Analyst**<br>`/ai_query` | **Live External Data (Google Gemini)** | Server-side execution of Google Gemini 1.5 Flash via `@google/generative-ai` with structured JSON output and system instructions. | Google Gemini API (`GEMINI_API_KEY`) | 10s per-key timeout; automatic failover to `GEMINI_API_KEY_FALLBACK_1` and `FALLBACK_2` on 429/503 errors; safe guidance mode if unconfigured. | Responses depend on upstream Google Cloud availability and rate limits; no internal fine-tuned weights. |
| **10-Year Scenario Projection**<br>`/simulate_future`, `/simulate/compare` | **Heuristic Result (Deterministic / Seeded)** | Weighted multi-factor policy model (renewable share, recycling, water access, energy efficiency, clean transport, population growth) computing compound trajectories and confidence intervals. | None (runs in-memory) | N/A (100% deterministic or PRNG-seeded; no external call) | Not a scientifically trained LSTM or physics climate model; intended for interactive policy tradeoff analysis. |
| **Feature Contribution**<br>`/shap/explain` | **Heuristic Result** | Additive feature attribution calculating per-indicator contribution margins against a baseline score (61 pts). | None (runs in-memory) | N/A (deterministic calculation) | Uses mathematical additive attribution formulas; not true Shapley values computed across thousands of permutations. |
| **Policy Target Optimizer**<br>`/rl_optimize` | **Heuristic Result** | Parameterized gradient-decay optimization simulating policy convergence toward user-specified environmental targets. | None (runs in-memory) | N/A (runs in-memory) | Simulates policy convergence dynamics; does not train deep neural network policies (DQN/PPO) in browser or worker. |
| **Carbon Budget Tracker**<br>`/carbon_budget`, `/carbon_budget/scenario` | **Deterministic Calculation** | Mathematical carbon exhaustion countdown based on IPCC AR6 remaining carbon budgets (380 Gt CO₂ for 1.5°C; 1150 Gt CO₂ for 2.0°C) and current global run rate (~36.8 Gt/yr). | None (runs in-memory) | N/A (deterministic) | Assumes uniform global emissions run rate unless policy intervention scenario is applied. |
| **Carbon & Energy Market**<br>`/market_data`, `/global_ticker` | **Deterministic Calculation + Demo Fluctuations** | Calibrated to real EU ETS carbon credit ranges (€60–€80/tonne) and atmospheric CO₂ trend (~422.5 ppm seasonal curve) with diurnal oscillation. | None (runs in-memory) | N/A (runs in-memory) | Simulates live market microstructure within real-world price corridors. |
| **City Benchmarking & Policy Sim**<br>`/cities`, `/city_benchmark`, `/policy_sim`, `/peer_compare` | **Deterministic Calculation + Heuristic Impact Matrix** | Multi-attribute ranking across 15 global cities; policy impact matrix with empirically grounded elasticities (costs, job creation, CO₂ reduction per policy). | Open-Meteo for city weather enrichment | City scores calculate deterministically regardless of weather API availability. | Policy elasticities are derived from published municipal case studies, but do not capture local legislative delays. |
| **Satellite Imagery**<br>`/satellite/regions`, `/satellite/analyze/:regionId` | **Retrieved External Data** | True-color optical satellite imagery tiles (VIIRS Corrected Reflectance, 250m resolution) fetched directly from NASA GIBS WMTS. | NASA Global Imagery Browse Services (GIBS) | Pre-validated tile coordinates; fallback tile URL provided if specific date tile is unavailable. | Satellite tiles are optical true-color composites; resolution is 250m/pixel (global overview, not meter-level). |
| **Satellite Vision Overlays**<br>`/satellite/analyze/:regionId`, `/satellite/live_feed` | **Simulated Demo Data** | Synthetic bounding boxes, activation heatmaps, and land-use change classifications demonstrating an automated computer vision pipeline. | None (runs in-memory) | N/A (runs in-memory) | Bounding boxes and heatmaps are synthetic demonstration overlays on genuine NASA imagery, not an active PyTorch CNN. |
| **Anomaly Detection**<br>`/anomaly_data` | **Simulated Demo Data** | Time series generator demonstrating industrial pollution spikes, wildfire surges, and grid events with severity classifications. | None (runs in-memory) | N/A (deterministic calendar distribution) | Synthetic demonstration of anomaly detection triage; not a live unlabelled sensor feed. |
| **Seismic & Ocean Risk**<br>`/satellite/ocean_temps`, `/satellite/seismic_risk`, `/satellite/wind_patterns` | **Calculated Estimate + Demo Synthesis** | Ocean temperatures calibrated to NOAA SST ranges with Degree Heating Week (DHW) coral bleaching thresholds; seismic risk based on major tectonic plate boundaries. | None (runs in-memory) | N/A (in-memory simulation) | Simulates global physical earth systems using real physical boundary coordinates and physics-inspired harmonics. |

---

## 3. Data Provenance Taxonomy

To ensure judges, developers, and users always know what they are looking at, EcoTwin displays standard provenance badges across the UI:

| Badge & Color | Definition | When to Use |
| :---: | :--- | :--- |
| <span style="color:#10b981">● Live external data</span> | Data received directly from an external API within the last refresh cycle. | Open-Meteo live weather, NASA EONET active hazard events, live Gemini AI responses. |
| <span style="color:#3b82f6">● Retrieved external data</span> | Real external data retrieved and cached to satisfy freshness requirements and API limits. | REST Countries metadata, NASA GIBS optical satellite tiles. |
| <span style="color:#06b6d4">● Calculated estimate</span> | Deterministic mathematical calculation derived from real-world scientific data or empirical constants. | IPCC Carbon Budget exhaustion countdown, city benchmark rankings, climate risk indices. |
| <span style="color:#8b5cf6">● Heuristic result</span> | Algorithmic projection, attribution, or optimization using validated formulas rather than trained deep networks. | Multi-factor scenario projection, additive feature contribution, heuristic policy optimization. |
| <span style="color:#f59e0b">● Simulated demo data</span> | Procedural or synthetic data generated to showcase platform capabilities and interactive workflows. | Synthetic sensor telemetry, anomaly spike demonstration, simulated vision bounding-box overlays. |

---

## 4. Remediation of Misleading Claims

During Part 4, the codebase was thoroughly audited to eliminate exaggerated AI/ML claims:

1. **"LSTM-v3.0+CI Forecasting":**
   - *Previous claim:* Claimed a recurrent LSTM deep neural network was running 10-year projections with 95% confidence intervals.
   - *Reality:* The calculation was a weighted arithmetic compound growth model with unseeded random noise.
   - *Fix:* Relabeled in UI and API as **"10-Year Multi-Factor Scenario Projection"** (`Heuristic Multi-Factor Projection v3.1`). Seeded random noise with deterministic reproducibility mode.
2. **"Deep Q-Network (DQN) / PPO Reinforcement Learning":**
   - *Previous claim:* Claimed live reinforcement learning agent training with DQN and PPO in the browser.
   - *Reality:* A client-side visual loop with exponential reward decay formulas.
   - *Fix:* Relabeled in UI and API as **"Heuristic Policy Optimizer"** (`Gradient-Decay Convergence Model`). Explicitly explains policy search mechanics without claiming deep neural network training.
3. **"LSTM+SHAP Hybrid Model with 92.4% Confidence":**
   - *Previous claim:* Claimed a hybrid LSTM+SHAP model with fabricated 92.4% accuracy.
   - *Reality:* Additive feature contribution delta from baseline (61 pts).
   - *Fix:* Relabeled in UI and API as **"Additive Feature Contribution Estimate"**. Removed invented confidence percentages; labeled as formula-based attribution.
4. **"EcoTwin-CNN-v2.1 Satellite Vision Model":**
   - *Previous claim:* Claimed a deep convolutional neural network segmenting satellite imagery in real-time.
   - *Reality:* Real NASA GIBS optical tiles rendered with synthetic bounding boxes and sine-wave heatmaps.
   - *Fix:* Relabeled in UI and API as **"Simulated Vision Pipeline (Demo Overlay)"**. Clearly distinguishes between genuine NASA optical satellite imagery and synthetic feature detection overlays.
5. **"EcoTwin-ThreatNet-v3 with 84.7% Accuracy":**
   - *Previous claim:* Claimed a trained ThreatNet-v3 neural network with 84.7% accuracy.
   - *Reality:* NASA EONET live event ingestion with heuristic risk categorization.
   - *Fix:* Relabeled in UI and API as **"Environmental Threat Index (NASA EONET / Risk Model)"**. Removed invented accuracy metrics.

---

## 5. Resilience & Fallback Architecture

### A. Network Timeout Matrix
| Service | Timeout | Behavior on Timeout | Provenance on Timeout |
| :--- | :---: | :--- | :--- |
| **Open-Meteo Weather** | 4,000 ms | Uses cached weather if fresh (<10m); else generates calibrated seasonal estimate. | Automatically flips from `Live external data` to `Simulated demo data (weather API offline)`. |
| **REST Countries** | 4,000 ms | Uses cached country metadata (<1h); else falls back to baseline static country data. | Automatically flips to `Retrieved external data (cached/fallback)`. |
| **NASA EONET** | 4,000 ms | Uses cached natural events (<30m); else falls back to curated hazard baseline. | Automatically flips to `Heuristic Baseline (NASA EONET Offline)`. |
| **NASA GIBS Tile Probe** | 3,000 ms | Non-blocking HEAD request; falls back to verified MODIS Terra tile if probe fails. | Sets `imageAvailable: false` with fallback URL. |
| **Google Gemini AI** | 10,000 ms | Tries primary key; if 429/503 or timeout, tries fallback 1, then fallback 2. | Clear error with developer guidance; never leaks credentials. |

### B. Worker Compatibility
All external requests use standard `fetch` with `AbortSignal.timeout(...)`. No Node.js-specific modules (`fs`, `child_process`, `net`) are used in runtime code, ensuring 100% compatibility with Cloudflare Workers and Cloudflare Pages SSR.

---

## 6. Hackathon Presentation & Live Demo Defense Guidelines

To deliver a completely defensible presentation to judges:

1. **Highlight Genuine Integrations:**
   - Demonstrate the **Open-Meteo live weather integration** in the real-time monitoring view.
   - Demonstrate the **NASA GIBS optical imagery viewer** showing genuine 250m satellite passes over the Amazon, Borneo, and Congo basins.
   - Demonstrate the **NASA EONET live hazard tracker** showing active open natural events.
   - Demonstrate the **Google Gemini AI chat** answering natural-language urban sustainability questions.
2. **Present Simulations Transparently:**
   - Explain the **10-Year Scenario Projection** as an interactive policy simulation tool that models tradeoffs based on empirical policy weights.
   - Explain that **Satellite Bounding Boxes** demonstrate how an automated computer vision inference pipeline presents detections to urban planners.
3. **Showcase Provenance Indicators:**
   - Point out the provenance badges in the top-right of cards and charts to show technical honesty and enterprise-grade data governance.
