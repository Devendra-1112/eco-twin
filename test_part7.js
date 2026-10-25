/**
 * EcoTwin Part 7: Hackathon Winning Polish & Demo Journey Test Suite
 * Asserts end-to-end demo flow, context consistency, AI decision grounding,
 * deterministic fallback briefings, and UI interaction linkages.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import app from './dist/_worker.js';

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc} - ${err.message}`);
    failed++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc} - ${err.message}`);
    failed++;
  }
}

console.log('=== RUNNING ECOTWIN PART 7 DEMO OPTIMIZATION TESTS ===\n');

// --------------------------------------------------------------------------
// Journey 1: AI Decision-Support Context Grounding
// --------------------------------------------------------------------------
console.log('--- Test Suite 1: AI Context Grounding & Deterministic Briefings ---');

await itAsync('Unconfigured /ai_query with decision context returns deterministic policy briefing', async () => {
  const context = {
    location: { code: 'NOR', name: 'Norway', baselineScore: 82, co2: 4.2, renewable: 98 },
    scenario: { renewableTarget: 99, recyclingTarget: 70, co2: 3.5 },
    results: { baselineScore: 82, projectedScore: 88, scoreDiff: 6, topDrivers: [{ feature: 'Renewables', impact: 4.2 }] }
  };

  const res = await app.request('/ai_query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: 'Explain the policy trade-offs',
      context
    })
  }, {
    GEMINI_API_KEY: '',
    GEMINI_API_KEY_FALLBACK_1: '',
    GEMINI_API_KEY_FALLBACK_2: ''
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, 'unconfigured');
  assert(data.response.includes('Deterministic Decision Briefing (Norway)'), 'Must include Norway briefing header');
  assert(data.response.includes('**Baseline Score:** 82/100'), 'Must include accurate baseline');
  assert(data.response.includes('**Projected Score:** 88/100'), 'Must include accurate projected score');
  assert(data.response.includes('+6 pts'), 'Must include delta points');
  assert(data.response.includes('Trade-off Analysis'), 'Must discuss trade-off analysis');
  assert(Array.isArray(data.suggestions) && data.suggestions.length > 0, 'Suggestions array populated');
  assert(data.suggestions[0].includes('Norway'), 'Suggestions contextualized to Norway');
});

await itAsync('503 Service Failure with context returns graceful deterministic fallback briefing', async () => {
  const context = {
    location: { code: 'DEU', name: 'Germany', baselineScore: 71 },
    results: { baselineScore: 71, projectedScore: 81, scoreDiff: 10 }
  };

  // Intercept fetch to simulate upstream 503 failure
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response(JSON.stringify({ error: { code: 503, message: 'Server Unavailable' } }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const res = await app.request('/ai_query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Evaluate Germany', context })
    }, {
      GEMINI_API_KEY: 'mock_key_fail',
      GEMINI_API_KEY_FALLBACK_1: '',
      GEMINI_API_KEY_FALLBACK_2: ''
    });

    assert.strictEqual(res.status, 503);
    const data = await res.json();
    assert.strictEqual(data.status, 'error');
    assert(data.response.includes('Fallback Scenario Analysis (Germany)'), 'Fallback includes Germany context');
    assert(data.response.includes('71 → 81 (+10 pts)'), 'Fallback includes trajectory numbers');
    assert(data.response.includes('Trade-off'), 'Fallback includes trade-off');
    assert(!JSON.stringify(data).includes('mock_key_fail'), 'Zero secrets leaked');
  } finally {
    globalThis.fetch = origFetch;
  }
});

// --------------------------------------------------------------------------
// Journey 2: Frontend Demo Journey Functions & Linkages
// --------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Frontend Demo Journey Architecture & Action Handlers ---');

const appJs = fs.readFileSync(path.resolve('./public/static/app.js'), 'utf8');

it('app.js defines startDemoJourney function', () => {
  assert(appJs.includes('function startDemoJourney('), 'Must define startDemoJourney');
});

it('startDemoJourney defaults to Norway (NOR) baseline with valid telemetry', () => {
  assert(appJs.includes("'NOR'"), 'Must reference NOR default');
  assert(appJs.includes("switchTab('simulator')"), 'Must switch to simulator tab');
  assert(appJs.includes("runSimulation()"), 'Must auto-trigger simulation for smooth demo');
});

it('app.js defines consultCountryAI function', () => {
  assert(appJs.includes('function consultCountryAI('), 'Must define consultCountryAI');
  assert(appJs.includes("switchTab('ai')"), 'Must transition to AI tab');
  assert(appJs.includes("ST.activeDecisionContext"), 'Must set activeDecisionContext');
});

it('app.js defines transitionToCompare function', () => {
  assert(appJs.includes('function transitionToCompare('), 'Must define transitionToCompare');
  assert(appJs.includes("switchTab('compare')"), 'Must transition to compare tab');
  assert(appJs.includes("runCompare()"), 'Must trigger runCompare');
});

it('app.js defines transitionToSHAP function', () => {
  assert(appJs.includes('function transitionToSHAP('), 'Must define transitionToSHAP');
  assert(appJs.includes("switchTab('shap')"), 'Must transition to shap tab');
  assert(appJs.includes("runSHAP()"), 'Must trigger runSHAP');
});

it('app.js defines askAIAboutSimulation function', () => {
  assert(appJs.includes('function askAIAboutSimulation('), 'Must define askAIAboutSimulation');
  assert(appJs.includes("switchTab('ai')"), 'Must switch to ai tab');
  assert(appJs.includes("sendChat()"), 'Must auto-send contextual query');
});

it('app.js sendChat passes ST.activeDecisionContext in /ai_query payload', () => {
  assert(appJs.includes('context: ST.activeDecisionContext || null'), 'Must include decision context in payload');
});

it('app.js dashboardHTML includes Hackathon Judges Interactive Demo Journey card', () => {
  assert(appJs.includes("Hackathon Judges' Interactive Demo Journey"), 'Must display judges demo header');
  assert(appJs.includes('1. Observe'), 'Step 1 present');
  assert(appJs.includes('2. Select'), 'Step 2 present');
  assert(appJs.includes('3. Inspect'), 'Step 3 present');
  assert(appJs.includes('4. Configure'), 'Step 4 present');
  assert(appJs.includes('5. Compare'), 'Step 5 present');
  assert(appJs.includes('6. Attribute'), 'Step 6 present');
  assert(appJs.includes('7. Consult'), 'Step 7 present');
});

it('showGlobeCountryInfo includes quick action buttons for demo journey', () => {
  assert(appJs.includes("startDemoJourney('${c.code}')"), 'Globe popup has Configure Policy button');
  assert(appJs.includes("consultCountryAI('${c.code}')"), 'Globe popup has Ask AI button');
});

it('showCountryDetail includes quick action buttons for demo journey', () => {
  assert(appJs.includes("startDemoJourney('${c.code}')"), 'Map detail has Configure Policy button');
  assert(appJs.includes("consultCountryAI('${c.code}')"), 'Map detail has Ask AI button');
});

// --------------------------------------------------------------------------
// Journey 3: Default Demo Scenario Baseline Consistency
// --------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Default Demo Scenario Baseline Consistency ---');

await itAsync('GET /world_data returns Norway with verifiable physical baseline', async () => {
  const res = await app.request('/world_data');
  assert.strictEqual(res.status, 200);
  const countries = await res.json();
  const nor = countries.find(c => c.code === 'NOR');
  assert(nor, 'Norway must be present');
  assert.strictEqual(nor.code, 'NOR');
  assert(nor.score >= 70 && nor.score <= 100, `Norway score valid (${nor.score})`);
  assert(nor.renewable >= 80 && nor.renewable <= 100, `Norway renewable high (${nor.renewable}%)`);
  assert(nor.co2 >= 0 && nor.co2 <= 15, `Norway CO2 per capita reasonable (${nor.co2}t)`);
});

await itAsync('POST /simulate_future produces deterministic improvement for aggressive Norway policy', async () => {
  const payload = {
    renewable: 99,
    recycling: 75,
    waterAccess: 100,
    co2: 2.0,
    energyEff: 85,
    transport: 80,
    deterministic: true,
    seed: 42
  };
  const res = await app.request('/simulate_future', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert(data.finalScore > data.baseScore, 'Aggressive policy yields positive trajectory');
  assert(data.finalScore <= 100, 'Score does not exceed 100');
  assert(Array.isArray(data.explanation) && data.explanation.length > 0, 'Explanation drivers provided');
});

console.log('\n=============================================================');
console.log(`PART 7 TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('=============================================================');

if (failed > 0) {
  process.exit(1);
}
