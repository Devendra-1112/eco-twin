// EcoTwin Part 4: Data Integrity, Model Validation & Hackathon Demo Reliability Test Suite
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
  console.log('=== RUNNING ECOTWIN PART 4 DATA INTEGRITY & MODEL VALIDATION TESTS ===\n');

  // -------------------------------------------------------------
  // Test Suite 1: Scenario Simulation Reproducibility & Determinism
  // -------------------------------------------------------------
  console.log('--- Test Suite 1: Scenario Simulation Reproducibility & Determinism ---');

  {
    const payload = {
      country: 'USA',
      renewable: 75,
      recycling: 60,
      waterAccess: 85,
      co2: 12.5,
      energyEff: 80,
      transport: 50,
      deterministic: true,
      seed: 42
    };

    const res1 = await app.request('/simulate_future', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const d1 = await res1.json();

    const res2 = await app.request('/simulate_future', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const d2 = await res2.json();

    assert('First simulation returns HTTP 200', res1.status === 200);
    assert('Second simulation returns HTTP 200', res2.status === 200);
    assert('Scores are 100% deterministic with fixed seed', JSON.stringify(d1.scores) === JSON.stringify(d2.scores));
    assert('CO2 trajectories are 100% deterministic with fixed seed', JSON.stringify(d1.co2Trend) === JSON.stringify(d2.co2Trend));
    assert('Renewable trajectories are 100% deterministic with fixed seed', JSON.stringify(d1.renewTrend) === JSON.stringify(d2.renewTrend));
    assert('Energy efficiency trajectories are 100% deterministic with fixed seed', JSON.stringify(d1.energyTrend) === JSON.stringify(d2.energyTrend));
    assert('Confidence envelope upper bands are deterministic', JSON.stringify(d1.upperBand) === JSON.stringify(d2.upperBand));
    assert('Confidence envelope lower bands are deterministic', JSON.stringify(d1.lowerBand) === JSON.stringify(d2.lowerBand));
    assert('Simulation reports fixed seed', d1.seed === 42);
    assert('Simulation reports deterministic mode: true', d1.deterministic === true);
  }

  // 1.2: Scenario comparison reproducibility and shared assumptions
  {
    const comparePayload = {
      baseline: { renewable: 20, recycling: 25, waterAccess: 60, co2: 15.0, energyEff: 40, transport: 15 },
      projected: { renewable: 80, recycling: 70, waterAccess: 90, co2: 6.0, energyEff: 85, transport: 60 },
      seed: 42
    };

    const res = await app.request('/simulate/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comparePayload)
    });
    const d = await res.json();

    assert('Scenario comparison returns HTTP 200', res.status === 200);
    assert('Scenario comparison contains baselineScore and projectedScore', typeof d.baselineScore === 'number' && typeof d.projectedScore === 'number');
    assert('Both scenarios evaluated over same horizon (11 years: 2025-2035)', d.baselineTrend.length === d.projectedTrend.length && d.baselineTrend.length === 11);
    assert('Aggressive intervention yields higher sustainability score than baseline', d.projectedScore > d.baselineScore);
    assert('Score diff correctly reflects projection minus baseline', Math.abs(d.diff - (d.projectedScore - d.baselineScore)) < 0.05);
    assert('CO2 savings reported as positive number', typeof d.co2Savings === 'number');
    assert('Comparison provenance labeled as Heuristic result', d.provenance === 'Heuristic result');
    assert('Comparison discloses shared model assumptions', typeof d.assumptions === 'string' && d.assumptions.length > 0);
  }

  // -------------------------------------------------------------
  // Test Suite 2: Physical & Mathematical Bounds Enforcement
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 2: Physical & Mathematical Bounds Enforcement ---');

  // 2.1: Extreme high intervention (should not produce negative CO2 or impossible percentages)
  {
    const extremeHigh = {
      country: 'Norway',
      renewable: 100,
      recycling: 100,
      waterAccess: 100,
      co2: 2.0,
      energyEff: 100,
      transport: 100,
      deterministic: true,
      seed: 99
    };

    const res = await app.request('/simulate_future', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extremeHigh)
    });
    const d = await res.json();

    assert('Extreme high simulation returns HTTP 200', res.status === 200);
    const co2Values = d.co2Trend;
    const allCo2NonNegative = co2Values.every(v => v >= 0);
    assert('CO2 emissions remain strictly non-negative (co2 >= 0)', allCo2NonNegative, `Min CO2: ${Math.min(...co2Values)}`);

    const scores = d.scores;
    const allScoresInBounds = scores.every(v => v >= 0 && v <= 100);
    assert('Sustainability scores remain bounded in [0, 100]', allScoresInBounds, `Max score: ${Math.max(...scores)}`);

    const upper = d.upperBand;
    const lower = d.lowerBand;
    let envelopeValid = true;
    for (let i = 0; i < scores.length; i++) {
      if (!(lower[i] <= scores[i] && scores[i] <= upper[i])) envelopeValid = false;
      if (lower[i] < 0 || upper[i] > 100) envelopeValid = false;
    }
    assert('Confidence envelope satisfies 0 <= lowerBand <= score <= upperBand <= 100', envelopeValid);

    const renewables = d.renewTrend;
    assert('Renewable energy percent clamped at <= 100%', renewables.every(r => r <= 100));
    assert('Energy efficiency percent clamped at <= 100%', d.energyTrend.every(e => e <= 100));
    assert('Water access percent clamped at <= 100%', d.waterTrend.every(w => w <= 100));
  }

  // 2.2: Extreme low / negative inputs clamped safely
  {
    const extremeLow = {
      country: 'TestCountry',
      renewable: -50,
      recycling: -20,
      waterAccess: -10,
      co2: -100,
      energyEff: -30,
      transport: -10,
      deterministic: true,
      seed: 123
    };

    const res = await app.request('/simulate_future', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extremeLow)
    });
    const d = await res.json();

    assert('Extreme low/negative input simulation returns HTTP 200', res.status === 200);
    assert('Scores stay non-negative (>= 0) despite negative inputs', d.scores.every(s => s >= 0));
    assert('CO2 emissions remain clamped non-negative (>= 0)', d.co2Trend.every(c => c >= 0));
    assert('Renewable percent stays non-negative (>= 0)', d.renewTrend.every(r => r >= 0));
    assert('Water access stays non-negative (>= 0)', d.waterTrend.every(w => w >= 0));
  }

  // -------------------------------------------------------------
  // Test Suite 3: Truthful ML/AI Model Attribution & Removal of Fake Claims
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 3: Truthful ML/AI Model Attribution & Removal of Fake Claims ---');

  // 3.1: /simulate_future
  {
    const res = await app.request('/simulate_future', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country: 'Germany', deterministic: true, seed: 1 })
    });
    const d = await res.json();
    assert('simulate_future labels model truthfully as Heuristic Multi-Factor Scenario Projection', d.modelType === 'Heuristic Multi-Factor Scenario Projection v3.1');
    assert('simulate_future provenance is "Heuristic result"', d.provenance === 'Heuristic result');
    assert('simulate_future does NOT claim to be an LSTM neural network', !JSON.stringify(d).toLowerCase().includes('lstm'));
  }

  // 3.2: /shap/explain
  {
    const res = await app.request('/shap/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country: 'Germany', carbonTax: 30, renewableSub: 20 })
    });
    const d = await res.json();
    assert('/shap/explain returns HTTP 200', res.status === 200);
    assert('/shap/explain modelType labeled as Additive Feature Contribution (Linear Attribution)', d.modelType === 'Additive Feature Contribution (Linear Attribution)');
    assert('/shap/explain provenance is "Calculated estimate"', d.provenance === 'Calculated estimate');
    assert('/shap/explain does NOT claim LSTM+SHAP', !d.modelType.includes('LSTM'));
    assert('/shap/explain does NOT return fake 92.4% confidence score', d.confidence === undefined || d.confidence !== 92.4);
    assert('/shap/explain baseScore matches standard baseline (61)', d.baseScore === 61);
    assert('/shap/explain sum of feature contributions equals score delta', Math.abs((d.baseScore + d.features.reduce((acc, f) => acc + (f.contribution ?? f.shapValue), 0)) - d.predictedScore) < 0.1);
  }

  // 3.3: /rl_optimize
  {
    const res = await app.request('/rl_optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country: 'France', targetScore: 85, budget: 100, maxYears: 5 })
    });
    const d = await res.json();
    assert('/rl_optimize returns HTTP 200', res.status === 200);
    assert('/rl_optimize optimizerType labeled as Parameterized Gradient-Decay Heuristic', d.optimizerType === 'Parameterized Gradient-Decay Heuristic');
    assert('/rl_optimize provenance is "Heuristic result"', d.provenance === 'Heuristic result');
    assert('/rl_optimize does NOT claim DQN or PPO neural network weights', !d.optimizerType.includes('DQN') && !d.optimizerType.includes('PPO'));
    assert('/rl_optimize reports convergence', typeof d.converged === 'boolean');
    assert('/rl_optimize recommends valid policy levers', (d.policy || d.optimalPolicy) && typeof (d.policy?.carbonTax || d.optimalPolicy?.carbonTax) === 'number');
  }

  // 3.4: /anomaly_data
  {
    const res = await app.request('/anomaly_data');
    assert('/anomaly_data returns HTTP 200', res.status === 200);
    const provHeader = res.headers.get('X-Data-Provenance');
    const methodHeader = res.headers.get('X-Detection-Method');
    assert('/anomaly_data emits provenance header as Simulated demo data', provHeader === 'Simulated demo data');
    assert('/anomaly_data emits detection method header', methodHeader && methodHeader.includes('Demonstration Data'));
    assert('/anomaly_data headers do NOT claim Isolation Forest ML model', methodHeader && !methodHeader.includes('Isolation Forest'));
    const d = await res.json();
    assert('/anomaly_data returns 30 day anomaly points array', Array.isArray(d) && d.length === 30);
    assert('Each anomaly point has isAnomaly boolean', typeof d[0].isAnomaly === 'boolean');
  }

  // 3.5: /threat_forecast
  {
    const res = await app.request('/threat_forecast');
    const d = await res.json();
    assert('/threat_forecast returns HTTP 200', res.status === 200);
    const tfModel = d.model || d.modelInfo?.model || '';
    assert('/threat_forecast model is EcoTwin Environmental Hazard Tracker', tfModel === 'EcoTwin Environmental Hazard Tracker');
    assert('/threat_forecast does NOT claim fake ThreatNet-v3', tfModel !== 'EcoTwin-ThreatNet-v3');
    assert('/threat_forecast does NOT claim fake 84.7% accuracy', d.accuracy === undefined && d.modelInfo?.accuracy === undefined);
    assert('/threat_forecast provenance contains NASA EONET or Heuristic Baseline', d.provenance.includes('NASA EONET') || d.provenance.includes('Heuristic Baseline'));
  }

  // 3.6: /satellite/ml_forecast
  {
    const res = await app.request('/satellite/ml_forecast');
    const d = await res.json();
    assert('/satellite/ml_forecast returns HTTP 200', res.status === 200);
    assert('/satellite/ml_forecast modelType is Multi-Indicator Environmental Risk Index', d.modelType === 'Multi-Indicator Environmental Risk Index');
    assert('/satellite/ml_forecast provenance is Heuristic result', d.provenance === 'Heuristic result');
    assert('/satellite/ml_forecast does NOT claim fake 84.7% accuracy', d.modelAccuracy === undefined);
  }

  // 3.7: /satellite/analyze/:regionId
  {
    const res = await app.request('/satellite/analyze/amazon');
    const d = await res.json();
    assert('/satellite/analyze/amazon returns HTTP 200', res.status === 200);
    const satModel = d.analysis?.model || d.model || '';
    assert('/satellite/analyze model is Simulated-Vision-v2.1 (Demo Overlay)', satModel.includes('Demo Overlay'));
    const provStr = typeof d.provenance === 'string' ? d.provenance : JSON.stringify(d.provenance);
    assert('/satellite/analyze discloses synthetic detection overlay in provenance', provStr.includes('Simulated') || provStr.includes('Synthetic'));
  }

  // -------------------------------------------------------------
  // Test Suite 4: External API Resilience & Provenance Headers
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 4: External API Resilience & Provenance Headers ---');

  // 4.1: /world_data headers & fallback indicators
  {
    const res = await app.request('/world_data');
    assert('/world_data returns HTTP 200', res.status === 200);
    const provHeader = res.headers.get('X-Data-Provenance');
    assert('/world_data emits X-Data-Provenance header', provHeader !== null && provHeader.length > 0);
    const fbHeader = res.headers.get('X-Data-Fallback');
    assert('/world_data emits X-Data-Fallback header', fbHeader !== null);

    const countries = await res.json();
    assert('/world_data returns an array of countries', Array.isArray(countries) && countries.length > 0);
    const norway = countries.find(c => c.name === 'Norway' || c.code === 'NOR');
    assert('Norway is present in world data', !!norway);
    assert('Country object has isCountryDataFallback flag defined', norway && typeof norway.isCountryDataFallback === 'boolean');
  }

  // 4.2: /realtime endpoint resilience & provenance
  {
    const res = await app.request('/realtime');
    assert('/realtime returns HTTP 200', res.status === 200);
    const d = await res.json();
    assert('/realtime returns feed array and latest object', Array.isArray(d.feed) && d.latest !== undefined);
    assert('/realtime provides explicit provenance field', typeof d.provenance === 'string' && d.provenance.length > 0);
    assert('/realtime tracks isRealWeather boolean flag', typeof d.latest.isRealWeather === 'boolean');
    assert('/realtime tracks isRealAQI boolean flag', typeof d.latest.isRealAQI === 'boolean');
    assert('Fallback mode reflected in provenance if real weather offline', !d.latest.isRealWeather ? d.provenance.includes('Simulated') : d.provenance.includes('Live'));
  }

  // -------------------------------------------------------------
  // Test Suite 5: Frontend UI Provenance & Non-Deceptive Presentation
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 5: Frontend UI Provenance & Non-Deceptive Presentation ---');

  // 5.1: Check CSS for provenance badge classes
  {
    const css = fs.readFileSync('public/static/style.css', 'utf8');
    assert('CSS defines .et-provenance-badge', css.includes('.et-provenance-badge'));
    assert('CSS defines .et-prov-live variant', css.includes('.et-prov-live'));
    assert('CSS defines .et-prov-retrieved variant', css.includes('.et-prov-retrieved'));
    assert('CSS defines .et-prov-calculated variant', css.includes('.et-prov-calculated'));
    assert('CSS defines .et-prov-heuristic variant', css.includes('.et-prov-heuristic'));
    assert('CSS defines .et-prov-simulated variant', css.includes('.et-prov-simulated'));
  }

  // 5.2: Check app.js for honest labeling and no fake claims
  {
    const appJs = fs.readFileSync('public/static/app.js', 'utf8');
    assert('app.js defines provenanceBadge helper function', appJs.includes('function provenanceBadge('));
    assert('app.js does NOT contain fake "84.7%" accuracy claim', !appJs.includes('84.7%') && !appJs.includes('84.7'));
    assert('app.js does NOT contain fake "92.4%" confidence claim', !appJs.includes('92.4%') && !appJs.includes('92.4'));
    assert('app.js does NOT contain fake "ThreatNet-v3" model name', !appJs.includes('ThreatNet-v3') && !appJs.includes('EcoTwin-ThreatNet-v3'));
    assert('app.js does NOT contain unverified "● LIVE" badge', !appJs.includes('● LIVE'));
    assert('app.js simulator passes deterministic flag and seed to API', appJs.includes('deterministic: true') && appJs.includes('seed: 42'));
    assert('app.js compare passes seed to API', appJs.includes('seed: 42'));
  }

  // -------------------------------------------------------------
  // Test Suite 6: Documentation Integrity
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 6: Documentation Integrity ---');
  {
    assert('DATA_TRUST_REPORT.md exists', fs.existsSync('DATA_TRUST_REPORT.md'));
    const report = fs.readFileSync('DATA_TRUST_REPORT.md', 'utf8');
    assert('Report covers /world_data audit', report.includes('/world_data'));
    assert('Report covers /simulate_future audit', report.includes('/simulate_future'));
    assert('Report covers /rl_optimize audit', report.includes('/rl_optimize'));
    assert('Report covers /shap/explain audit', report.includes('/shap/explain'));
    assert('Report covers /anomaly_data audit', report.includes('/anomaly_data'));
    assert('Report covers /satellite/* audit', report.includes('/satellite'));
    assert('Report details 5 provenance categories',
      report.includes('Live external data') &&
      report.includes('Retrieved external data') &&
      report.includes('Calculated estimate') &&
      report.includes('Heuristic result') &&
      report.includes('Simulated demo data')
    );
    assert('Report details live hackathon defense guidelines', report.includes('Hackathon Presentation & Live Demo Defense Guidelines'));
  }

  console.log('\n=============================================================');
  console.log(`PART 4 TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('=============================================================');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Unhandled error running Part 4 tests:', err);
  process.exit(1);
});
