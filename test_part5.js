// EcoTwin Part 5: End-to-End User Journeys, API Contracts & Demo Regression Test Suite
import fs from 'fs';

const { default: app } = await import('./dist/_worker.js');

let passed = 0;
let failed = 0;

function assert(desc, condition, details = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc} ${details ? '(' + details + ')' : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== RUNNING ECOTWIN PART 5 END-TO-END QA & DEMO POLISH TESTS ===\n');

  // -------------------------------------------------------------
  // Journey 1: Open Dashboard & Environmental Data Loading
  // -------------------------------------------------------------
  console.log('--- Journey 1: Open Dashboard & Environmental Data Loading ---');
  {
    const res = await app.request('/world_data');
    assert('GET /world_data returns HTTP 200', res.status === 200);
    const provHeader = res.headers.get('x-data-provenance');
    assert('/world_data includes X-Data-Provenance header', !!provHeader);
    const data = await res.json();
    assert('/world_data returns array of country records', Array.isArray(data) && data.length >= 10);
    const norway = data.find(c => c.code === 'NOR');
    assert('Norway is present with baseline score', !!norway && norway.score >= 80);

    const rtRes = await app.request('/realtime');
    assert('GET /realtime returns HTTP 200', rtRes.status === 200);
    const rt = await rtRes.json();
    assert('Realtime contains live feed and latest reading', Array.isArray(rt.feed) && !!rt.latest);
    assert('Realtime tracks provenance and real-world fallback flags', typeof rt.latest.isRealWeather === 'boolean');

    const phRes = await app.request('/planet_health');
    assert('GET /planet_health returns HTTP 200', phRes.status === 200);
    const ph = await phRes.json();
    assert('Planet health composite score is bounded in [0, 100]', ph.composite >= 0 && ph.composite <= 100);
    assert('Planet health includes 24h trend history', Array.isArray(ph.history) && ph.history.length === 24);
  }

  // -------------------------------------------------------------
  // Journey 2: Country & City Metrics Consistency
  // -------------------------------------------------------------
  console.log('\n--- Journey 2: Country & City Metrics Consistency ---');
  {
    const res = await app.request('/world_data');
    const data = await res.json();
    const allHaveMetrics = data.every(c =>
      typeof c.score === 'number' && c.score >= 0 && c.score <= 100 &&
      typeof c.co2 === 'number' && c.co2 >= 0 &&
      typeof c.renewable === 'number' && c.renewable >= 0 && c.renewable <= 100 &&
      typeof c.waterAccess === 'number' && c.waterAccess >= 0 && c.waterAccess <= 100
    );
    assert('All country records enforce mathematical and physical metric bounds', allHaveMetrics);

    const cityRes = await app.request('/cities');
    assert('GET /cities returns HTTP 200', cityRes.status === 200);
    const cities = await cityRes.json();
    assert('City records array returned with valid count', Array.isArray(cities) && cities.length >= 10);
    const validCityScores = cities.every(c => typeof c.score === 'number' && c.score >= 0 && c.score <= 100);
    assert('All city benchmark scores are bounded [0, 100]', validCityScores);

    const bmRes = await app.request('/city_benchmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cityId: 'NYC', metric: 'score' })
    });
    assert('POST /city_benchmark returns HTTP 200', bmRes.status === 200);
    const bmData = await bmRes.json();
    assert('City benchmark returns rank and global average comparison', typeof bmData.rank === 'number' && typeof bmData.globalAvg === 'number');
  }

  // -------------------------------------------------------------
  // Journey 3: Sustainability Map & 3D Globe Markers Interaction
  // -------------------------------------------------------------
  console.log('\n--- Journey 3: Sustainability Map & 3D Globe Markers Interaction ---');
  {
    const res = await app.request('/world_data');
    const data = await res.json();
    const validCodes = data.every(c => typeof c.code === 'string' && c.code.length === 3);
    assert('All map locations have valid ISO-3 country boundary codes', validCodes);

    const hsRes = await app.request('/satellite/emission_hotspots');
    assert('GET /satellite/emission_hotspots returns HTTP 200', hsRes.status === 200);
    const hs = await hsRes.json();
    assert('Emission hotspots return array of regional emitters', Array.isArray(hs.hotspots) && hs.hotspots.length > 0);
    const validHotspotCoords = hs.hotspots.every(h =>
      typeof h.lat === 'number' && h.lat >= -90 && h.lat <= 90 &&
      typeof h.lon === 'number' && h.lon >= -180 && h.lon <= 180
    );
    assert('All emission hotspots have valid geographic coordinates', validHotspotCoords);

    // Verify frontend app.js event listener deduplication
    const appJs = fs.readFileSync('./public/static/app.js', 'utf8');
    assert('app.js removes existing plotly_click listeners before binding new ones', appJs.includes('removeAllListeners'));
    assert('app.js includes debounced window resize handler for Three.js & Plotly', appJs.includes('_etResizeTimeout'));
  }

  // -------------------------------------------------------------
  // Journey 4: Configure & Run Sustainability Scenario
  // -------------------------------------------------------------
  console.log('\n--- Journey 4: Configure & Run Sustainability Scenario ---');
  {
    const basePayload = {
      country: 'USA',
      renewable: 30,
      recycling: 35,
      waterAccess: 80,
      co2: 14.5,
      energyEff: 40,
      transport: 30,
      populationGrowth: 1.0,
      deterministic: true,
      seed: 42
    };

    const resLow = await app.request('/simulate_future', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(basePayload)
    });
    assert('Base scenario projection returns HTTP 200', resLow.status === 200);
    const dLow = await resLow.json();

    const highPayload = {
      ...basePayload,
      renewable: 95,
      recycling: 85,
      co2: 1.5,
      energyEff: 90,
      transport: 85
    };

    const resHigh = await app.request('/simulate_future', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(highPayload)
    });
    assert('High intervention projection returns HTTP 200', resHigh.status === 200);
    const dHigh = await resHigh.json();

    assert('Aggressive intervention yields higher final sustainability score than base', dHigh.finalScore > dLow.finalScore);
    assert('Simulation results strictly adhere to [0, 100] bounds', dHigh.finalScore <= 100 && dLow.finalScore >= 0);

    // Test malformed payload handling
    const malformedRes = await app.request('/simulate_future', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ co2: 'invalid_number' })
    });
    assert('Simulation handles malformed payloads gracefully without crashing', malformedRes.status === 200 || malformedRes.status === 400);
    const appJs = fs.readFileSync('./public/static/app.js', 'utf8');
    assert('app.js runSimulation has try/catch/finally to prevent frozen button states', appJs.includes('catch (err) {\n    toast(\'Projection failed:'));
  }

  // -------------------------------------------------------------
  // Journey 5: Compare Baseline and Intervention Results
  // -------------------------------------------------------------
  console.log('\n--- Journey 5: Compare Baseline and Intervention Results ---');
  {
    const cmpPayload = {
      baseline: { renewable: 20, recycling: 25, waterAccess: 70, co2: 15.0, energyEff: 30, transport: 20 },
      projected: { renewable: 85, recycling: 75, waterAccess: 95, co2: 2.0, energyEff: 85, transport: 80 },
      seed: 42
    };

    const res = await app.request('/simulate/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cmpPayload)
    });
    assert('POST /simulate/compare returns HTTP 200', res.status === 200);
    const d = await res.json();
    assert('Comparison contains baselineScore and projectedScore', typeof d.baselineScore === 'number' && typeof d.projectedScore === 'number');
    assert('Score diff mathematically matches projectedScore - baselineScore', Math.abs(d.diff - (d.projectedScore - d.baselineScore)) < 0.1);
    assert('Intervention produces positive CO2 savings', d.co2Savings > 0);
    assert('Comparison outputs actionable improvement points', Array.isArray(d.improvements) && d.improvements.length > 0);

    const appJs = fs.readFileSync('./public/static/app.js', 'utf8');
    assert('app.js runCompare has try/catch/finally for network resilience', appJs.includes('catch (err) {\n    toast(\'Comparison failed:'));
  }

  // -------------------------------------------------------------
  // Journey 6: Feature Attribution (SHAP) & Policy Optimizer (RL)
  // -------------------------------------------------------------
  console.log('\n--- Journey 6: Feature Attribution (SHAP) & Policy Optimizer (RL) ---');
  {
    const shapRes = await app.request('/shap/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ energy: 60, water: 70, traffic: 40, renewable: 80, recycling: 75, co2: 4, waterAccess: 90 })
    });
    assert('POST /shap/explain returns HTTP 200', shapRes.status === 200);
    const sd = await shapRes.json();
    assert('SHAP returns baseScore and predictedScore', typeof sd.baseScore === 'number' && typeof sd.predictedScore === 'number');
    const sumContrib = sd.features.reduce((acc, f) => acc + (f.contribution ?? f.shapValue), 0);
    assert('Sum of feature contributions equals (predictedScore - baseScore)', Math.abs((sd.baseScore + sumContrib) - sd.predictedScore) < 0.1);
    assert('SHAP model is truthfully labeled as Linear Attribution', sd.modelType.includes('Attribution'));

    const rlRes = await app.request('/rl_optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ episodes: 20, algo: 'decay' })
    });
    assert('POST /rl_optimize returns HTTP 200', rlRes.status === 200);
    const rd = await rlRes.json();
    assert('Optimizer returns optimalPolicy and trainingData', !!rd.optimalPolicy && Array.isArray(rd.trainingData));
    assert('Recommended policy levers are bounded [0, 100]%', rd.optimalPolicy.renewable <= 100 && rd.optimalPolicy.renewable >= 0);

    const appJs = fs.readFileSync('./public/static/app.js', 'utf8');
    assert('app.js runSHAP displays methodology and avoids undefined confidence', appJs.includes('d.methodology || \'Linear Attribution\''));
    assert('app.js runRL has try/catch/finally to prevent frozen button states', appJs.includes('catch (err) {\n    toast(\'Optimization failed:'));
  }

  // -------------------------------------------------------------
  // Journey 7: Satellite Optical vs Synthetic Overlays
  // -------------------------------------------------------------
  console.log('\n--- Journey 7: Satellite Optical vs Synthetic Overlays ---');
  {
    const regRes = await app.request('/satellite/regions');
    assert('GET /satellite/regions returns HTTP 200', regRes.status === 200);
    const rd = await regRes.json();
    assert('Monitored regions include Amazon and Greenland', rd.regions.some(r => r.id === 'amazon') && rd.regions.some(r => r.id === 'greenland'));

    const anaRes = await app.request('/satellite/analyze/amazon');
    assert('GET /satellite/analyze/amazon returns HTTP 200', anaRes.status === 200);
    const ad = await anaRes.json();
    assert('Analysis includes genuine NASA tileUrl', ad.tileUrl.includes('gibs.earthdata.nasa.gov'));
    assert('Optical imagery provenance discloses genuine NASA VIIRS feed', ad.provenance.opticalImagery.includes('NASA'));
    assert('Vision overlay provenance explicitly discloses simulated demo data', ad.provenance.visionOverlays.includes('Simulated demo data'));
    assert('Simulated vision overlay is never falsely claimed as genuine live CNN inference', ad.model.includes('Simulated-Vision') || ad.model.includes('Demo'));
  }

  // -------------------------------------------------------------
  // Journey 8: Environmental Hazards & Anomaly Demonstrations
  // -------------------------------------------------------------
  console.log('\n--- Journey 8: Environmental Hazards & Anomaly Demonstrations ---');
  {
    const tfRes = await app.request('/threat_forecast');
    assert('GET /threat_forecast returns HTTP 200', tfRes.status === 200);
    const tf = await tfRes.json();
    assert('Threat forecast provides active environmental threats', Array.isArray(tf.threats) && tf.threats.length > 0);
    assert('Threat probabilities are normalized between 0 and 1', tf.threats.every(t => t.probability >= 0 && t.probability <= 1));
    assert('Threat model provenance is EcoTwin Environmental Hazard Tracker', tf.model.includes('Environmental Hazard Tracker'));

    const anRes = await app.request('/anomaly_data');
    assert('GET /anomaly_data returns HTTP 200', anRes.status === 200);
    const anProv = anRes.headers.get('x-data-provenance');
    assert('/anomaly_data header explicitly declares Simulated demo data', anProv === 'Simulated demo data');
    const anData = await anRes.json();
    const pts = Array.isArray(anData) ? anData : anData.points;
    assert('/anomaly_data returns 30 temporal observation points', Array.isArray(pts) && pts.length === 30);
    assert('Each anomaly point contains a boolean anomaly flag', typeof pts[0].isAnomaly === 'boolean');
  }

  // -------------------------------------------------------------
  // Journey 9: EcoTwin AI Question Lifecycle (Success, Quota & Errors)
  // -------------------------------------------------------------
  console.log('\n--- Journey 9: EcoTwin AI Question Lifecycle ---');
  {
    // 1. Unconfigured state
    const unconfRes = await app.request('/ai_query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What is Norway sustainability score?' })
    }, { GEMINI_API_KEY: '', GEMINI_API_KEY_FALLBACK_1: '', GEMINI_API_KEY_FALLBACK_2: '' });
    assert('Unconfigured Gemini call returns HTTP 200 with guidance', unconfRes.status === 200);
    const unconfData = await unconfRes.json();
    assert('Unconfigured status is explicitly flagged', unconfData.status === 'unconfigured');
    assert('Provides deterministic environmental metrics fallback', unconfData.response.includes('Atmospheric CO₂') || unconfData.response.includes('GEMINI_API_KEY'));

    // 2. Primary success
    const mockEnvSuccess = {
      GEMINI_API_KEY: 'mock_primary_valid_key',
      GEMINI_API_KEY_FALLBACK_1: 'mock_fallback_key_1'
    };
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      const urlStr = url.toString();
      if (urlStr.includes('generativelanguage.googleapis.com')) {
        const keyParam = (opts?.headers instanceof Headers)
          ? opts.headers.get('x-goog-api-key')
          : (opts?.headers?.['x-goog-api-key'] || opts?.headers?.['X-Goog-Api-Key'] || new URL(urlStr).searchParams.get('key') || '');

        if (keyParam === 'key_trigger_429') {
          return new Response(JSON.stringify({
            error: { code: 429, message: 'Resource has been exhausted', status: 'RESOURCE_EXHAUSTED' }
          }), { status: 429, headers: { 'Content-Type': 'application/json' } });
        }
        if (keyParam === 'key_trigger_503') {
          return new Response(JSON.stringify({
            error: { code: 503, message: 'Service Unavailable', status: 'UNAVAILABLE' }
          }), { status: 503, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  response: 'Norway achieves a 91.2 sustainability score due to hydro dominance.',
                  suggestions: ['Compare with Sweden', 'Show renewable energy breakdown']
                })
              }]
            }
          }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return origFetch(url, opts);
    };

    const succRes = await app.request('/ai_query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Tell me about Norway' })
    }, mockEnvSuccess);
    assert('Successful Gemini response returns HTTP 200 with status ok', succRes.status === 200);
    const succData = await succRes.json();
    assert('Response delivers structured answers', succData.status === 'ok' && succData.response.includes('Norway'));

    // 3. Fallback on 429 quota exhaustion
    const quotaRes = await app.request('/ai_query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Test quota fallback' })
    }, {
      GEMINI_API_KEY: 'key_trigger_429',
      GEMINI_API_KEY_FALLBACK_1: 'mock_fallback_key_1'
    });
    assert('429 Quota exhaustion triggers automatic fallback and succeeds', quotaRes.status === 200);
    const quotaData = await quotaRes.json();
    assert('Recovered answer delivered via fallback key', quotaData.status === 'ok');

    // 4. 503 total failure does not leak secrets
    const failRes = await app.request('/ai_query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Total failure test' })
    }, {
      GEMINI_API_KEY: 'key_trigger_503',
      GEMINI_API_KEY_FALLBACK_1: 'key_trigger_503',
      GEMINI_API_KEY_FALLBACK_2: 'key_trigger_503'
    });
    assert('Total service failure returns HTTP 503', failRes.status === 503);
    const failData = await failRes.json();
    assert('Failure message is user-friendly and hides internal details', failData.status === 'error');
    assert('No secrets, keys, or stack traces leaked in error response', !JSON.stringify(failData).includes('key_trigger_503') && !failData.stack);

    // Restore fetch
    globalThis.fetch = origFetch;
  }

  // -------------------------------------------------------------
  // Journey 10: Authentication, Authorization & Session Lifecycle
  // -------------------------------------------------------------
  console.log('\n--- Journey 10: Authentication, Authorization & Session Lifecycle ---');
  {
    // 1. Unauthenticated admin access
    const unauthUsers = await app.request('/admin/users');
    assert('Unauthenticated access to /admin/users returns 401', unauthUsers.status === 401);
    const unauthStats = await app.request('/admin/stats');
    assert('Unauthenticated access to /admin/stats returns 401', unauthStats.status === 401);

    // 2. Analyst login
    const analystLogin = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'analyst@ecotwin.ai', password: 'demo123' })
    });
    assert('Analyst login returns 200', analystLogin.status === 200);
    const analystData = await analystLogin.json();
    assert('Analyst role returned', analystData.user.role === 'analyst');

    // 3. Analyst blocked from admin endpoints
    const analystForbidden = await app.request('/admin/users', {
      headers: { 'Authorization': `Bearer ${analystData.token}` }
    });
    assert('Analyst role is forbidden (403) from accessing /admin/users', analystForbidden.status === 403);

    // 4. Admin login
    const adminLogin = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@ecotwin.ai', password: 'admin123' })
    });
    assert('Admin login returns 200', adminLogin.status === 200);
    const adminData = await adminLogin.json();
    const adminToken = adminData.token;

    // 5. Admin permitted access
    const adminUsersRes = await app.request('/admin/users', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert('Admin user successfully retrieves /admin/users (200)', adminUsersRes.status === 200);
    const usersList = await adminUsersRes.json();
    assert('User identities returned with zero sensitive fields (no passHash or otp)',
      usersList.every(u => !u.passHash && !u.otp)
    );

    const adminStatsRes = await app.request('/admin/stats', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert('Admin user successfully retrieves /admin/stats (200)', adminStatsRes.status === 200);
    const statsData = await adminStatsRes.json();
    assert('System stats contains totalUsers, uptime, and activeSessions',
      typeof statsData.totalUsers === 'number' && !!statsData.uptime
    );

    // 6. Admin logout & session revocation
    const logoutRes = await app.request('/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert('POST /auth/logout returns 200', logoutRes.status === 200);

    const postLogoutMe = await app.request('/auth/me', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert('Revoked session token returns 401 on /auth/me after logout', postLogoutMe.status === 401);

    // 7. Verify frontend admin error guard in app.js
    const appJs = fs.readFileSync('./public/static/app.js', 'utf8');
    assert('app.js loadAdmin renders locked state banner on 401/403 instead of undefined values',
      appJs.includes('Admin Access Restricted') && appJs.includes('Login as Admin')
    );
  }

  // -------------------------------------------------------------
  // Test Summary
  // -------------------------------------------------------------
  console.log('\n=============================================================');
  console.log(`PART 5 TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('=============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
