# EcoTwin — Production Deployment & Verification Checklist

This runbook defines the controlled, manual deployment procedure for the EcoTwin AI Digital Sustainability Platform onto Cloudflare Pages.

---

## 1. Pre-Deployment Configuration & Secrets Audit

### A. Cloudflare Pages Secrets (Encrypted at Rest)
Configure these in the Cloudflare Dashboard under **Workers & Pages → webapp → Settings → Variables and Secrets**:

| Secret Name | Purpose | Sensitivity | Fallback Behavior if Omitted |
| :--- | :--- | :---: | :--- |
| `GEMINI_API_KEY` | Primary Gemini API key for EcoTwin AI conversational agent | Secret | Graceful fallback to deterministic environmental telemetry |
| `GEMINI_API_KEY_FALLBACK_1` | First backup key for automatic failover on HTTP 429/503 | Secret | Cascades to Fallback 2 or local telemetry fallback |
| `GEMINI_API_KEY_FALLBACK_2` | Second backup key for high availability | Secret | Cascades to local telemetry fallback |

> [!IMPORTANT]
> **Zero-Secret Client Policy**: Confirm that no secrets are embedded in client bundles. Secrets must remain strictly server-side inside Cloudflare Worker runtime bindings (`c.env`). Local `.env` and `.dev.vars` files are Git-ignored and must never be committed.

### B. Cloudflare Pages Environment Variables (Plaintext)
| Variable Name | Required Value | Purpose |
| :--- | :--- | :--- |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Supported, high-speed multimodal Gemini endpoint |
| `NODE_ENV` | `production` | Enables production optimizations and disables debug traces |

### C. Authentication Architecture & In-Memory State Limitation
> [!WARNING]
> **Distributed Multi-Isolate Session Limitation**: User records and session tokens (`sessions`, `users`) are held in memory within the active Cloudflare Worker isolate. In distributed serverless environments spanning multiple edge datacenters or during isolate cold starts, session tokens may not persist across isolates.
> 
> *Production Recommendation*: For high-concurrency enterprise deployments with continuous multi-region session persistence, bind Cloudflare KV (`KV_SESSIONS`) or Cloudflare D1 (`D1_USERS`). For demo, hackathon, and staging evaluation, the in-memory architecture is fully operational with PBKDF2 password hashing (100,000 iterations) and 24-hour expiry.

---

## 2. Build & Verification Commands

All build commands must run cleanly from the repository root:

```bash
# 1. Clean build of Cloudflare Pages SSR worker and static assets
npm run build

# 2. Security remediation test suite (46 assertions)
node test_security.js

# 3. Gemini multi-key failover & canvas isolation test suite (45 assertions)
node test_part3.js

# 4. Data integrity, mathematical bounds & honest attribution test suite (98 assertions)
node test_part4.js

# 5. Full 10-journey end-to-end QA regression suite (81 assertions)
node test_part5.js
```

### Expected Output:
- `npm run build`: Exit Code `0`, outputs `dist/_worker.js` (~174 kB) and `dist/static/`
- All 4 test suites: **270 / 270 Passed, 0 Failed, Exit Code 0**

---

## 3. Local Production Preview Test (Smoke Test)

Before deploying to live infrastructure, run the Cloudflare Pages local emulator:

```bash
# Preview production bundle with Cloudflare Pages Worker runtime
npx wrangler pages dev dist --port 8788
```

Verify in the browser at `http://localhost:8788/`:
- [ ] **Home Dashboard**: Confirm all 4 Plotly charts render (Top 12 Bar, Score Donut, Renewable Scatter, 10-Yr Trend).
- [ ] **3D Globe Canvas**: Navigate to `3D Globe` tab. Confirm Three.js sphere, starfield, glowing atmosphere, and interactive country markers render.
- [ ] **World Map**: Navigate to `World Map` tab. Confirm Plotly choropleth map renders with 0–100 score colorscale.
- [ ] **AI Satellite**: Navigate to `AI Satellite` tab. Confirm NASA optical feed, vision overlay, and environmental minimap render.
- [ ] **Scenario Simulator**: Navigate to `Simulator` tab. Confirm interactive sliders project deterministic trajectories.
- [ ] **Ask AI**: Test sending a question. Confirm Gemini responds with structured markdown and suggestions.

---

## 4. Controlled Deployment Execution

Execute deployment only after explicit authorization:

```bash
# Deploy to Cloudflare Pages (Direct Upload)
npx wrangler pages deploy dist --project-name webapp
```

Or via package script:
```bash
npm run deploy
```

---

## 5. Post-Deployment Verification (Production URL)

Immediately following deployment to `https://<project-name>.pages.dev`:

1. **Static Assets Edge Check**:
   - Verify `https://<url>/static/vendor/three.min.js` returns HTTP 200.
   - Verify `https://<url>/static/vendor/plotly.min.js` returns HTTP 200.
   - Verify `https://<url>/static/app.js` returns HTTP 200.
   - Verify `https://<url>/static/style.css` returns HTTP 200.

2. **Core API Health Check**:
   - `GET /planet_health` → returns HTTP 200 with composite score and dimensions.
   - `GET /world_data` → returns HTTP 200 with `X-Data-Provenance` header.
   - `POST /ai_query` → test with payload `{"question": "What is the global carbon price?"}`. Verify response status is `ok`.

3. **Authentication Verification**:
   - Test login with authorized credentials at `/auth/login`.
   - Verify protected routes (`/admin/stats`, `/admin/users`) return HTTP 401 when unauthenticated and HTTP 403 for non-admin roles.
   - Test logout at `/auth/logout` and verify token revocation.

---

## 6. Emergency Rollback Plan

If visual regressions, upstream quota exhaustion, or edge deployment failures occur:

### Option A: Cloudflare Dashboard Instant Rollback (Zero Downtime)
1. Go to **Workers & Pages → webapp → Deployments**.
2. Locate the previous known-good deployment (Commit `9589646` or verified visual repair commit).
3. Click the three dots `...` next to the deployment and select **Rollback to this deployment**.

### Option B: CLI Redeployment of Known-Good Commit
```bash
# Checkout last known-good commit
git checkout 9589646

# Rebuild clean artifacts
npm run build

# Redeploy known-good build
npx wrangler pages deploy dist --project-name webapp
```
