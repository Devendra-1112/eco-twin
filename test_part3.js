// ════════════════════════════════════════════════════════════════════════════
// EcoTwin — Part 3: Gemini Reliability, AI Chat & 3D Globe Test Suite
// ════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';

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

async function runPart3Tests() {
  console.log('=== RUNNING ECOTWIN PART 3 REGRESSION TEST SUITE ===\n');

  // Load the built worker app
  const { default: app } = await import('./dist/_worker.js');

  // --------------------------------------------------------------------------
  // Test Suite 1: Gemini Unconfigured State & Secret Protection
  // --------------------------------------------------------------------------
  console.log('--- Test Suite 1: Unconfigured State & Secret Protection ---');

  // 1.1: Missing keys returns safe developer setup message
  {
    const res = await app.request('/ai_query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'How can we reduce emissions?' })
    }, {
      // Empty environment: no keys set
      GEMINI_API_KEY: '',
      GEMINI_API_KEY_FALLBACK_1: '',
      GEMINI_API_KEY_FALLBACK_2: ''
    });

    assert('Unconfigured request returns HTTP 200', res.status === 200);
    const data = await res.json();
    assert('Response status is "unconfigured"', data.status === 'unconfigured');
    assert('Response provides guidance mentioning GEMINI_API_KEY', data.response?.includes('GEMINI_API_KEY'));
    assert('Response provides live metrics fallback', data.response?.includes('Atmospheric CO₂'));
    assert('Response includes suggestions array', Array.isArray(data.suggestions) && data.suggestions.length > 0);
    assert('Response does not leak file paths or secrets', !JSON.stringify(data).includes('process.env') && !JSON.stringify(data).includes('C:\\'));
  }

  // --------------------------------------------------------------------------
  // Test Suite 2: Gemini Primary Key Success & Mock Interception
  // --------------------------------------------------------------------------
  console.log('\n--- Test Suite 2: Primary Key Execution & Success ---');

  const origFetch = globalThis.fetch;
  let interceptedCalls = [];

  // Setup mock interceptor
  globalThis.fetch = async (url, opts) => {
    const urlStr = url.toString();
    if (urlStr.includes('generativelanguage.googleapis.com')) {
      const keyParam = (opts?.headers instanceof Headers)
        ? opts.headers.get('x-goog-api-key')
        : (opts?.headers?.['x-goog-api-key'] || opts?.headers?.['X-Goog-Api-Key'] || new URL(urlStr).searchParams.get('key') || '');
      interceptedCalls.push({ url: urlStr, key: keyParam, method: opts?.method });

      // Simulate 429 for rate-limit testing key
      if (keyParam === 'key_trigger_429') {
        return new Response(JSON.stringify({
          error: { code: 429, message: 'Resource has been exhausted', status: 'RESOURCE_EXHAUSTED' }
        }), { status: 429, headers: { 'Content-Type': 'application/json' } });
      }

      // Simulate 503 for service unavailable testing key
      if (keyParam === 'key_trigger_503') {
        return new Response(JSON.stringify({
          error: { code: 503, message: 'Service Unavailable', status: 'UNAVAILABLE' }
        }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      }

      // Simulate 400 API_KEY_INVALID for invalid credential key
      if (keyParam === 'key_trigger_invalid') {
        return new Response(JSON.stringify({
          error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      // Simulate 200 Safety blocked response
      if (keyParam === 'key_trigger_safety') {
        return new Response(JSON.stringify({
          candidates: [{
            finishReason: 'SAFETY',
            safetyRatings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', probability: 'HIGH' }]
          }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // Default: valid Gemini JSON response
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                response: 'Atmospheric carbon can be reduced by 45% using renewable grids.',
                suggestions: ['What about solar?', 'How to fund this?']
              })
            }]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return origFetch(url, opts);
  };

  // 2.1: Successful execution using primary key
  {
    interceptedCalls = [];
    const res = await app.request('/ai_query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'What is the fastest way to decarbonize?',
        lang: 'en',
        history: [{ role: 'user', content: 'Hello' }]
      })
    }, {
      GEMINI_API_KEY: 'mock_primary_valid_key',
      GEMINI_API_KEY_FALLBACK_1: 'mock_fallback_key_1'
    });

    assert('Primary key call returns HTTP 200', res.status === 200);
    const data = await res.json();
    assert('Returned status is "ok"', data.status === 'ok');
    assert('Response text matches structured AI output', data.response?.includes('Atmospheric carbon'));
    assert('Suggestions array returned', Array.isArray(data.suggestions) && data.suggestions.length === 2);
    assert('Primary key was invoked exactly once', interceptedCalls.length === 1);
    assert('Fallback key was NOT invoked', interceptedCalls[0]?.key === 'mock_primary_valid_key');
    assert('Response body never contains API keys', !JSON.stringify(data).includes('mock_primary_valid_key'));
  }

  // --------------------------------------------------------------------------
  // Test Suite 3: Fallback on Eligible Retryable Failures (429, 503)
  // --------------------------------------------------------------------------
  console.log('\n--- Test Suite 3: Fallback on Eligible Errors ---');

  // 3.1: Fallback when primary key hits 429 (quota/rate-limit)
  {
    interceptedCalls = [];
    const res = await app.request('/ai_query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What is the renewable index?' })
    }, {
      GEMINI_API_KEY: 'key_trigger_429', // primary fails with 429
      GEMINI_API_KEY_FALLBACK_1: 'mock_valid_fallback_1' // fallback succeeds
    });

    assert('Request succeeds via fallback after 429', res.status === 200);
    const data = await res.json();
    assert('Response contains valid AI answer', data.status === 'ok' && data.response?.includes('Atmospheric carbon'));
    assert('Primary key was tried first, then fallback 1', interceptedCalls.length === 2);
    assert('First call used primary key', interceptedCalls[0]?.key === 'key_trigger_429');
    assert('Second call used fallback key 1', interceptedCalls[1]?.key === 'mock_valid_fallback_1');
  }

  // 3.2: Fallback when primary key hits 503 (service unavailable)
  {
    interceptedCalls = [];
    const res = await app.request('/ai_query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'How is ETS price calculated?' })
    }, {
      GEMINI_API_KEY: 'key_trigger_503', // primary fails with 503
      GEMINI_API_KEY_FALLBACK_1: 'key_trigger_503', // fallback 1 also fails with 503
      GEMINI_API_KEY_FALLBACK_2: 'mock_valid_fallback_2' // fallback 2 succeeds
    });

    assert('Request succeeds via fallback 2 after 503 errors', res.status === 200);
    const data = await res.json();
    assert('Response contains valid answer', data.status === 'ok');
    // Note: Deduplication will only try unique keys
    assert('Fallback key 2 was attempted', interceptedCalls.some(c => c.key === 'mock_valid_fallback_2'));
  }

  // --------------------------------------------------------------------------
  // Test Suite 4: Non-Retryable Errors (No Key Rotation / Bounded)
  // --------------------------------------------------------------------------
  console.log('\n--- Test Suite 4: Non-Retryable Errors Prevention ---');

  // 4.1: Invalid credentials (400 API_KEY_INVALID) must NOT retry fallback keys
  {
    interceptedCalls = [];
    const res = await app.request('/ai_query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Will this rotate keys?' })
    }, {
      GEMINI_API_KEY: 'key_trigger_invalid', // invalid key
      GEMINI_API_KEY_FALLBACK_1: 'mock_valid_fallback_1',
      GEMINI_API_KEY_FALLBACK_2: 'mock_valid_fallback_2'
    });

    assert('Invalid credentials request terminated without looping', res.status !== 200);
    assert('Fallback key 1 was NOT called on invalid credentials', !interceptedCalls.some(c => c.key === 'mock_valid_fallback_1'));
    assert('Fallback key 2 was NOT called on invalid credentials', !interceptedCalls.some(c => c.key === 'mock_valid_fallback_2'));
    assert('Exactly 1 call was made', interceptedCalls.length === 1);
    const data = await res.json();
    assert('Error message does not leak raw credentials or API key', !JSON.stringify(data).includes('key_trigger_invalid'));
  }

  // 4.2: Safety refusal must NOT retry fallback keys
  {
    interceptedCalls = [];
    const res = await app.request('/ai_query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Trigger safety filter' })
    }, {
      GEMINI_API_KEY: 'key_trigger_safety',
      GEMINI_API_KEY_FALLBACK_1: 'mock_valid_fallback_1'
    });

    assert('Safety block does NOT attempt fallback key', interceptedCalls.length === 1);
    assert('Fallback was not contacted', !interceptedCalls.some(c => c.key === 'mock_valid_fallback_1'));
    const data = await res.json();
    assert('User-friendly safety notice returned', data.response?.includes('safety policies'));
  }

  // 4.3: Total failure when all keys fail with 503
  {
    interceptedCalls = [];
    const res = await app.request('/ai_query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Is anyone online?' })
    }, {
      GEMINI_API_KEY: 'key_trigger_503'
    });

    assert('Total failure returns 503', res.status === 503);
    const data = await res.json();
    assert('Response status is "error"', data.status === 'error');
    assert('User-friendly unavailable message returned', data.response?.includes('Temporarily Unavailable'));
    assert('No raw stack trace leaked', !data.response?.includes('at Object.') && !data.response?.includes('node_modules'));
  }

  // Restore fetch
  globalThis.fetch = origFetch;

  // --------------------------------------------------------------------------
  // Test Suite 5: Frontend AI Chat Robustness & Crash Prevention
  // --------------------------------------------------------------------------
  console.log('\n--- Test Suite 5: Frontend AI Chat Crash Prevention ---');

  const appJs = fs.readFileSync('public/static/app.js', 'utf8');

  // 5.1: appendChatMsg handles undefined/null text without throwing
  {
    const hasSafeGuard = appJs.includes('const safeText = (typeof text === \'string\') ? text : (text != null ? String(text) : \'\')');
    assert('appendChatMsg includes safeText string coercion guard', hasSafeGuard);
  }

  // 5.2: sendChat checks response structure and handles missing d.response
  {
    const hasMissingResponseGuard = appJs.includes('(typeof d.response === \'string\' && d.response.trim())') &&
                                    appJs.includes('(typeof d.message === \'string\' && d.message.trim())');
    assert('sendChat checks typeof d.response and falls back safely', hasMissingResponseGuard);
  }

  // 5.3: sendChat disables duplicate submissions while in progress
  {
    const hasDuplicateGuard = appJs.includes('if (ST.chatInProgress) return;') &&
                             appJs.includes('ST.chatInProgress = true;');
    assert('sendChat implements duplicate submission prevention', hasDuplicateGuard);
  }

  // 5.4: sendChat restores input and loading state in finally block
  {
    const hasFinallyBlock = appJs.includes('finally {') &&
                            appJs.includes('ST.chatInProgress = false;') &&
                            appJs.includes('input.disabled = false;');
    assert('sendChat restores input and chatInProgress in finally block', hasFinallyBlock);
  }

  // 5.5: sendChat includes client timeout handling via AbortController
  {
    const hasAbortController = appJs.includes('const controller = new AbortController()') &&
                               appJs.includes('controller.abort()');
    assert('sendChat implements 15-second client timeout handling', hasAbortController);
  }

  // --------------------------------------------------------------------------
  // Test Suite 6: Canvas IDs & 3D Globe Scene Graph Alignment
  // --------------------------------------------------------------------------
  console.log('\n--- Test Suite 6: 3D Globe & Satellite Canvas Separation ---');

  // 6.1: Main 3D globe uses globe-canvas
  {
    const hasMainCanvas = appJs.includes('<canvas id="globe-canvas"');
    assert('Main 3D globe template defines id="globe-canvas"', hasMainCanvas);
  }

  // 6.2: Satellite globe uses unique id sat-globe-canvas
  {
    const hasSatCanvas = appJs.includes('<canvas id="sat-globe-canvas"');
    assert('Satellite globe template defines unique id="sat-globe-canvas"', hasSatCanvas);
  }

  // 6.3: No duplicate globe-canvas ID exists
  {
    const matches = appJs.match(/id="globe-canvas"/g) || [];
    assert('Exactly one occurrence of id="globe-canvas" in HTML templates', matches.length === 1);
  }

  // 6.4: Markers attached to gGlobeGroup instead of scene root
  {
    const hasGroupAdd = appJs.includes('gGlobeGroup.add(m);') && appJs.includes('gGlobeGroup.add(rg);');
    assert('Markers and rings are added to gGlobeGroup (anchored to globe surface)', hasGroupAdd);
  }

  // 6.5: Markers do NOT spin around their own axes
  {
    const hasSelfRotation = appJs.includes('gMarkers.forEach(m => m.rotation.y +=');
    assert('Self-rotation loop on individual marker meshes removed', !hasSelfRotation);
  }

  // 6.6: Drag controls implemented on 3D globe
  {
    const hasDragControls = appJs.includes('canvas.onpointerdown') &&
                            appJs.includes('canvas.onpointermove') &&
                            appJs.includes('gGlobeGroup.rotation.y += dx * 0.005');
    assert('Pointer drag rotation implemented on gGlobeGroup', hasDragControls);
  }

  // 6.7: Raycaster click interaction for country info
  {
    const hasRaycaster = appJs.includes('const raycaster = new THREE.Raycaster();') &&
                         appJs.includes('showGlobeCountryInfo(');
    assert('Raycaster click interaction implemented on 3D globe', hasRaycaster);
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n=============================================================');
  console.log(`PART 3 TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPart3Tests().catch(err => {
  console.error('Fatal error in Part 3 test suite:', err);
  process.exit(1);
});
