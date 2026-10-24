process.env.ECOTWIN_DEV_LOG = 'true';
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
  console.log('=== RUNNING SECURITY REMEDIATION REGRESSION TEST SUITE ===\n');

  // -------------------------------------------------------------
  // Test Suite 1: Password Verification Bypass Fix
  // -------------------------------------------------------------
  console.log('--- Test Suite 1: Password Verification & Bypass Prevention ---');

  // 1.1: Admin account with wrong password must return 401
  {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@ecotwin.ai', password: 'wrongpassword' })
    });
    assert('admin@ecotwin.ai with wrong password returns 401', res.status === 401);
  }

  // 1.2: Admin account with empty password must return 401
  {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@ecotwin.ai', password: '' })
    });
    assert('admin@ecotwin.ai with empty password returns 401', res.status === 401);
  }

  // 1.3: Admin account with $2b$ prefix string must return 401 (no shortcut)
  {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@ecotwin.ai', password: '$2b$10$arbitrary_bypass' })
    });
    assert('admin@ecotwin.ai with $2b$ string returns 401', res.status === 401);
  }

  // 1.4: Admin account with correct password (admin123) returns 200 and token
  let adminToken = '';
  {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@ecotwin.ai', password: 'admin123' })
    });
    assert('admin@ecotwin.ai with correct password returns 200', res.status === 200);
    const data = await res.json();
    adminToken = data.token;
    assert('Login response returns valid token', !!adminToken && adminToken.startsWith('et_'));
    assert('Login response returns role "admin"', data.user?.role === 'admin');
    assert('Login response does NOT contain passHash', !data.user?.passHash);
    assert('Login response does NOT contain otp', !data.user?.otp);
  }

  // 1.5: Analyst account with wrong password returns 401
  {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'analyst@ecotwin.ai', password: 'admin123' }) // admin123 is wrong for analyst
    });
    assert('analyst@ecotwin.ai with admin123 password returns 401', res.status === 401);
  }

  // 1.6: Analyst account with correct password (demo123) returns 200 and token
  let analystToken = '';
  {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'analyst@ecotwin.ai', password: 'demo123' })
    });
    assert('analyst@ecotwin.ai with correct password returns 200', res.status === 200);
    const data = await res.json();
    analystToken = data.token;
    assert('Analyst login returns valid token', !!analystToken && analystToken.startsWith('et_'));
    assert('Analyst login returns role "analyst"', data.user?.role === 'analyst');
  }

  // -------------------------------------------------------------
  // Test Suite 2: Administrative Endpoints Authorization
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 2: Administrative Endpoints Authorization ---');

  // 2.1: GET /admin/users without token returns 401
  {
    const res = await app.request('/admin/users');
    assert('GET /admin/users without authorization header returns 401', res.status === 401);
  }

  // 2.2: GET /admin/users with invalid token returns 401
  {
    const res = await app.request('/admin/users', {
      headers: { Authorization: 'Bearer invalid_token_12345' }
    });
    assert('GET /admin/users with invalid token returns 401', res.status === 401);
  }

  // 2.3: GET /admin/users with analyst token returns 403
  {
    const res = await app.request('/admin/users', {
      headers: { Authorization: `Bearer ${analystToken}` }
    });
    assert('GET /admin/users with analyst token returns 403', res.status === 403);
  }

  // 2.4: GET /admin/users with admin token returns 200 and sanitized list
  {
    const res = await app.request('/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert('GET /admin/users with admin token returns 200', res.status === 200);
    const users = await res.json();
    assert('User list is an array', Array.isArray(users) && users.length >= 2);
    const hasSensitiveFields = users.some(u => 'passHash' in u || 'otp' in u || 'token' in u);
    assert('User records do NOT leak passHash, otp, or tokens', !hasSensitiveFields);
  }

  // 2.5: GET /admin/stats without token returns 401
  {
    const res = await app.request('/admin/stats');
    assert('GET /admin/stats without authorization returns 401', res.status === 401);
  }

  // 2.6: GET /admin/stats with analyst token returns 403
  {
    const res = await app.request('/admin/stats', {
      headers: { Authorization: `Bearer ${analystToken}` }
    });
    assert('GET /admin/stats with analyst token returns 403', res.status === 403);
  }

  // 2.7: GET /admin/stats with admin token returns 200
  {
    const res = await app.request('/admin/stats', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert('GET /admin/stats with admin token returns 200', res.status === 200);
  }

  // 2.8: PUT /admin/users/:id/role without token returns 401
  {
    const res = await app.request('/admin/users/usr_002/role', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' })
    });
    assert('PUT /admin/users/:id/role without authorization returns 401', res.status === 401);
  }

  // 2.9: PUT /admin/users/:id/role with analyst token returns 403 (cannot escalate)
  {
    const res = await app.request('/admin/users/usr_002/role', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${analystToken}`
      },
      body: JSON.stringify({ role: 'admin' })
    });
    assert('PUT /admin/users/:id/role with analyst token returns 403 (privilege escalation blocked)', res.status === 403);
  }

  // 2.10: PUT /admin/users/:id/role with admin token but invalid role returns 400
  {
    const res = await app.request('/admin/users/usr_002/role', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ role: 'super_root_god' })
    });
    assert('PUT /admin/users/:id/role with invalid role returns 400', res.status === 400);
  }

  // 2.11: PUT /admin/users/:id/role with admin token and valid role succeeds
  {
    const res = await app.request('/admin/users/usr_002/role', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ role: 'viewer' })
    });
    assert('PUT /admin/users/:id/role with valid admin token succeeds with 200', res.status === 200);
    const data = await res.json();
    assert('Role changed to viewer in response', data.user?.role === 'viewer');

    // Revert role back to analyst
    await app.request('/admin/users/usr_002/role', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ role: 'analyst' })
    });
  }

  // -------------------------------------------------------------
  // Test Suite 3: OTP Exposure & Verification Security
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 3: OTP Exposure & Lifecycle ---');

  const testEmail = `newuser_${Date.now()}@ecotwin.ai`;
  const testPassword = 'Password123!';

  // 3.1: Registration must succeed and NEVER return the OTP in the JSON response
  let regResponseData = null;
  {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Test User',
        email: testEmail,
        password: testPassword,
        org: 'TestOrg'
      })
    });
    assert('Registration returns 201 Created', res.status === 201);
    regResponseData = await res.json();
    assert('Registration response does NOT expose "otp"', !('otp' in regResponseData));
    assert('Registration response does NOT expose "passHash"', !('passHash' in regResponseData));
    assert('Registration response confirms verified=false', regResponseData.verified === false);
  }

  // 3.2: Login before OTP verification must return 403 Forbidden
  {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    assert('Login for unverified account returns 403 (needsOtp)', res.status === 403);
    const data = await res.json();
    assert('Needs OTP flag is returned', data.needsOtp === true);
  }

  // 3.3: Incorrect OTP verification attempt must return 400
  {
    const res = await app.request('/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, otp: '000000' })
    });
    assert('Incorrect OTP returns 400', res.status === 400);
  }

  // 3.4: Repeated failed attempts should trigger rate limit/lockout after 5 attempts
  {
    let lastStatus = 0;
    for (let i = 0; i < 5; i++) {
      const res = await app.request('/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, otp: '111111' })
      });
      lastStatus = res.status;
    }
    assert('Multiple failed OTP attempts triggers 429 Too Many Requests', lastStatus === 429);
  }

  // 3.5: Expired OTP verification attempt must return 400
  {
    const expiredEmail = `expired_${Date.now()}@ecotwin.ai`;
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Expired User', email: expiredEmail, password: testPassword })
    });
    // Advance time by 15 minutes via TEST_MOCK_TIME env binding
    const res = await app.request('/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: expiredEmail, otp: '123456' })
    }, { TEST_MOCK_TIME: Date.now() + 15 * 60 * 1000 });
    assert('Expired OTP verification attempt returns 400', res.status === 400);
    const data = await res.json();
    assert('Error message specifies expiration', data.error?.includes('expired'));
  }

  // 3.6: Resend OTP resets attempts and sends fresh OTP in dev log
  let freshOtp = '';
  const verifiedTestEmail = `verify_me_${Date.now()}@ecotwin.ai`;
  {
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Verify User', email: verifiedTestEmail, password: testPassword })
    });

    const origLog = console.log;
    console.log = (...args) => {
      const text = args.join(' ');
      const match = text.match(/\[DEV-AUTH\] New OTP for .*?: (\d{6})/);
      if (match) freshOtp = match[1];
      origLog(...args);
    };

    const resendRes = await app.request('/auth/resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: verifiedTestEmail })
    }, { ECOTWIN_DEV_LOG: 'true' });
    console.log = origLog;

    assert('/auth/resend-otp returns 200', resendRes.status === 200);
    assert('Fresh dev-logged OTP captured from resend-otp', !!freshOtp && freshOtp.length === 6);
  }

  // 3.7: Valid OTP verification succeeds and subsequent login works
  {
    const verifyRes = await app.request('/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: verifiedTestEmail, otp: freshOtp })
    });
    assert('Valid OTP verification returns 200', verifyRes.status === 200);
    const verifyData = await verifyRes.json();
    assert('Valid OTP verification issues valid session token', !!verifyData.token && verifyData.token.startsWith('et_'));
    assert('Valid OTP verification returns sanitized user profile', verifyData.user?.email === verifiedTestEmail);

    // Subsequent login for verified account succeeds
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: verifiedTestEmail, password: testPassword })
    });
    assert('Subsequent login for newly verified account returns 200', loginRes.status === 200);
  }

  // -------------------------------------------------------------
  // Test Suite 4: Session Invalidation on Logout & Expiry
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 4: Session Invalidation on Logout & Expiry ---');

  // 4.1: Log in with analyst
  let sessionToken = '';
  {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'analyst@ecotwin.ai', password: 'demo123' })
    });
    const data = await res.json();
    sessionToken = data.token;
  }

  // 4.2: Verify /auth/me works with valid session
  {
    const res = await app.request('/auth/me', {
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    assert('/auth/me returns 200 with active session', res.status === 200);
  }

  // 4.3: Logout with session
  {
    const res = await app.request('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    assert('/auth/logout returns 200', res.status === 200);
  }

  // 4.4: Verify /auth/me now returns 401 with the terminated session
  {
    const res = await app.request('/auth/me', {
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    assert('/auth/me returns 401 after logout (session revoked)', res.status === 401);
  }

  // 4.5: Expired session returns 401 on /auth/me
  {
    // Log in again to get fresh session
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'analyst@ecotwin.ai', password: 'demo123' })
    });
    const { token: freshToken } = await res.json();
    // Simulate time +2 days (> 86400000ms expiration)
    const checkRes = await app.request('/auth/me', {
      headers: { Authorization: `Bearer ${freshToken}` }
    }, { TEST_MOCK_TIME: Date.now() + 2 * 86400000 });
    assert('/auth/me returns 401 for expired session', checkRes.status === 401);
  }

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n=============================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
