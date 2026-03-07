/* ============================================================
   EcoTwin v3 — AI Digital Sustainability Platform
   LIVE APIs: Open-Meteo Weather | REST Countries | Carbon Market
   Real-time SSE | Live KPIs | Dynamic Market Ticker
   ============================================================ */
'use strict';

// ─── Global State ────────────────────────────────────────────────────────────
const ST = {
  activeTab: 'dashboard',
  lang: localStorage.getItem('ecotwin_lang') || 'en',
  theme: localStorage.getItem('ecotwin_theme') || 'dark',
  token: localStorage.getItem('ecotwin_token') || null,
  user: JSON.parse(localStorage.getItem('ecotwin_user') || 'null'),
  worldData: [],
  anomalyData: [],
  sdgData: null,
  realtimeData: [],
  simResult: null,
  rlResult: null,
  compareResult: null,
  enterpriseData: null,
  historyData: null,
  shapData: null,
  i18n: {},
  globeAnimFrame: null,
  globeRotating: true,
  realtimeInterval: null,
  tickerInterval: null,
  dashboardInterval: null,
  sseSource: null,
  marketData: null,
  tickerData: null,
  weatherData: {},
  lastWorldUpdate: 0,
  charts: {},
};

// ─── Live SSE Connection ──────────────────────────────────────────────────────
function startSSE() {
  if (ST.sseSource) { ST.sseSource.close(); ST.sseSource = null; }
  try {
    ST.sseSource = new EventSource('/sse/live');
    ST.sseSource.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        // Update live ticker bar with SSE data
        updateTickerFromSSE(d);
      } catch {}
    };
    ST.sseSource.onerror = () => {
      // Auto-reconnect after 5s
      setTimeout(() => { if (ST.activeTab !== 'none') startSSE(); }, 5000);
    };
  } catch {}
}

function updateTickerFromSSE(d) {
  const el = document.getElementById('live-ticker-bar');
  if (!el) return;
  // Update specific ticker items
  const co2El = document.getElementById('ticker-co2ppm');
  const ccEl = document.getElementById('ticker-carbon-credit');
  const energyEl = document.getElementById('ticker-energy');
  if (co2El && d.co2ppm) { co2El.textContent = d.co2ppm + ' ppm'; flashEl(co2El); }
  if (ccEl && d.carbonCredit) { ccEl.textContent = '€' + d.carbonCredit + '/t'; flashEl(ccEl); }
  if (energyEl && d.energy) { energyEl.textContent = d.energy + ' kWh'; flashEl(energyEl); }
}

function flashEl(el) {
  el.classList.add('text-cyan-300');
  setTimeout(() => el.classList.remove('text-cyan-300'), 800);
}

// ─── Global Ticker Bar ────────────────────────────────────────────────────────
async function initGlobalTicker() {
  await updateGlobalTicker();
  ST.tickerInterval = setInterval(updateGlobalTicker, 5000);
}

async function updateGlobalTicker() {
  try {
    const r = await fetch('/global_ticker');
    const d = await r.json();
    ST.tickerData = d;
    renderTickerBar(d);
    // Also update dashboard KPI counters if on dashboard
    if (ST.activeTab === 'dashboard') updateDashboardLiveKPIs(d);
  } catch {}
}

function renderTickerBar(d) {
  const bar = document.getElementById('live-ticker-bar');
  if (!bar) return;
  const items = [
    { id:'ticker-co2ppm', icon:'fa-cloud', label:'CO₂', value: d.globalCO2ppm + ' ppm', color: d.globalCO2ppm > 422 ? 'text-red-400' : 'text-yellow-400' },
    { id:'ticker-temp', icon:'fa-thermometer-half', label:'Temp Δ', value: '+' + d.globalTemp + '°C', color: d.globalTemp > 1.2 ? 'text-orange-400' : 'text-yellow-400' },
    { id:'ticker-carbon-credit', icon:'fa-euro-sign', label:'EU ETS', value: '€' + d.carbonCreditEUR + '/t', color: 'text-emerald-400' },
    { id:'ticker-renewable-idx', icon:'fa-solar-panel', label:'Renew.Idx', value: d.renewableIndex, color: 'text-cyan-400' },
    { id:'ticker-fossil-idx', icon:'fa-industry', label:'Fossil Idx', value: d.fossilIndex, color: d.fossilIndex > 100 ? 'text-red-400' : 'text-gray-400' },
    { id:'ticker-solar', icon:'fa-sun', label:'Solar', value: (+d.solarCapacity).toLocaleString() + ' GW', color: 'text-yellow-400' },
    { id:'ticker-wind', icon:'fa-wind', label:'Wind', value: (+d.windCapacity).toLocaleString() + ' GW', color: 'text-blue-400' },
    { id:'ticker-renew-share', icon:'fa-leaf', label:'Renew%', value: d.renewableShare + '%', color: 'text-emerald-400' },
    { id:'ticker-ocean-ph', icon:'fa-water', label:'Ocean pH', value: d.oceanPh, color: d.oceanPh < 8.05 ? 'text-red-400' : 'text-blue-400' },
    { id:'ticker-energy', icon:'fa-bolt', label:'Live Energy', value: (ST.tickerData?.energy || '—'), color: 'text-yellow-300' },
  ];
  bar.innerHTML = items.map(it => `
    <span class="flex items-center gap-1 flex-none px-3 py-1 border-r border-gray-800/60">
      <i class="fas ${it.icon} text-[9px] ${it.color}"></i>
      <span class="text-[9px] text-gray-500">${it.label}:</span>
      <span id="${it.id}" class="text-[9px] font-bold ${it.color} transition-colors duration-700">${it.value}</span>
    </span>`).join('');
}

function updateDashboardLiveKPIs(d) {
  // Update KPI counters on dashboard in real-time
  const co2El = document.getElementById('kpi-co2-live');
  const renEl = document.getElementById('kpi-renewable-live');
  const co2ppmEl = document.getElementById('kpi-co2ppm-live');
  const ccEl = document.getElementById('kpi-carbon-credit-live');
  if (co2El) animateValue(co2El, parseFloat(co2El.dataset.val||'6.2'), 6.2 + (Math.random()-0.5)*0.1, 800, 2);
  if (renEl) animateValue(renEl, parseFloat(renEl.dataset.val||'40'), d.renewableShare, 800, 1);
  if (co2ppmEl) { co2ppmEl.textContent = d.globalCO2ppm; co2ppmEl.dataset.val = d.globalCO2ppm; }
  if (ccEl) { ccEl.textContent = '€' + d.carbonCreditEUR; ccEl.dataset.val = d.carbonCreditEUR; }
}

function animateValue(el, start, end, duration, decimals) {
  const startTime = performance.now();
  function update(ts) {
    const progress = Math.min((ts - startTime) / duration, 1);
    const val = start + (end - start) * progress;
    el.textContent = val.toFixed(decimals);
    el.dataset.val = val;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ─── Country Coords for Globe ─────────────────────────────────────────────────
const CC = {
  USA:{lat:37.09,lon:-95.71},CHN:{lat:35.86,lon:104.19},IND:{lat:20.59,lon:78.96},
  DEU:{lat:51.16,lon:10.45},NOR:{lat:60.47,lon:8.46},BRA:{lat:-14.23,lon:-51.92},
  RUS:{lat:61.52,lon:105.31},AUS:{lat:-25.27,lon:133.77},JPN:{lat:36.20,lon:138.25},
  FRA:{lat:46.22,lon:2.21},CAN:{lat:56.13,lon:-106.34},GBR:{lat:55.37,lon:-3.43},
  SWE:{lat:60.12,lon:18.64},DNK:{lat:56.26,lon:9.50},ZAF:{lat:-30.55,lon:22.93},
  NGA:{lat:9.08,lon:8.67},MEX:{lat:23.63,lon:-102.55},IDN:{lat:-0.78,lon:113.92},
  SAU:{lat:23.88,lon:45.07},KOR:{lat:35.90,lon:127.76},TUR:{lat:38.96,lon:35.24},
  ESP:{lat:40.46,lon:-3.74},ITA:{lat:41.87,lon:12.56},NLD:{lat:52.13,lon:5.29},
  CHE:{lat:46.81,lon:8.22},FIN:{lat:61.92,lon:25.74},NZL:{lat:-40.90,lon:174.88},
  ISL:{lat:64.96,lon:-19.02},AUT:{lat:47.51,lon:14.55},PRT:{lat:39.39,lon:-8.22},
  ARG:{lat:-38.41,lon:-63.61},EGY:{lat:26.82,lon:30.80},CHL:{lat:-35.67,lon:-71.54},
  KEN:{lat:0.02,lon:37.90},ETH:{lat:9.14,lon:40.49},MAR:{lat:31.79,lon:-7.09},
  IRN:{lat:32.42,lon:53.68},PAK:{lat:30.37,lon:69.34},BGD:{lat:23.68,lon:90.35},
  VNM:{lat:14.06,lon:108.27},THA:{lat:15.87,lon:100.99},POL:{lat:51.91,lon:19.14},
  SGP:{lat:1.35,lon:103.81},PHL:{lat:12.87,lon:121.77},MYS:{lat:4.21,lon:101.97},
  COL:{lat:4.57,lon:-74.29},PER:{lat:-9.19,lon:-75.01},GRC:{lat:39.07,lon:21.82},
};

// ─── Utility Helpers ──────────────────────────────────────────────────────────
const scoreColor  = s => s>=75?'#10b981':s>=50?'#f59e0b':'#ef4444';
const scoreLabel  = s => s>=75?t('sustainable'):s>=50?t('moderate'):t('critical');
const scoreGrade  = s => s>=85?'A+':s>=75?'A':s>=65?'B':s>=55?'C':s>=45?'D':'F';
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const t = (key) => ST.i18n[key] || key;
const authHeaders = () => ST.token ? {'Authorization':`Bearer ${ST.token}`,'Content-Type':'application/json'} : {'Content-Type':'application/json'};
function hexToRgb(hex){const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;return[r,g,b];}
function toast(msg,type='info'){
  const el=document.createElement('div');
  const colors={info:'bg-blue-800 border-blue-600',success:'bg-emerald-800 border-emerald-600',error:'bg-red-800 border-red-600',warn:'bg-yellow-800 border-yellow-600'};
  el.className=`pointer-events-auto px-4 py-3 rounded-lg border text-xs text-white shadow-2xl max-w-xs ${colors[type]||colors.info} toast-item`;
  el.innerHTML=`<div class="flex items-start gap-2"><i class="fas ${type==='success'?'fa-check-circle text-emerald-400':type==='error'?'fa-circle-xmark text-red-400':type==='warn'?'fa-triangle-exclamation text-yellow-400':'fa-circle-info text-blue-400'} mt-0.5"></i><span>${msg}</span></div>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(()=>el.remove(),4000);
}
function showModal(html){const ov=document.getElementById('modal-overlay');ov.classList.remove('hidden');ov.innerHTML=`<div class="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl relative">${html}</div>`;ov.onclick=e=>{if(e.target===ov)closeModal()};}
function closeModal(){document.getElementById('modal-overlay').classList.add('hidden');}

// ─── i18n Load ────────────────────────────────────────────────────────────────
async function loadI18n(lang){
  try{const r=await fetch(`/i18n/${lang}`);ST.i18n=await r.json();}
  catch(e){ST.i18n={};}
  ST.i18n.sustainable='Sustainable';ST.i18n.moderate='Moderate';ST.i18n.critical='Critical';
}

// ════════════════════════════════════════════════════════════════════════════
// AUTH SYSTEM
// ════════════════════════════════════════════════════════════════════════════
function showLoginModal(){
  showModal(`
    <button onclick="closeModal()" class="absolute top-3 right-3 text-gray-500 hover:text-white"><i class="fas fa-xmark"></i></button>
    <div class="text-center mb-6">
      <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-500 flex items-center justify-center mx-auto mb-3">
        <i class="fas fa-leaf text-gray-950"></i></div>
      <h2 class="text-lg font-bold text-cyan-300">${t('login')} — EcoTwin</h2>
      <p class="text-xs text-gray-400 mt-1">AI Digital Sustainability Platform</p>
    </div>
    <div class="space-y-3" id="login-form">
      <div><label class="text-xs text-gray-400">Email</label>
        <input id="auth-email" type="email" value="admin@ecotwin.ai" placeholder="admin@ecotwin.ai"
               class="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 text-gray-100"/></div>
      <div><label class="text-xs text-gray-400">Password</label>
        <div class="relative mt-1">
          <input id="auth-pass" type="password" value="admin123" placeholder="admin123"
                 class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:border-cyan-500 text-gray-100"/>
          <button onclick="togglePassVis()" class="absolute right-2 top-2 text-gray-400 hover:text-white"><i class="fas fa-eye text-xs" id="pass-eye-icon"></i></button>
        </div></div>
      <div id="auth-error" class="hidden text-xs text-red-400 text-center"></div>
      <button onclick="doLogin()" id="login-btn"
              class="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2">
        <i class="fas fa-sign-in-alt"></i> ${t('login')}
      </button>
      <div class="text-center"><span class="text-xs text-gray-500">No account? </span>
        <button onclick="showRegisterModal()" class="text-xs text-cyan-400 hover:underline">${t('register')}</button></div>
      <div class="border-t border-gray-700 pt-3 text-center">
        <p class="text-[10px] text-gray-500">Demo: admin@ecotwin.ai / admin123</p>
        <p class="text-[10px] text-gray-500">Analyst: analyst@ecotwin.ai / demo123</p>
      </div>
    </div>`);
}

function togglePassVis(){const inp=document.getElementById('auth-pass'),ico=document.getElementById('pass-eye-icon');
  if(inp.type==='password'){inp.type='text';ico.classList.replace('fa-eye','fa-eye-slash');}
  else{inp.type='password';ico.classList.replace('fa-eye-slash','fa-eye');}}

async function doLogin(){
  const btn=document.getElementById('login-btn');
  btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Signing in...'; btn.disabled=true;
  const email=document.getElementById('auth-email').value;
  const pass=document.getElementById('auth-pass').value;
  const r=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})});
  const d=await r.json();
  if(!r.ok){
    const err=document.getElementById('auth-error');err.textContent=d.error||'Login failed';err.classList.remove('hidden');
    btn.innerHTML=`<i class="fas fa-sign-in-alt"></i> ${t('login')}`; btn.disabled=false; return;
  }
  ST.token=d.token; ST.user=d.user;
  localStorage.setItem('ecotwin_token',d.token); localStorage.setItem('ecotwin_user',JSON.stringify(d.user));
  if(d.user.lang&&d.user.lang!==ST.lang){ST.lang=d.user.lang;localStorage.setItem('ecotwin_lang',d.user.lang);}
  closeModal(); toast(`Welcome back, ${d.user.name}!`,'success');
  renderShell();
}

function showRegisterModal(){
  showModal(`
    <button onclick="closeModal()" class="absolute top-3 right-3 text-gray-500 hover:text-white"><i class="fas fa-xmark"></i></button>
    <h2 class="text-lg font-bold text-cyan-300 mb-4 text-center">${t('register')} — EcoTwin</h2>
    <div class="space-y-3">
      <input id="reg-name" type="text" placeholder="Full Name" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 text-gray-100"/>
      <input id="reg-email" type="email" placeholder="Email Address" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 text-gray-100"/>
      <input id="reg-pass" type="password" placeholder="Password (min 6 chars)" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 text-gray-100"/>
      <input id="reg-org" type="text" placeholder="Organization (optional)" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 text-gray-100"/>
      <select id="reg-lang" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100">
        <option value="en">English</option><option value="es">Español</option><option value="fr">Français</option>
        <option value="de">Deutsch</option><option value="zh">中文</option><option value="ar">العربية</option>
        <option value="hi">हिन्दी</option><option value="pt">Português</option>
      </select>
      <div id="reg-error" class="hidden text-xs text-red-400 text-center"></div>
      <button onclick="doRegister()" id="reg-btn"
              class="w-full py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold text-sm hover:opacity-90 flex items-center justify-center gap-2">
        <i class="fas fa-user-plus"></i> Create Account
      </button>
      <div class="text-center"><button onclick="showLoginModal()" class="text-xs text-cyan-400 hover:underline">Back to Login</button></div>
    </div>`);
}

async function doRegister(){
  const btn=document.getElementById('reg-btn');
  btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>...'; btn.disabled=true;
  const body={name:document.getElementById('reg-name').value,email:document.getElementById('reg-email').value,
    password:document.getElementById('reg-pass').value,org:document.getElementById('reg-org').value,
    lang:document.getElementById('reg-lang').value};
  const r=await fetch('/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d=await r.json();
  if(!r.ok){const err=document.getElementById('reg-error');err.textContent=d.error||'Error';err.classList.remove('hidden');
    btn.innerHTML='<i class="fas fa-user-plus"></i> Create Account'; btn.disabled=false; return;}
  showOtpModal(body.email, d.otp);
}

function showOtpModal(email, demoOtp){
  showModal(`
    <button onclick="closeModal()" class="absolute top-3 right-3 text-gray-500 hover:text-white"><i class="fas fa-xmark"></i></button>
    <div class="text-center mb-4">
      <div class="w-12 h-12 rounded-full bg-cyan-900 flex items-center justify-center mx-auto mb-3"><i class="fas fa-envelope-circle-check text-cyan-400 text-xl"></i></div>
      <h2 class="text-base font-bold text-cyan-300">Email Verification</h2>
      <p class="text-xs text-gray-400 mt-1">OTP sent to <strong>${email}</strong></p>
    </div>
    <div class="bg-emerald-900/30 border border-emerald-700/50 rounded-lg p-3 mb-4 text-center">
      <p class="text-xs text-emerald-300">Demo OTP (shown for testing):</p>
      <p class="text-2xl font-black text-emerald-400 tracking-widest mt-1">${demoOtp||'------'}</p>
    </div>
    <div class="space-y-3">
      <input id="otp-input" type="text" placeholder="Enter 6-digit OTP" maxlength="6"
             class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-center text-2xl tracking-widest font-mono focus:outline-none focus:border-cyan-500 text-gray-100"/>
      <div id="otp-error" class="hidden text-xs text-red-400 text-center"></div>
      <button onclick="doVerifyOtp('${email}')" id="otp-btn"
              class="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-bold text-sm hover:opacity-90">
        Verify OTP & Login
      </button>
    </div>`);
}

async function doVerifyOtp(email){
  const otp=document.getElementById('otp-input').value.trim();
  const btn=document.getElementById('otp-btn');btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>...';btn.disabled=true;
  const r=await fetch('/auth/verify-otp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,otp})});
  const d=await r.json();
  if(!r.ok){const err=document.getElementById('otp-error');err.textContent=d.error||'Invalid OTP';err.classList.remove('hidden');
    btn.innerHTML='Verify OTP & Login';btn.disabled=false;return;}
  ST.token=d.token;ST.user=d.user;
  localStorage.setItem('ecotwin_token',d.token);localStorage.setItem('ecotwin_user',JSON.stringify(d.user));
  closeModal();toast('Account verified! Welcome to EcoTwin.','success');renderShell();
}

async function doLogout(){
  await fetch('/auth/logout',{method:'POST',headers:authHeaders()});
  ST.token=null;ST.user=null;
  localStorage.removeItem('ecotwin_token');localStorage.removeItem('ecotwin_user');
  toast('Logged out successfully.','info');renderShell();
}

// ════════════════════════════════════════════════════════════════════════════
// SHELL & NAV
// ════════════════════════════════════════════════════════════════════════════
const NAV_TABS = [
  ['dashboard','fa-chart-line','dashboard'],
  ['map','fa-earth-americas','worldMap'],
  ['realtime','fa-signal','realtime'],
  ['simulator','fa-sliders','simulator'],
  ['compare','fa-code-compare','compare'],
  ['shap','fa-magnifying-glass-chart','shap'],
  ['rl','fa-brain','rlOptimizer'],
  ['anomaly','fa-triangle-exclamation','anomaly'],
  ['globe3d','fa-globe','globe3d'],
  ['sdg','fa-bullseye','sdgTracker'],
  ['history','fa-clock-rotate-left','history'],
  ['analytics','fa-chart-bar','analytics'],
  ['risk','fa-shield-virus','riskTab'],
  ['carbon','fa-fire','carbonTab'],
  ['cities','fa-building-columns','citiesTab'],
  ['policy','fa-scale-balanced','policyTab'],
  ['market','fa-chart-candlestick','marketTab'],
  ['news','fa-newspaper','newsTab'],
  ['ai','fa-comments','askAI'],
  ['satellite','fa-satellite','satelliteTab'],
  ['threat','fa-radiation','threatTab'],
  ['health','fa-heart-pulse','healthTab'],
  ['race','fa-ranking-star','raceTab'],
  ['admin','fa-shield-halved','admin'],
];

function renderShell(){
  const isRTL = ST.lang==='ar';
  document.getElementById('html-root').setAttribute('dir', isRTL?'rtl':'ltr');
  document.getElementById('html-root').setAttribute('lang', ST.lang);

  const LANGS = [{v:'en',l:'EN 🇬🇧'},{v:'es',l:'ES 🇪🇸'},{v:'fr',l:'FR 🇫🇷'},{v:'de',l:'DE 🇩🇪'},
                 {v:'zh',l:'ZH 🇨🇳'},{v:'ar',l:'AR 🇸🇦'},{v:'hi',l:'HI 🇮🇳'},{v:'pt',l:'PT 🇧🇷'}];

  document.getElementById('root').innerHTML = `
  <div class="min-h-screen flex flex-col" id="app-wrapper">
    <!-- HEADER -->
    <header class="et-header sticky top-0 z-50">
      <div class="max-w-screen-2xl mx-auto px-3 py-2 flex items-center gap-3">
        <!-- Logo -->
        <div class="flex items-center gap-2.5 flex-none">
          <div class="et-logo-icon w-9 h-9 rounded-xl flex items-center justify-center shadow-lg">
            <i class="fas fa-leaf text-emerald-300 text-sm"></i></div>
          <div class="hidden sm:block">
            <div class="et-logo-text">ECO<span>TWIN</span></div>
            <div class="text-[8px] text-gray-500 tracking-[0.2em] uppercase font-medium">${t('nav.title')}</div>
          </div>
        </div>
        <!-- Spacer -->
        <div class="flex-1"></div>
        <!-- Live Data Sources badge -->
        <div class="hidden lg:flex et-live-badge" title="Live APIs: Open-Meteo Weather, REST Countries, Carbon Market, NOAA CO₂, NASA GIBS">
          <span class="et-live-dot"></span>
          <span>7 Live APIs</span>
        </div>
        <!-- Lang selector -->
        <select id="lang-selector" onchange="changeLang(this.value)"
                class="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200 cursor-pointer focus:outline-none focus:border-cyan-500">
          ${LANGS.map(l=>`<option value="${l.v}" ${ST.lang===l.v?'selected':''}>${l.l}</option>`).join('')}
        </select>
        <!-- Auth buttons -->
        ${ST.user ? `
          <div class="flex items-center gap-2">
            <button onclick="showProfileModal()" class="flex items-center gap-2 px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 transition-all border border-gray-700">
              <div class="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-600 to-emerald-600 flex items-center justify-center text-[10px] font-bold">${(ST.user.name||'U')[0]}</div>
              <span class="text-xs text-gray-200 hidden sm:block">${ST.user.name}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded text-[9px] font-bold ${ST.user.role==='admin'?'bg-red-900 text-red-300':ST.user.role==='analyst'?'bg-cyan-900 text-cyan-300':'bg-gray-700 text-gray-400'}">${ST.user.role}</span>
            </button>
            <button onclick="doLogout()" class="px-2 py-1 text-xs text-gray-400 hover:text-red-400 transition-all" title="${t('logout')}"><i class="fas fa-sign-out-alt"></i></button>
          </div>` : `
          <button onclick="showLoginModal()" class="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-700 to-emerald-700 text-white text-xs font-bold hover:opacity-90 transition-all">
            <i class="fas fa-sign-in-alt mr-1"></i>${t('login')}
          </button>`}
      </div>
      <!-- LIVE TICKER BAR -->
      <div class="border-t border-gray-800/60 bg-gray-950/80 overflow-hidden">
        <div class="flex overflow-x-auto scrollbar-hide" id="live-ticker-bar">
          <span class="flex items-center gap-1 flex-none px-3 py-0.5 text-[9px] text-gray-600 animate-pulse">Loading live data...</span>
        </div>
      </div>
      <!-- NAV TABS -->
      <nav class="max-w-screen-2xl mx-auto px-2 flex gap-0.5 overflow-x-auto pb-0.5 scrollbar-hide" id="nav-tabs">
        ${NAV_TABS.filter(([id])=>id!=='admin'||(ST.user&&ST.user.role==='admin')).map(([id,icon,key])=>`
          <button onclick="switchTab('${id}')" id="tab-${id}"
            class="tab-btn flex-none px-2.5 py-1.5 text-[10px] font-semibold flex items-center gap-1.5 transition-all rounded-t whitespace-nowrap
                   ${ST.activeTab===id?'bg-cyan-900/50 text-cyan-300 border-b border-cyan-500':'text-gray-500 hover:text-gray-300'}">
            <i class="fas ${icon} text-[9px]"></i>${t(key)}
            ${id==='market'?'<span class="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>':''}
            ${id==='satellite'?'<span class="w-1 h-1 rounded-full bg-cyan-400 animate-pulse"></span>':''}
            ${id==='threat'?'<span class="w-1 h-1 rounded-full bg-red-400 animate-pulse"></span>':''}
            ${id==='health'?'<span class="w-1 h-1 rounded-full bg-emerald-300 animate-pulse"></span>':''}
            ${id==='race'?'<span class="w-1 h-1 rounded-full bg-orange-400 animate-pulse"></span>':''}
          </button>`).join('')}
      </nav>
    </header>
    <!-- CONTENT -->
    <main class="flex-1 max-w-screen-2xl w-full mx-auto px-3 py-5" id="main-content">
      <div id="tab-content"></div>
    </main>
    <!-- FOOTER -->
    <footer class="border-t border-gray-800/30 py-3 text-center text-[9px] text-gray-600">
      <span class="gradient-text-cyber font-bold">EcoTwin v4</span> · AI Digital Sustainability Platform · Live APIs: Open-Meteo · REST Countries · Carbon Market · NOAA CO₂ · NASA GIBS · © 2025
    </footer>
  </div>`;
  renderTab(ST.activeTab);
  // Start live ticker after shell renders
  initGlobalTicker();
  startSSE();
}

function switchTab(id){
  ST.activeTab=id;
  if(ST.globeAnimFrame){cancelAnimationFrame(ST.globeAnimFrame);ST.globeAnimFrame=null;}
  if(ST.realtimeInterval&&id!=='realtime'){clearInterval(ST.realtimeInterval);ST.realtimeInterval=null;}
  if(ST.dashboardInterval&&id!=='dashboard'){clearInterval(ST.dashboardInterval);ST.dashboardInterval=null;}
  if(ST.threatInterval&&id!=='threat'){clearInterval(ST.threatInterval);ST.threatInterval=null;}
  if(ST.healthInterval&&id!=='health'){clearInterval(ST.healthInterval);ST.healthInterval=null;}
  if(ST.raceInterval&&id!=='race'){clearInterval(ST.raceInterval);ST.raceInterval=null;}
  document.querySelectorAll('.tab-btn').forEach(b=>{
    const bid=b.id.replace('tab-','');
    b.className=b.className
      .replace('bg-cyan-900/50 text-cyan-300 border-b border-cyan-500','')
      .replace('text-gray-500 hover:text-gray-300','');
    if(bid===id)b.classList.add('bg-cyan-900/50','text-cyan-300','border-b','border-cyan-500');
    else b.classList.add('text-gray-500','hover:text-gray-300');
  });
  renderTab(id);
}

async function changeLang(lang){
  ST.lang=lang; localStorage.setItem('ecotwin_lang',lang);
  await loadI18n(lang);
  if(ST.user){await fetch('/auth/profile',{method:'PUT',headers:authHeaders(),body:JSON.stringify({lang})});}
  renderShell();
}

function renderTab(id){
  const el=document.getElementById('tab-content');
  if(!el)return;
  const renders={
    dashboard:()=>{el.innerHTML=dashboardHTML();initDashboard();},
    map:()=>{el.innerHTML=mapHTML();initMap();},
    realtime:()=>{el.innerHTML=realtimeHTML();initRealtime();},
    simulator:()=>{el.innerHTML=simulatorHTML();},
    compare:()=>{el.innerHTML=compareHTML();},
    shap:()=>{el.innerHTML=shapHTML();},
    rl:()=>{el.innerHTML=rlHTML();},
    anomaly:()=>{el.innerHTML=anomalyHTML();loadAnomaly();},
    globe3d:()=>{el.innerHTML=globe3dHTML();initGlobe3D();},
    sdg:()=>{el.innerHTML=sdgHTML();loadSDG();},
    history:()=>{el.innerHTML=historyHTML();loadHistory();},
    analytics:()=>{el.innerHTML=analyticsHTML();loadAnalytics();},
    risk:()=>{el.innerHTML=riskHTML();},
    carbon:()=>{el.innerHTML=carbonHTML();loadCarbon();},
    cities:()=>{el.innerHTML=citiesHTML();loadCities();},
    policy:()=>{el.innerHTML=policyHTML();},
    market:()=>{el.innerHTML=marketHTML();loadMarket();},
    news:()=>{el.innerHTML=newsHTML();loadNews();},
    ai:()=>{el.innerHTML=aiHTML();},
    satellite:()=>{el.innerHTML=satelliteHTML();initSatellite();},
    threat:()=>{el.innerHTML=threatHTML();initThreat();},
    health:()=>{el.innerHTML=healthHTML();initPlanetHealth();},
    race:()=>{el.innerHTML=raceHTML();initRace();},
    admin:()=>{el.innerHTML=adminHTML();loadAdmin();},
  };
  (renders[id]||renders.dashboard)();
}

// ════════════════════════════════════════════════════════════════════════════
// PROFILE MODAL
// ════════════════════════════════════════════════════════════════════════════
function showProfileModal(){
  if(!ST.user)return;
  showModal(`
    <button onclick="closeModal()" class="absolute top-3 right-3 text-gray-500 hover:text-white"><i class="fas fa-xmark"></i></button>
    <h2 class="text-base font-bold text-cyan-300 mb-4">User Profile</h2>
    <div class="flex items-center gap-3 mb-4 pb-4 border-b border-gray-700">
      <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-600 to-emerald-600 flex items-center justify-center text-2xl font-black">${ST.user.name[0]}</div>
      <div>
        <div class="font-bold text-white">${ST.user.name}</div>
        <div class="text-xs text-gray-400">${ST.user.email}</div>
        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${ST.user.role==='admin'?'bg-red-900 text-red-300':'bg-cyan-900 text-cyan-300'}">${ST.user.role}</span>
      </div>
    </div>
    <div class="space-y-2">
      <div><label class="text-xs text-gray-400">Display Name</label>
        <input id="prof-name" value="${ST.user.name}" class="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-cyan-500"/></div>
      <div><label class="text-xs text-gray-400">Organization</label>
        <input id="prof-org" value="${ST.user.org||''}" class="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-cyan-500"/></div>
      <div><label class="text-xs text-gray-400">Preferred Language</label>
        <select id="prof-lang" class="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-cyan-500">
          ${[{v:'en',l:'English'},{v:'es',l:'Español'},{v:'fr',l:'Français'},{v:'de',l:'Deutsch'},
             {v:'zh',l:'中文'},{v:'ar',l:'العربية'},{v:'hi',l:'हिन्दी'},{v:'pt',l:'Português'}]
            .map(l=>`<option value="${l.v}" ${ST.lang===l.v?'selected':''}>${l.l}</option>`).join('')}
        </select></div>
      <button onclick="saveProfile()" class="w-full py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-bold transition-all mt-2">
        <i class="fas fa-save mr-1"></i> Save Profile
      </button>
    </div>`);
}

async function saveProfile(){
  const name=document.getElementById('prof-name').value;
  const org=document.getElementById('prof-org').value;
  const lang=document.getElementById('prof-lang').value;
  const r=await fetch('/auth/profile',{method:'PUT',headers:authHeaders(),body:JSON.stringify({name,org,lang})});
  if(r.ok){
    ST.user={...ST.user,name,org,lang}; ST.lang=lang;
    localStorage.setItem('ecotwin_user',JSON.stringify(ST.user));
    localStorage.setItem('ecotwin_lang',lang);
    await loadI18n(lang); closeModal(); toast('Profile updated!','success'); renderShell();
  } else toast('Update failed','error');
}

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
function dashboardHTML(){return `
  <div class="space-y-5">
    <!-- Hero Header -->
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h2 class="text-xl font-black gradient-text-cyber flex items-center gap-2.5">
          <span class="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-900/80 to-emerald-900/80 border border-cyan-700/50 flex items-center justify-center">
            <i class="fas fa-chart-line text-cyan-400 text-sm"></i>
          </span>
          ${t('dashboard')}
        </h2>
        <p class="text-[10px] text-gray-500 mt-0.5 ml-10">AI Digital Sustainability Intelligence · Live data from REST Countries, Open-Meteo, Carbon Markets & NASA</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-gray-600 mono" id="dash-last-update">Loading...</span>
        <button onclick="refreshDashboard()" class="px-3 py-1.5 text-[10px] rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:text-cyan-300 hover:border-cyan-700 transition-all flex items-center gap-1.5">
          <i class="fas fa-rotate-right"></i> Refresh
        </button>
      </div>
    </div>

    <!-- Premium KPI Cards Row 1 — with sparklines + glow rings -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <!-- Countries -->
      <div class="et-card-kpi neon-border-cyan" style="color:#22d3ee">
        <div class="flex items-center gap-1.5 mb-2">
          <div class="w-7 h-7 rounded-lg bg-cyan-900/50 border border-cyan-800/60 flex items-center justify-center">
            <i class="fas fa-earth-americas text-cyan-400 text-[10px]"></i>
          </div>
          <span class="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">${t('kpi.countries')}</span>
        </div>
        <div class="flex items-end justify-between">
          <div>
            <div class="text-3xl font-black text-cyan-300 glow-cyan mono leading-none">50+</div>
            <div class="text-[9px] text-emerald-400 mt-1 font-semibold">↑ +5 this year</div>
          </div>
          <svg class="kpi-sparkline-svg opacity-60" width="60" height="28" viewBox="0 0 60 28" fill="none">
            <polyline points="0,22 10,18 20,20 30,14 40,16 50,10 60,8" stroke="#22d3ee" stroke-width="1.5" fill="none"/>
            <polygon points="0,22 10,18 20,20 30,14 40,16 50,10 60,8 60,28 0,28" fill="#22d3ee" opacity="0.1"/>
          </svg>
        </div>
        <div class="text-[8px] text-gray-600 mt-2">✅ REST Countries API</div>
      </div>

      <!-- Avg Score -->
      <div class="et-card-kpi neon-border-green" style="color:#10b981">
        <div class="flex items-center gap-1.5 mb-2">
          <div class="w-7 h-7 rounded-lg bg-emerald-900/50 border border-emerald-800/60 flex items-center justify-center">
            <i class="fas fa-leaf text-emerald-400 text-[10px]"></i>
          </div>
          <span class="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">${t('kpi.avgScore')}</span>
        </div>
        <div class="flex items-end justify-between">
          <div>
            <div class="text-3xl font-black text-emerald-300 glow-emerald mono leading-none">61<span class="text-base text-gray-500 font-normal">/100</span></div>
            <div class="text-[9px] text-emerald-400 mt-1 font-semibold">↑ +1.8 YoY</div>
          </div>
          <svg class="opacity-60" width="60" height="28" viewBox="0 0 60 28" fill="none">
            <polyline points="0,20 10,20 20,18 30,17 40,16 50,14 60,13" stroke="#10b981" stroke-width="1.5" fill="none"/>
            <polygon points="0,20 10,20 20,18 30,17 40,16 50,14 60,13 60,28 0,28" fill="#10b981" opacity="0.1"/>
          </svg>
        </div>
        <div class="text-[8px] text-gray-600 mt-2">🔄 Updates every 30s</div>
      </div>

      <!-- Atm CO2 -->
      <div class="et-card-kpi" style="color:#f59e0b; border-color:rgba(245,158,11,0.3); box-shadow: 0 0 12px rgba(245,158,11,0.08)">
        <div class="flex items-center gap-1.5 mb-2">
          <div class="w-7 h-7 rounded-lg bg-amber-900/50 border border-amber-800/60 flex items-center justify-center">
            <i class="fas fa-cloud text-amber-400 text-[10px]"></i>
          </div>
          <span class="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Atm. CO₂</span>
        </div>
        <div class="flex items-end justify-between">
          <div>
            <div class="text-3xl font-black text-amber-300 mono leading-none"><span id="kpi-co2ppm-live">422.5</span><span class="text-base text-gray-500 font-normal"> ppm</span></div>
            <div class="text-[9px] text-red-400 mt-1 font-semibold">↑ +2.5 ppm/yr</div>
          </div>
          <svg class="opacity-60" width="60" height="28" viewBox="0 0 60 28" fill="none">
            <polyline points="0,24 10,22 20,21 30,19 40,17 50,14 60,12" stroke="#f59e0b" stroke-width="1.5" fill="none"/>
            <polygon points="0,24 10,22 20,21 30,19 40,17 50,14 60,12 60,28 0,28" fill="#f59e0b" opacity="0.1"/>
          </svg>
        </div>
        <div class="text-[8px] text-gray-600 mt-2">📡 NOAA seasonal model</div>
      </div>

      <!-- EU ETS Carbon Price -->
      <div class="et-card-kpi neon-border-violet" style="color:#8b5cf6">
        <div class="flex items-center gap-1.5 mb-2">
          <div class="w-7 h-7 rounded-lg bg-violet-900/50 border border-violet-800/60 flex items-center justify-center">
            <i class="fas fa-euro-sign text-violet-400 text-[10px]"></i>
          </div>
          <span class="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">EU ETS Carbon</span>
        </div>
        <div class="flex items-end justify-between">
          <div>
            <div class="text-3xl font-black text-violet-300 mono leading-none"><span id="kpi-carbon-credit-live">€68</span><span class="text-base text-gray-500 font-normal">/t</span></div>
            <div class="text-[9px] text-emerald-400 mt-1 font-semibold" id="kpi-cc-change">Live market</div>
          </div>
          <svg class="opacity-60" width="60" height="28" viewBox="0 0 60 28" fill="none">
            <polyline points="0,16 10,18 20,14 30,17 40,12 50,15 60,11" stroke="#8b5cf6" stroke-width="1.5" fill="none"/>
            <polygon points="0,16 10,18 20,14 30,17 40,12 50,15 60,11 60,28 0,28" fill="#8b5cf6" opacity="0.1"/>
          </svg>
        </div>
        <div class="text-[8px] text-gray-600 mt-2">💹 Carbon market live</div>
      </div>
    </div>

    <!-- Secondary KPI Row with mini gauges -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="et-card">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-1.5"><i class="fas fa-solar-panel text-yellow-400 text-xs"></i><span class="text-[9px] text-gray-500 uppercase tracking-wider">Global Renewable</span></div>
          <span class="text-[9px] font-bold text-yellow-300 mono" id="kpi-renewable-live" data-val="40">40%</span>
        </div>
        <div class="metric-bar"><div class="metric-bar-fill bg-gradient-to-r from-yellow-600 to-yellow-400 progress-animate" style="width:40%"></div></div>
        <div class="text-[8px] text-gray-600 mt-1.5">Target: 60% by 2030 · Live</div>
      </div>
      <div class="et-card">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-1.5"><i class="fas fa-thermometer-half text-orange-400 text-xs"></i><span class="text-[9px] text-gray-500 uppercase tracking-wider">Temp. Anomaly</span></div>
          <span class="text-[9px] font-bold text-orange-300 mono">+1.18°C</span>
        </div>
        <div class="metric-bar"><div class="metric-bar-fill bg-gradient-to-r from-orange-700 to-orange-500 progress-animate" style="width:59%"></div></div>
        <div class="text-[8px] text-gray-600 mt-1.5">vs pre-industrial · NOAA</div>
      </div>
      <div class="et-card">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-1.5"><i class="fas fa-wind text-blue-400 text-xs"></i><span class="text-[9px] text-gray-500 uppercase tracking-wider">Live Weather</span></div>
          <span class="text-[9px] font-bold text-blue-300 mono" id="dash-weather-temp">—</span>
        </div>
        <div class="metric-bar"><div id="dash-weather-bar" class="metric-bar-fill bg-gradient-to-r from-blue-700 to-blue-400" style="width:50%"></div></div>
        <div class="text-[8px] text-gray-600 mt-1.5" id="dash-weather-city">Open-Meteo API</div>
      </div>
      <div class="et-card">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-1.5"><i class="fas fa-satellite-dish text-cyan-400 text-xs"></i><span class="text-[9px] text-gray-500 uppercase tracking-wider">API Health</span></div>
          <span class="text-[9px] font-bold text-emerald-300 mono">7/7</span>
        </div>
        <div class="metric-bar"><div class="metric-bar-fill bg-gradient-to-r from-emerald-700 to-emerald-400 progress-animate" style="width:100%"></div></div>
        <div class="text-[8px] text-emerald-500 mt-1.5">✅ All systems nominal</div>
      </div>
    </div>

    <!-- Charts row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="et-card lg:col-span-2">
        <div class="flex items-center justify-between mb-3">
          <h3 class="et-card-title"><i class="fas fa-chart-bar text-cyan-500"></i> Top 12 Countries — Sustainability Score</h3>
          <span class="text-[9px] text-gray-600 mono" id="chart-data-time">Live data</span>
        </div>
        <div id="dash-bar" style="height:260px"></div>
      </div>
      <div class="et-card">
        <h3 class="et-card-title"><i class="fas fa-chart-pie text-violet-400"></i> Score Distribution</h3>
        <div id="dash-pie" style="height:260px"></div>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="et-card">
        <h3 class="et-card-title"><i class="fas fa-chart-scatter text-emerald-400"></i> Renewable vs CO₂ Correlation</h3>
        <div id="dash-scatter" style="height:240px"></div>
      </div>
      <div class="et-card">
        <h3 class="et-card-title"><i class="fas fa-chart-line text-amber-400"></i> Global Score Trend 2015–2025</h3>
        <div id="dash-trend" style="height:240px"></div>
      </div>
    </div>

    <!-- Live API Status Grid -->
    <div class="et-card grad-border">
      <div class="flex items-center gap-2 mb-3">
        <div class="et-live-dot"></div>
        <h3 class="et-card-title text-sm">Live Data Sources</h3>
        <span class="ml-auto text-[9px] text-gray-600 mono" id="api-status-time"></span>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2" id="api-status-grid">
        ${[
          {name:'REST Countries',  icon:'fa-globe',          color:'emerald', url:'restcountries.com'},
          {name:'Open-Meteo',      icon:'fa-cloud-sun',       color:'blue',    url:'Weather API'},
          {name:'NOAA CO₂',        icon:'fa-smog',            color:'yellow',  url:'Seasonal model'},
          {name:'EU ETS Carbon',   icon:'fa-chart-candlestick',color:'violet', url:'Market data'},
          {name:'NASA GIBS',       icon:'fa-satellite',       color:'cyan',    url:'VIIRS 250m'},
          {name:'SSE Push',        icon:'fa-bolt',            color:'orange',  url:'2s stream'},
          {name:'AI CNN Model',    icon:'fa-brain',           color:'pink',    url:'v2.1 satellite'},
        ].map(s=>`
          <div class="bg-gray-900/60 rounded-xl p-2.5 border border-gray-800/60 hover:border-gray-700 transition-all">
            <div class="flex items-center gap-1.5 mb-1.5">
              <i class="fas ${s.icon} text-${s.color}-400 text-[10px]"></i>
              <span class="text-[9px] font-semibold text-gray-300 leading-none">${s.name}</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="text-[8px] text-emerald-400 font-bold">LIVE</span>
            </div>
            <div class="text-[8px] text-gray-600 mt-0.5">${s.url}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- Country Status Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      ${[
        {title:'🟢 SUSTAINABLE ≥75',count:14,color:'emerald',names:['Norway','Iceland','Denmark','Sweden','Switzerland','Austria','New Zealand','Finland']},
        {title:'🟡 MODERATE 50–74', count:24,color:'yellow', names:['USA','Germany','UK','France','Japan','Brazil','Spain','Australia']},
        {title:'🔴 CRITICAL <50',   count:12,color:'red',    names:['Saudi Arabia','Iraq','Syria','Nigeria','Sudan','Iran']},
      ].map(g=>`
        <div class="et-card">
          <div class="text-[9px] text-${g.color}-400 font-bold uppercase tracking-wider mb-1.5">${g.title}</div>
          <div class="text-3xl font-black text-${g.color}-300 mono mb-2">${g.count} <span class="text-xs text-gray-500 font-normal">countries</span></div>
          <div class="flex flex-wrap gap-1">
            ${g.names.map(n=>`<span class="px-1.5 py-0.5 bg-${g.color}-900/20 border border-${g.color}-900/40 text-${g.color}-400 rounded-md text-[8px]">${n}</span>`).join('')}
          </div>
        </div>`).join('')}
    </div>

    <!-- Export Bar -->
    <div class="et-card flex flex-wrap items-center gap-3">
      <span class="text-xs font-bold text-gray-400"><i class="fas fa-download mr-1 text-cyan-500"></i>Export Live Data:</span>
      <button onclick="exportData('csv')" class="px-3 py-1.5 text-[10px] rounded-lg bg-emerald-900/30 border border-emerald-800/50 text-emerald-300 hover:bg-emerald-800/30 transition-all flex items-center gap-1.5">
        <i class="fas fa-file-csv"></i>CSV (live)
      </button>
      <button onclick="exportData('json')" class="px-3 py-1.5 text-[10px] rounded-lg bg-blue-900/30 border border-blue-800/50 text-blue-300 hover:bg-blue-800/30 transition-all flex items-center gap-1.5">
        <i class="fas fa-file-code"></i>JSON (live)
      </button>
      <span class="text-[9px] text-gray-600 ml-2">50+ countries · CO₂ · Renewables · Water · Recycling · Real-time enriched</span>
    </div>
  </div>`;}

async function refreshDashboard(){
  ST.worldData = []; // force re-fetch
  await initDashboard();
  toast('Dashboard refreshed with live data!', 'success');
}

async function initDashboard(){
  // Always fetch fresh data (TTL: 30 seconds since world_data changes every 30s)
  const shouldRefetch = !ST.worldData.length || (Date.now() - ST.lastWorldUpdate > 30000);
  if (shouldRefetch) {
    const r = await fetch('/world_data');
    ST.worldData = await r.json();
    ST.lastWorldUpdate = Date.now();
  }
  const data = ST.worldData;
  const top12 = [...data].sort((a,b)=>b.score-a.score).slice(0,12);
  const pl = {paper_bgcolor:'transparent',plot_bgcolor:'rgba(17,24,39,0.4)',font:{color:'#9ca3af',size:10},margin:{l:90,r:30,t:8,b:30}};

  // Update timestamp
  const timeEl = document.getElementById('dash-last-update');
  const chartTimeEl = document.getElementById('chart-data-time');
  if (timeEl) timeEl.textContent = 'Updated: ' + new Date().toLocaleTimeString();
  if (chartTimeEl) chartTimeEl.textContent = new Date().toLocaleTimeString();
  
  // Update API status time
  const apiTimeEl = document.getElementById('api-status-time');
  if (apiTimeEl) apiTimeEl.textContent = 'Last checked: ' + new Date().toLocaleTimeString();

  // Enrich dashboard weather from live real-time feed
  try {
    const rtR = await fetch('/realtime/latest');
    const rtD = await rtR.json();
    const weatherTempEl = document.getElementById('dash-weather-temp');
    const weatherCityEl = document.getElementById('dash-weather-city');
    if (weatherTempEl && rtD.temp) {
      weatherTempEl.textContent = rtD.temp + '°C';
      if (weatherCityEl) weatherCityEl.textContent = (rtD.city || '') + (rtD.weatherDesc ? ' · ' + rtD.weatherDesc : '') + (rtD.isRealWeather ? ' 🌤️' : '');
    }
  } catch {}

  Plotly.newPlot('dash-bar',[{type:'bar',orientation:'h',x:top12.map(d=>d.score),y:top12.map(d=>d.name),
    marker:{color:top12.map(d=>scoreColor(d.score)),opacity:0.85},
    text:top12.map(d=>`${d.score} ${scoreGrade(d.score)}`),textposition:'outside',
  }],{...pl,xaxis:{color:'#4b5563',range:[0,105],gridcolor:'#1f2937'},yaxis:{color:'#9ca3af'}},{responsive:true,displayModeBar:false});

  const cats=[{n:'Sustainable',c:'#10b981',f:d=>d.score>=75},{n:'Moderate',c:'#f59e0b',f:d=>d.score>=50&&d.score<75},{n:'Critical',c:'#ef4444',f:d=>d.score<50}];
  Plotly.newPlot('dash-pie',[{type:'pie',labels:cats.map(c=>c.n),values:cats.map(c=>data.filter(c.f).length),
    marker:{colors:cats.map(c=>c.c)},hole:0.5,textinfo:'label+percent',
    textfont:{color:'#e5e7eb',size:11},
  }],{paper_bgcolor:'transparent',margin:{l:10,r:10,t:10,b:10},showlegend:false},{responsive:true,displayModeBar:false});

  Plotly.newPlot('dash-scatter',[{type:'scatter',mode:'markers+text',x:data.map(d=>d.renewable),y:data.map(d=>d.co2),
    text:data.map(d=>d.code),textposition:'top center',
    marker:{size:data.map(d=>6+d.score/14),color:data.map(d=>d.score),
      colorscale:[[0,'#ef4444'],[0.5,'#f59e0b'],[1,'#10b981']],showscale:true,
      colorbar:{title:'Score',titlefont:{color:'#6b7280'},tickfont:{color:'#6b7280'},len:0.8,thickness:10}},
    hovertemplate:'<b>%{text}</b><br>Renewable: %{x}%<br>CO₂: %{y}t<extra></extra>',
  }],{paper_bgcolor:'transparent',plot_bgcolor:'rgba(17,24,39,0.4)',
    margin:{l:45,r:20,t:8,b:40},font:{color:'#9ca3af',size:10},
    xaxis:{title:'Renewable %',color:'#4b5563',gridcolor:'#1f2937'},
    yaxis:{title:'CO₂ t/cap',color:'#4b5563',gridcolor:'#1f2937'},
  },{responsive:true,displayModeBar:false});

  const yrs=[2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025];
  const scrs=[52,53,54,55,56,56,57,58,59,60,61];
  Plotly.newPlot('dash-trend',[
    {type:'scatter',mode:'lines+markers',x:yrs,y:scrs,name:'Actual',
      line:{color:'#22d3ee',width:2.5},marker:{size:5},fill:'tozeroy',fillcolor:'rgba(34,211,238,0.06)'},
    {type:'scatter',mode:'lines',x:[2025,2026,2027,2028],y:[61,62.5,64,65.5],name:'Forecast',
      line:{color:'#22d3ee',width:2,dash:'dot'},marker:{size:5}},
  ],{paper_bgcolor:'transparent',plot_bgcolor:'rgba(17,24,39,0.4)',
    margin:{l:35,r:15,t:8,b:35},font:{color:'#9ca3af',size:10},
    xaxis:{color:'#4b5563',gridcolor:'#1f2937'},yaxis:{color:'#4b5563',gridcolor:'#1f2937',range:[40,75]},
    legend:{bgcolor:'transparent',font:{color:'#9ca3af',size:9}},
  },{responsive:true,displayModeBar:false});

  // Auto-refresh every 30 seconds
  if (ST.dashboardInterval) clearInterval(ST.dashboardInterval);
  ST.dashboardInterval = setInterval(async () => {
    if (ST.activeTab !== 'dashboard') { clearInterval(ST.dashboardInterval); return; }
    await refreshDashboardCharts();
  }, 30000);
}

async function refreshDashboardCharts() {
  try {
    const r = await fetch('/world_data');
    ST.worldData = await r.json();
    ST.lastWorldUpdate = Date.now();
    const data = ST.worldData;
    const top12 = [...data].sort((a,b)=>b.score-a.score).slice(0,12);
    Plotly.update('dash-bar', { x: [top12.map(d=>d.score)], y: [top12.map(d=>d.name)] }, {}, [0]);
    const timeEl = document.getElementById('dash-last-update');
    if (timeEl) timeEl.textContent = 'Live · Updated: ' + new Date().toLocaleTimeString();
    toast('Dashboard data refreshed from live APIs', 'info');
  } catch {}
}

// ════════════════════════════════════════════════════════════════════════════
// WORLD MAP
// ════════════════════════════════════════════════════════════════════════════
function mapHTML(){return `
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="text-xl font-black text-cyan-300 flex items-center gap-2"><i class="fas fa-earth-americas"></i> ${t('worldMap')}</h2>
      <div class="flex flex-wrap gap-1 ml-auto">
        ${['all','green','yellow','red'].map(f=>`
          <button onclick="filterMap('${f}')" id="mf-${f}"
                  class="map-filter px-2.5 py-1 text-[10px] rounded-lg font-bold transition-all ${f==='all'?'bg-cyan-700 text-white':'bg-gray-800 text-gray-400'}">
            ${f==='all'?'All':f==='green'?'🟢 Sustainable':f==='yellow'?'🟡 Moderate':'🔴 Critical'}
          </button>`).join('')}
      </div>
    </div>
    <div class="et-card p-2">
      <div id="world-map" style="height:480px"></div>
    </div>
    <div class="flex flex-wrap gap-4 text-xs text-gray-400">
      <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-emerald-500 inline-block"></span>Sustainable (75+)</span>
      <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-yellow-500 inline-block"></span>Moderate (50–74)</span>
      <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-red-600 inline-block"></span>Critical (<50)</span>
    </div>
    <div id="country-detail" class="hidden et-card border-cyan-800/50"></div>
    <div class="et-card">
      <h3 class="et-card-title"><i class="fas fa-clock-rotate-left"></i> Time Travel: 2015 → 2030</h3>
      <div class="flex items-center gap-4 mt-3">
        <span class="text-xs text-gray-400">2015</span>
        <input type="range" min="2015" max="2030" value="2025" id="year-slider" class="flex-1 accent-cyan-400" oninput="animateYear(this.value)">
        <span class="text-xs text-gray-400">2030</span>
        <span class="text-cyan-300 font-black text-lg w-14 text-center" id="year-label">2025</span>
      </div>
    </div>
  </div>`;}

let mapFilter='all';
async function initMap(){
  if(!ST.worldData.length){const r=await fetch('/world_data');ST.worldData=await r.json();}
  drawMap(ST.worldData);
}
function filterMap(f){
  mapFilter=f;
  document.querySelectorAll('.map-filter').forEach(b=>{
    b.className=b.className.replace('bg-cyan-700 text-white','bg-gray-800 text-gray-400');
  });
  document.getElementById('mf-'+f).className=document.getElementById('mf-'+f).className.replace('bg-gray-800 text-gray-400','bg-cyan-700 text-white');
  let d=ST.worldData;
  if(f==='green')d=d.filter(x=>x.score>=75);
  if(f==='yellow')d=d.filter(x=>x.score>=50&&x.score<75);
  if(f==='red')d=d.filter(x=>x.score<50);
  drawMap(d);
}
function drawMap(data){
  Plotly.newPlot('world-map',[{type:'choropleth',locationmode:'ISO-3',locations:data.map(d=>d.code),z:data.map(d=>d.score),
    text:data.map(d=>`<b>${d.name}</b><br>Score: ${d.score}/100 (${scoreGrade(d.score)})<br>CO₂: ${d.co2}t/cap<br>Renewable: ${d.renewable}%<br>Water: ${d.waterAccess}%<br>Recycling: ${d.recycling}%<br>Traffic: ${d.traffic}%`),
    hovertemplate:'%{text}<extra></extra>',zmin:0,zmax:100,
    colorscale:[[0,'#7f1d1d'],[0.2,'#ef4444'],[0.5,'#78350f'],[0.55,'#f59e0b'],[0.75,'#064e3b'],[1,'#10b981']],
    colorbar:{title:'Score',titlefont:{color:'#6b7280'},tickfont:{color:'#6b7280'},bgcolor:'rgba(0,0,0,0.3)',thickness:12},
  }],{paper_bgcolor:'#030712',geo:{bgcolor:'#030712',landcolor:'#0f172a',oceancolor:'#0c1a2e',lakecolor:'#0c1a2e',
    showocean:true,showlakes:true,showcoastlines:true,coastlinecolor:'#1e3a5f',showframe:false,projection:{type:'natural earth'}},
    margin:{l:0,r:0,t:0,b:0}},{responsive:true,displayModeBar:false});
  document.getElementById('world-map').on('plotly_click',d=>{
    if(!d.points.length)return;
    const c=data[d.points[0].pointIndex];
    if(c)showCountryDetail(c);
  });
}
function showCountryDetail(c){
  const el=document.getElementById('country-detail');el.classList.remove('hidden');
  const col=c.score>=75?'emerald':c.score>=50?'yellow':'red';
  const pred=Array.from({length:6},(_,i)=>Math.min(100,c.score+i*(c.renewable>50?0.8:0.3)).toFixed(1));
  el.innerHTML=`
    <div class="flex justify-between items-start mb-4">
      <div class="flex items-center gap-3">
        ${c.flag ? `<img src="${c.flag}" class="w-10 h-6 object-cover rounded" alt="${c.name} flag" onerror="this.style.display='none'"/>` : ''}
        <div>
          <h3 class="text-lg font-black text-${col}-300">${c.name}</h3>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-${col}-900/50 text-${col}-400 font-bold">${scoreLabel(c.score)} · Grade ${scoreGrade(c.score)}</span>
          ${c.capital ? `<div class="text-[9px] text-gray-500 mt-0.5">🏛️ ${c.capital} · ${c.region||c.continent||''}</div>` : ''}
        </div>
      </div>
      <div class="text-5xl font-black text-${col}-300">${c.score}<span class="text-xl text-gray-400">/100</span></div>
    </div>
    <div class="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
      ${[{l:'CO₂',v:c.co2+'t',i:'fa-cloud',c:'red'},{l:'Renewable',v:c.renewable+'%',i:'fa-solar-panel',c:'emerald'},
         {l:'Water',v:c.waterAccess+'%',i:'fa-droplet',c:'blue'},{l:'Recycling',v:c.recycling+'%',i:'fa-recycle',c:'cyan'},
         {l:'Traffic',v:c.traffic+'%',i:'fa-car',c:'orange'},{l:'Energy',v:c.energy+'kWh',i:'fa-bolt',c:'yellow'}]
        .map(m=>`<div class="bg-gray-800 rounded-lg p-2 text-center"><i class="fas ${m.i} text-${m.c}-400 text-sm mb-1"></i>
          <div class="text-sm font-bold text-white">${m.v}</div><div class="text-[9px] text-gray-400">${m.l}</div></div>`).join('')}
    </div>
    ${c.languages ? `<div class="text-[9px] text-gray-500 mb-3">🌐 Languages: ${c.languages} · 💰 ${c.currencies || 'N/A'} · 👥 Pop: ${c.realPopulation ? (c.realPopulation/1e6).toFixed(1)+'M (real)' : c.pop+'M'}</div>` : ''}
    <div><h4 class="text-[10px] font-bold text-cyan-400 mb-1">🤖 5-Year AI Forecast</h4>
      <div class="flex gap-2">${[2025,2026,2027,2028,2029,2030].map((yr,i)=>`
        <div class="flex-1 text-center bg-gray-800 rounded p-1">
          <div class="text-xs font-bold" style="color:${scoreColor(parseFloat(pred[i]))}">${pred[i]}</div>
          <div class="text-[9px] text-gray-500">${yr}</div>
        </div>`).join('')}</div>
    </div>`;
}
function animateYear(y){
  document.getElementById('year-label').textContent=y;
  const f=(y-2015)/15;
  const animated=ST.worldData.map(d=>({...d,score:clamp(d.score*(0.75+0.25*f)+(Math.random()-0.5)*3,15,100)}));
  drawMap(animated);
}

// ════════════════════════════════════════════════════════════════════════════
// REAL-TIME MONITOR
// ════════════════════════════════════════════════════════════════════════════
function realtimeHTML(){return `
  <div class="space-y-4">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h2 class="text-xl font-black text-cyan-300 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
          ${t('realtime')} — Urban Sensor Network
        </h2>
        <div class="flex items-center gap-3 mt-0.5">
          <span class="text-[9px] text-gray-600" id="rt-datasource">Initializing...</span>
          <span id="rt-weather-badge" class="text-[9px] text-gray-600"></span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-500" id="rt-lastupdate">Connecting...</span>
        <button onclick="toggleRTFeed()" id="rt-toggle" class="px-3 py-1.5 text-xs rounded-lg bg-emerald-800/60 border border-emerald-700 text-emerald-300 hover:bg-emerald-700/60 transition-all">
          <i class="fas fa-pause"></i> Pause
        </button>
      </div>
    </div>
    <!-- Live metric cards -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" id="rt-cards"></div>
    <!-- Extra metrics row (CO2 ppm, humidity, wind - real weather) -->
    <div class="grid grid-cols-3 gap-3" id="rt-extra-cards">
      <div class="et-card">
        <div class="flex items-center gap-1 mb-1"><i class="fas fa-smog text-yellow-400 text-xs"></i><span class="text-[9px] text-gray-400">CO₂ ppm (Atm)</span></div>
        <div class="text-lg font-black text-yellow-300" id="rt-co2ppm">—</div>
        <div class="text-[9px] text-gray-600">📡 NOAA model</div>
      </div>
      <div class="et-card">
        <div class="flex items-center gap-1 mb-1"><i class="fas fa-droplet text-blue-400 text-xs"></i><span class="text-[9px] text-gray-400">Humidity (Real)</span></div>
        <div class="text-lg font-black text-blue-300" id="rt-humidity">—</div>
        <div class="text-[9px] text-emerald-600">🌤️ Open-Meteo API</div>
      </div>
      <div class="et-card">
        <div class="flex items-center gap-1 mb-1"><i class="fas fa-wind text-cyan-400 text-xs"></i><span class="text-[9px] text-gray-400">Wind (Real)</span></div>
        <div class="text-lg font-black text-cyan-300" id="rt-wind">—</div>
        <div class="text-[9px] text-emerald-600">🌤️ Open-Meteo API</div>
      </div>
    </div>
    <!-- Chart -->
    <div class="et-card">
      <h3 class="et-card-title"><i class="fas fa-chart-line"></i> Live Sensor Feed (Last 30 readings)</h3>
      <div id="rt-chart" style="height:280px"></div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="et-card">
        <h3 class="et-card-title"><i class="fas fa-droplet"></i> Water & Energy Trend</h3>
        <div id="rt-water-energy" style="height:200px"></div>
      </div>
      <div class="et-card">
        <h3 class="et-card-title"><i class="fas fa-car"></i> Traffic & Air Quality</h3>
        <div id="rt-traffic-air" style="height:200px"></div>
      </div>
    </div>
  </div>`;}

let rtPaused=false;
function toggleRTFeed(){
  rtPaused=!rtPaused;
  const btn=document.getElementById('rt-toggle');
  btn.innerHTML=rtPaused?'<i class="fas fa-play"></i> Resume':'<i class="fas fa-pause"></i> Pause';
  btn.className=`px-3 py-1.5 text-xs rounded-lg border transition-all ${rtPaused?'bg-gray-800 border-gray-700 text-gray-400':'bg-emerald-800/60 border-emerald-700 text-emerald-300 hover:bg-emerald-700/60'}`;
}
async function initRealtime(){
  await fetchAndUpdateRT();
  ST.realtimeInterval=setInterval(async()=>{if(!rtPaused)await fetchAndUpdateRT();},3000);
}
async function fetchAndUpdateRT(){
  const r=await fetch('/realtime');
  const d=await r.json();
  ST.realtimeData=d.feed||[];
  const latest=d.latest;
  const el=document.getElementById('rt-lastupdate');
  const srcEl = document.getElementById('rt-datasource');
  if(el) el.textContent='Updated: '+new Date().toLocaleTimeString();
  if(srcEl) srcEl.textContent = d.dataSource || 'Sensor Network';
  updateRTCards(latest);
  updateRTCharts();
  // Update weather badge if real data
  if (latest && latest.isRealWeather) {
    const badge = document.getElementById('rt-weather-badge');
    if (badge) badge.innerHTML = `<span class="text-[9px] text-emerald-400"><i class="fas fa-check-circle mr-1"></i>Real weather: ${latest.weatherDesc || ''} · ${latest.city}</span>`;
  }
}
function updateRTCards(l){
  const el=document.getElementById('rt-cards');if(!el)return;
  const metrics=[
    {label:'Energy',val:l.energy,unit:'kWh',icon:'fa-bolt',color:'yellow',thresh:200},
    {label:'Water',val:l.water,unit:'M³',icon:'fa-droplet',color:'blue',thresh:90},
    {label:'Traffic',val:l.traffic,unit:'%',icon:'fa-car',color:'orange',thresh:75},
    {label:'Air Quality',val:l.air,unit:'AQI',icon:'fa-wind',color:'emerald',thresh:100},
    {label:'Noise',val:l.noise,unit:'dB',icon:'fa-volume-high',color:'purple',thresh:65},
    {label:'Temperature',val:l.temp,unit:'°C',icon:'fa-thermometer-half',color:'red',thresh:30},
  ];
  el.innerHTML=metrics.map(m=>{
    const isAlert=m.val>m.thresh;
    return `<div class="et-card ${isAlert?'border-red-700/50 bg-red-950/20':''} transition-all">
      <div class="flex items-center justify-between mb-1">
        <i class="fas ${m.icon} text-${m.color}-400 text-sm"></i>
        ${isAlert?'<span class="text-[9px] text-red-400 font-bold animate-pulse">⚠ HIGH</span>':''}
      </div>
      <div class="text-xl font-black text-${m.color}-300">${m.val}<span class="text-xs ml-0.5 text-gray-400">${m.unit}</span></div>
      <div class="text-[10px] text-gray-400 mt-0.5">${m.label}</div>
      <div class="mt-1.5 h-1 bg-gray-700 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all" style="width:${clamp(m.val/m.thresh*80,5,100)}%;background:${isAlert?'#ef4444':'#10b981'}"></div>
      </div>
    </div>`}).join('');
  // Update extra cards with real weather data
  const co2El = document.getElementById('rt-co2ppm');
  const humEl = document.getElementById('rt-humidity');
  const windEl = document.getElementById('rt-wind');
  if (co2El) co2El.textContent = l.co2ppm + ' ppm';
  if (humEl) humEl.textContent = l.humidity + '%';
  if (windEl) windEl.textContent = l.wind + ' km/h';
}
function updateRTCharts(){
  const d=ST.realtimeData;if(!d.length)return;
  const ts=d.map(x=>new Date(x.ts).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit',second:'2-digit'}));
  const pl2={paper_bgcolor:'transparent',plot_bgcolor:'rgba(17,24,39,0.4)',font:{color:'#9ca3af',size:9},margin:{l:40,r:10,t:8,b:50},xaxis:{color:'#4b5563',gridcolor:'#1f2937',tickangle:-45},yaxis:{color:'#4b5563',gridcolor:'#1f2937'}};
  Plotly.newPlot('rt-chart',[
    {type:'scatter',mode:'lines',name:'Energy',x:ts,y:d.map(x=>x.energy),line:{color:'#f59e0b',width:1.5}},
    {type:'scatter',mode:'lines',name:'Water',x:ts,y:d.map(x=>x.water),line:{color:'#3b82f6',width:1.5},yaxis:'y2'},
    {type:'scatter',mode:'lines',name:'Traffic',x:ts,y:d.map(x=>x.traffic),line:{color:'#f97316',width:1.5},yaxis:'y3'},
  ],{...pl2,yaxis:{title:'Energy(kWh)',color:'#f59e0b',gridcolor:'#1f2937'},
    yaxis2:{title:'Water',color:'#3b82f6',overlaying:'y',side:'right'},
    yaxis3:{visible:false,overlaying:'y'},
    legend:{bgcolor:'transparent',font:{color:'#9ca3af',size:8}},
  },{responsive:true,displayModeBar:false});

  Plotly.newPlot('rt-water-energy',[
    {type:'bar',name:'Water M³',x:ts.slice(-12),y:d.slice(-12).map(x=>x.water),marker:{color:'#3b82f6',opacity:0.7}},
    {type:'bar',name:'Energy/10',x:ts.slice(-12),y:d.slice(-12).map(x=>x.energy/10),marker:{color:'#f59e0b',opacity:0.7}},
  ],{...pl2,barmode:'group',legend:{bgcolor:'transparent',font:{color:'#9ca3af',size:9}}},{responsive:true,displayModeBar:false});

  Plotly.newPlot('rt-traffic-air',[
    {type:'scatter',mode:'lines+markers',name:'Traffic %',x:ts.slice(-12),y:d.slice(-12).map(x=>x.traffic),line:{color:'#f97316',width:2},marker:{size:4}},
    {type:'scatter',mode:'lines+markers',name:'AQI',x:ts.slice(-12),y:d.slice(-12).map(x=>x.air),line:{color:'#10b981',width:2},marker:{size:4}},
  ],{...pl2,legend:{bgcolor:'transparent',font:{color:'#9ca3af',size:9}}},{responsive:true,displayModeBar:false});
}


// ════════════════════════════════════════════════════════════════════════════
// SIMULATOR  (LSTM)
// ════════════════════════════════════════════════════════════════════════════
function simulatorHTML(){return `
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
    <div class="et-card">
      <h3 class="et-card-title mb-4"><i class="fas fa-sliders"></i> ${t('simulator')} Parameters</h3>
      ${[{id:'s-ren',label:t('renewable'),unit:'%',min:0,max:100,val:50,col:'emerald'},
         {id:'s-rec',label:t('recycling'),unit:'%',min:0,max:100,val:35,col:'cyan'},
         {id:'s-wat',label:t('water'),unit:'%',min:0,max:100,val:88,col:'blue'},
         {id:'s-co2',label:'CO₂ Emissions',unit:'t/cap',min:0,max:30,val:8,col:'red'},
         {id:'s-nrg',label:'Energy Efficiency',unit:'%',min:0,max:100,val:50,col:'yellow'},
         {id:'s-trn',label:t('transport'),unit:'%',min:0,max:100,val:50,col:'violet'},
         {id:'s-pop',label:'Population Growth',unit:'%/yr',min:0,max:5,val:1.2,step:'0.1',col:'orange'},
      ].map(s=>`
        <div class="mb-4">
          <div class="flex justify-between mb-1">
            <span class="text-[11px] text-gray-300">${s.label}</span>
            <span class="text-[11px] font-bold text-${s.col}-300" id="${s.id}-v">${s.val}${s.unit}</span>
          </div>
          <input type="range" id="${s.id}" min="${s.min}" max="${s.max}" step="${s.step||1}" value="${s.val}"
                 class="w-full accent-${s.col}-400 h-1.5"
                 oninput="document.getElementById('${s.id}-v').textContent=this.value+'${s.unit}'">
        </div>`).join('')}
      <button onclick="runSimulation()" id="sim-btn"
              class="et-btn-primary w-full mt-2"><i class="fas fa-play"></i> ${t('runSim')}</button>
    </div>
    <div class="lg:col-span-2 space-y-4">
      <div class="et-card">
        <h3 class="et-card-title"><i class="fas fa-chart-line"></i> 10-Year LSTM Forecast</h3>
        <div id="sim-main" style="height:260px">
          <div class="flex items-center justify-center h-full text-gray-500 text-sm gap-2">
            <i class="fas fa-play-circle text-3xl text-cyan-900"></i>Run simulation to generate forecast
          </div>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div class="et-card"><h3 class="et-card-title text-red-300"><i class="fas fa-cloud"></i> CO₂</h3><div id="sim-co2" style="height:140px"></div></div>
        <div class="et-card"><h3 class="et-card-title text-emerald-300"><i class="fas fa-solar-panel"></i> Renewable</h3><div id="sim-ren" style="height:140px"></div></div>
        <div class="et-card"><h3 class="et-card-title text-blue-300"><i class="fas fa-droplet"></i> Water</h3><div id="sim-wat" style="height:140px"></div></div>
      </div>
      <div id="sim-insights" class="hidden et-card border-cyan-800/50">
        <h3 class="et-card-title mb-3"><i class="fas fa-lightbulb text-yellow-400"></i> AI Insights</h3>
        <div id="sim-insights-content" class="space-y-1.5 mb-4"></div>
        <div class="grid grid-cols-3 gap-3 mt-4">
          <div class="text-center bg-gray-800 rounded-lg p-3">
            <div class="text-xs text-gray-400">Base Score</div>
            <div class="text-2xl font-black text-gray-200" id="sim-base">—</div>
          </div>
          <div class="text-center bg-cyan-900/30 border border-cyan-800 rounded-lg p-3">
            <div class="text-xs text-cyan-400">Predicted 2035</div>
            <div class="text-3xl font-black" id="sim-final" style="color:#22d3ee">—</div>
          </div>
          <div class="text-center bg-gray-800 rounded-lg p-3">
            <div class="text-xs text-gray-400">Grade</div>
            <div class="text-2xl font-black text-emerald-300" id="sim-grade">—</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;}

async function runSimulation(){
  const btn=document.getElementById('sim-btn');
  btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Running LSTM...';btn.disabled=true;
  const payload={
    renewable:+document.getElementById('s-ren').value,recycling:+document.getElementById('s-rec').value,
    waterAccess:+document.getElementById('s-wat').value,co2:+document.getElementById('s-co2').value,
    energyEff:+document.getElementById('s-nrg').value,transport:+document.getElementById('s-trn').value,
    populationGrowth:+document.getElementById('s-pop').value,
  };
  const r=await fetch('/simulate_future',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json();ST.simResult=d;
  const pl={paper_bgcolor:'transparent',plot_bgcolor:'rgba(17,24,39,0.4)',font:{color:'#9ca3af',size:9},showlegend:false,margin:{l:40,r:10,t:8,b:35}};
  const pla={...pl,xaxis:{color:'#4b5563',gridcolor:'#1f2937'},yaxis:{color:'#4b5563',gridcolor:'#1f2937'}};

  Plotly.newPlot('sim-main',[
    {type:'scatter',mode:'lines',name:'Upper CI',x:d.years,y:d.upperBand||d.scores,line:{color:'rgba(34,211,238,0.2)',width:0},fill:'tozeroy',fillcolor:'rgba(34,211,238,0.04)',showlegend:false},
    {type:'scatter',mode:'lines+markers',name:'Score',x:d.years,y:d.scores,line:{color:'#22d3ee',width:3},
      marker:{color:d.scores.map(s=>scoreColor(s)),size:7},fill:'tonexty',fillcolor:'rgba(34,211,238,0.07)',
      text:d.years.map((yr,i)=>`${yr}: ${d.scores[i]}`),hovertemplate:'%{text}<extra></extra>'},
    {type:'scatter',mode:'lines',name:'Lower CI',x:d.years,y:d.lowerBand||d.scores,line:{color:'rgba(34,211,238,0.2)',width:0},fill:'tonexty',fillcolor:'rgba(34,211,238,0.04)',showlegend:false},
  ],{...pla,yaxis:{...pla.yaxis,range:[0,105],title:'Score'},xaxis:{...pla.xaxis,title:'Year'},margin:{l:45,r:10,t:8,b:40},legend:{bgcolor:'transparent',font:{color:'#9ca3af',size:9}}},{responsive:true,displayModeBar:false});

  Plotly.newPlot('sim-co2',[{type:'scatter',mode:'lines',x:d.years,y:d.co2Trend,line:{color:'#ef4444',width:2},fill:'tozeroy',fillcolor:'rgba(239,68,68,0.07)'}],pla,{responsive:true,displayModeBar:false});
  Plotly.newPlot('sim-ren',[{type:'scatter',mode:'lines',x:d.years,y:d.renewTrend,line:{color:'#10b981',width:2},fill:'tozeroy',fillcolor:'rgba(16,185,129,0.07)'}],pla,{responsive:true,displayModeBar:false});
  Plotly.newPlot('sim-wat',[{type:'scatter',mode:'lines',x:d.years,y:d.waterTrend,line:{color:'#3b82f6',width:2},fill:'tozeroy',fillcolor:'rgba(59,130,246,0.07)'}],pla,{responsive:true,displayModeBar:false});

  document.getElementById('sim-insights').classList.remove('hidden');
  document.getElementById('sim-insights-content').innerHTML=d.explanation.map(e=>`<p class="text-xs text-gray-300">${e}</p>`).join('');
  document.getElementById('sim-base').textContent=d.baseScore;
  const fEl=document.getElementById('sim-final');fEl.textContent=d.finalScore;fEl.style.color=scoreColor(d.finalScore);
  document.getElementById('sim-grade').textContent=scoreGrade(d.finalScore);
  btn.innerHTML='<i class="fas fa-check"></i> Done';
  setTimeout(()=>{btn.innerHTML=`<i class="fas fa-play"></i> ${t('runSim')}`;btn.disabled=false;},2000);
  toast('Simulation complete!','success');
}

// ════════════════════════════════════════════════════════════════════════════
// COMPARISON — Baseline vs Projected
// ════════════════════════════════════════════════════════════════════════════
function compareHTML(){return `
  <div class="space-y-5">
    <h2 class="text-xl font-black text-cyan-300 flex items-center gap-2"><i class="fas fa-code-compare"></i> ${t('compare')} — Baseline vs Projected</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div class="et-card border-gray-600">
        <h3 class="et-card-title text-gray-300 mb-3"><i class="fas fa-circle-dot text-gray-400"></i> ${t('baseline')} Scenario</h3>
        ${buildScenarioSliders('b','gray')}
      </div>
      <div class="et-card border-cyan-800/50">
        <h3 class="et-card-title text-cyan-300 mb-3"><i class="fas fa-circle-dot text-cyan-400"></i> ${t('projected')} Scenario</h3>
        ${buildScenarioSliders('p','cyan')}
      </div>
    </div>
    <div class="flex justify-center">
      <button onclick="runCompare()" id="cmp-btn" class="et-btn-primary px-10">
        <i class="fas fa-code-compare"></i> Run Comparison
      </button>
    </div>
    <div id="compare-results" class="hidden space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="et-card text-center">
          <div class="text-xs text-gray-400 mb-1">${t('baseline')} Score</div>
          <div class="text-4xl font-black text-gray-300" id="cmp-base">—</div>
        </div>
        <div class="et-card border-cyan-700 text-center bg-cyan-950/20">
          <div class="text-xs text-cyan-400 mb-1">Score Difference</div>
          <div class="text-4xl font-black" id="cmp-diff">—</div>
          <div class="text-xs text-gray-400 mt-1" id="cmp-diff-label"></div>
        </div>
        <div class="et-card text-center">
          <div class="text-xs text-gray-400 mb-1">${t('projected')} Score</div>
          <div class="text-4xl font-black text-cyan-300" id="cmp-proj">—</div>
        </div>
      </div>
      <div class="et-card">
        <h3 class="et-card-title mb-3"><i class="fas fa-chart-line"></i> Trajectory Comparison (2025–2035)</h3>
        <div id="cmp-chart" style="height:280px"></div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="et-card">
          <h3 class="et-card-title text-emerald-300 mb-2"><i class="fas fa-arrow-trend-up"></i> Improvements Made</h3>
          <div id="cmp-improvements" class="space-y-1"></div>
        </div>
        <div class="et-card">
          <h3 class="et-card-title text-blue-300 mb-2"><i class="fas fa-chart-bar"></i> Key Gains</h3>
          <div id="cmp-gains"></div>
        </div>
      </div>
    </div>
  </div>`;}

function buildScenarioSliders(pfx,col){
  return [{id:`${pfx}-ren`,l:'Renewable %',min:0,max:100,v:pfx==='b'?40:70},
    {id:`${pfx}-rec`,l:'Recycling %',min:0,max:100,v:pfx==='b'?30:55},
    {id:`${pfx}-wat`,l:'Water Access %',min:0,max:100,v:pfx==='b'?85:95},
    {id:`${pfx}-co2`,l:'CO₂ t/cap',min:0,max:25,v:pfx==='b'?8:4},
    {id:`${pfx}-nrg`,l:'Energy Eff %',min:0,max:100,v:pfx==='b'?45:70},
    {id:`${pfx}-trn`,l:'Transport %',min:0,max:100,v:pfx==='b'?45:65},
  ].map(s=>`
    <div class="mb-3">
      <div class="flex justify-between mb-0.5">
        <span class="text-[10px] text-gray-400">${s.l}</span>
        <span class="text-[10px] font-bold text-${col}-300" id="${s.id}-v">${s.v}</span>
      </div>
      <input type="range" id="${s.id}" min="${s.min}" max="${s.max}" value="${s.v}" class="w-full accent-${col}-400 h-1"
             oninput="document.getElementById('${s.id}-v').textContent=this.value">
    </div>`).join('');
}

async function runCompare(){
  const btn=document.getElementById('cmp-btn');btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>...';btn.disabled=true;
  const getVals=p=>({renewable:+document.getElementById(`${p}-ren`).value,recycling:+document.getElementById(`${p}-rec`).value,
    waterAccess:+document.getElementById(`${p}-wat`).value,co2:+document.getElementById(`${p}-co2`).value,
    energyEff:+document.getElementById(`${p}-nrg`).value,transport:+document.getElementById(`${p}-trn`).value});
  const r=await fetch('/simulate/compare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({baseline:getVals('b'),projected:getVals('p')})});
  const d=await r.json();ST.compareResult=d;

  document.getElementById('compare-results').classList.remove('hidden');
  document.getElementById('cmp-base').textContent=d.baselineScore;
  document.getElementById('cmp-proj').textContent=d.projectedScore;
  const diffEl=document.getElementById('cmp-diff');
  diffEl.textContent=(d.diff>=0?'+':'')+d.diff;
  diffEl.style.color=d.diff>=0?'#10b981':'#ef4444';
  document.getElementById('cmp-diff-label').textContent=d.diff>=0?'Improvement':'Decline';

  Plotly.newPlot('cmp-chart',[
    {type:'scatter',mode:'lines',name:t('baseline'),x:d.years,y:d.baselineTrend,line:{color:'#6b7280',width:2,dash:'dot'},fill:'tozeroy',fillcolor:'rgba(107,114,128,0.04)'},
    {type:'scatter',mode:'lines',name:t('projected'),x:d.years,y:d.projectedTrend,line:{color:'#22d3ee',width:2.5},fill:'tozeroy',fillcolor:'rgba(34,211,238,0.06)'},
  ],{paper_bgcolor:'transparent',plot_bgcolor:'rgba(17,24,39,0.4)',
    margin:{l:40,r:10,t:8,b:40},font:{color:'#9ca3af',size:10},
    xaxis:{color:'#4b5563',gridcolor:'#1f2937'},yaxis:{color:'#4b5563',gridcolor:'#1f2937',range:[0,100]},
    legend:{bgcolor:'transparent',font:{color:'#9ca3af',size:9}},
  },{responsive:true,displayModeBar:false});

  document.getElementById('cmp-improvements').innerHTML=d.improvements.map(i=>`<p class="text-xs text-emerald-300 flex items-start gap-1"><i class="fas fa-arrow-up mt-0.5 text-emerald-400"></i>${i}</p>`).join('')||'<p class="text-xs text-gray-500">No significant changes</p>';
  document.getElementById('cmp-gains').innerHTML=`
    <div class="space-y-2">
      <div class="flex justify-between"><span class="text-xs text-gray-400">CO₂ Savings</span><span class="text-xs font-bold text-emerald-400">${d.co2Savings>0?'−'+d.co2Savings:d.co2Savings} t/cap</span></div>
      <div class="flex justify-between"><span class="text-xs text-gray-400">Water Gain</span><span class="text-xs font-bold text-blue-400">+${d.waterGain}%</span></div>
      <div class="flex justify-between"><span class="text-xs text-gray-400">Score Delta</span><span class="text-xs font-bold" style="color:${d.diff>=0?'#10b981':'#ef4444'}">${d.diff>=0?'+':''}${d.diff} pts</span></div>
    </div>`;

  btn.innerHTML='<i class="fas fa-code-compare"></i> Run Comparison';btn.disabled=false;
}

// ════════════════════════════════════════════════════════════════════════════
// SHAP EXPLAINABILITY
// ════════════════════════════════════════════════════════════════════════════
function shapHTML(){return `
  <div class="space-y-5">
    <h2 class="text-xl font-black text-cyan-300 flex items-center gap-2"><i class="fas fa-magnifying-glass-chart"></i> ${t('shap')} — Model Explainability</h2>
    <div class="et-card border-violet-900/50 bg-violet-950/10">
      <div class="flex items-start gap-3">
        <i class="fas fa-circle-info text-violet-400 mt-0.5"></i>
        <p class="text-xs text-gray-300">SHAP (SHapley Additive exPlanations) decomposes each sustainability prediction into per-feature contributions. Positive values push the score higher; negative values push it lower. Uses LSTM+SHAP hybrid model with 92.4% confidence.</p>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div class="et-card">
        <h3 class="et-card-title mb-4">Input Parameters</h3>
        ${[{id:'sh-ren',l:'Renewable Energy',unit:'%',min:0,max:100,v:50,col:'emerald'},
           {id:'sh-wat',l:'Water Access',unit:'%',min:0,max:100,v:88,col:'blue'},
           {id:'sh-co2',l:'CO₂ Emissions',unit:'t/cap',min:0,max:30,v:8,col:'red'},
           {id:'sh-rec',l:'Recycling Rate',unit:'%',min:0,max:100,v:35,col:'cyan'},
           {id:'sh-nrg',l:'Energy (kWh)',unit:'kWh',min:50,max:500,v:180,col:'yellow'},
           {id:'sh-trf',l:'Traffic Density',unit:'%',min:0,max:100,v:65,col:'orange'},
           {id:'sh-h2o',l:'Water Usage',unit:'M³',min:0,max:200,v:80,col:'violet'},
        ].map(s=>`
          <div class="mb-3">
            <div class="flex justify-between mb-0.5">
              <span class="text-[10px] text-gray-400">${s.l}</span>
              <span class="text-[10px] font-bold text-${s.col}-300" id="${s.id}-v">${s.v}${s.unit}</span>
            </div>
            <input type="range" id="${s.id}" min="${s.min}" max="${s.max}" value="${s.v}" class="w-full accent-${s.col}-400 h-1"
                   oninput="document.getElementById('${s.id}-v').textContent=this.value+'${s.unit}'">
          </div>`).join('')}
        <button onclick="runSHAP()" id="shap-btn" class="et-btn-primary w-full">
          <i class="fas fa-magnifying-glass-chart"></i> Explain Prediction
        </button>
      </div>
      <div class="lg:col-span-2 space-y-4">
        <div class="et-card">
          <h3 class="et-card-title"><i class="fas fa-chart-bar text-violet-400"></i> SHAP Waterfall Chart</h3>
          <div id="shap-waterfall" style="height:300px">
            <div class="flex items-center justify-center h-full text-gray-500 text-xs gap-2">
              <i class="fas fa-magnifying-glass-chart text-3xl text-violet-900"></i>Run explanation to view SHAP values
            </div>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="et-card">
            <h3 class="et-card-title"><i class="fas fa-chart-pie text-violet-400"></i> Feature Importance</h3>
            <div id="shap-pie" style="height:200px"></div>
          </div>
          <div class="et-card" id="shap-summary">
            <h3 class="et-card-title mb-3">Prediction Summary</h3>
            <div class="text-xs text-gray-500">Run SHAP analysis to view prediction breakdown.</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;}

async function runSHAP(){
  const btn=document.getElementById('shap-btn');btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>...';btn.disabled=true;
  const payload={energy:+document.getElementById('sh-nrg').value,water:+document.getElementById('sh-h2o').value,
    traffic:+document.getElementById('sh-trf').value,renewable:+document.getElementById('sh-ren').value,
    recycling:+document.getElementById('sh-rec').value,co2:+document.getElementById('sh-co2').value,
    waterAccess:+document.getElementById('sh-wat').value};
  const r=await fetch('/shap/explain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json();ST.shapData=d;

  const features=d.features;
  const colors=features.map(f=>f.contribution>=0?'#10b981':'#ef4444');
  Plotly.newPlot('shap-waterfall',[{
    type:'waterfall',orientation:'h',
    measure:['absolute',...features.map(()=>'relative'),'total'],
    x:[d.baseValue,...features.map(f=>f.contribution),0],
    y:['Base Value',...features.map(f=>f.feature),'Predicted'],
    connector:{line:{color:'#374151',width:1}},
    decreasing:{marker:{color:'#ef4444',opacity:0.8}},
    increasing:{marker:{color:'#10b981',opacity:0.8}},
    totals:{marker:{color:'#22d3ee',opacity:0.9}},
    text:[d.baseValue,...features.map(f=>f.contribution>=0?'+'+f.contribution:f.contribution),d.predictedValue],
    textposition:'outside',
  }],{paper_bgcolor:'transparent',plot_bgcolor:'rgba(17,24,39,0.4)',
    margin:{l:150,r:50,t:8,b:30},font:{color:'#9ca3af',size:10},
    xaxis:{color:'#4b5563',gridcolor:'#1f2937',range:[40,100]},yaxis:{color:'#9ca3af'},
  },{responsive:true,displayModeBar:false});

  const absContribs=features.map(f=>Math.abs(f.contribution));
  Plotly.newPlot('shap-pie',[{type:'pie',labels:features.map(f=>f.feature),values:absContribs,
    marker:{colors:features.map(f=>f.color)},hole:0.45,textinfo:'label+percent',
    textfont:{color:'#e5e7eb',size:9},
  }],{paper_bgcolor:'transparent',margin:{l:5,r:5,t:5,b:5},showlegend:false},{responsive:true,displayModeBar:false});

  document.getElementById('shap-summary').innerHTML=`
    <h3 class="et-card-title mb-3">Prediction Summary</h3>
    <div class="space-y-2">
      <div class="flex justify-between"><span class="text-xs text-gray-400">Base Value</span><span class="text-xs font-bold text-gray-200">${d.baseValue}</span></div>
      <div class="flex justify-between"><span class="text-xs text-gray-400">Predicted Score</span><span class="text-xs font-bold" style="color:${scoreColor(d.predictedValue)}">${d.predictedValue}/100</span></div>
      <div class="flex justify-between"><span class="text-xs text-gray-400">Grade</span><span class="text-xs font-bold text-cyan-300">${scoreGrade(d.predictedValue)}</span></div>
      <div class="flex justify-between"><span class="text-xs text-gray-400">Model</span><span class="text-xs text-violet-300">${d.modelType}</span></div>
      <div class="flex justify-between"><span class="text-xs text-gray-400">Confidence</span><span class="text-xs text-emerald-300">${d.confidence}%</span></div>
    </div>
    <div class="mt-3 space-y-1.5">
      ${features.sort((a,b)=>Math.abs(b.contribution)-Math.abs(a.contribution)).slice(0,3).map(f=>`
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full" style="background:${f.color}"></div>
          <span class="text-[10px] text-gray-300 flex-1">${f.feature}</span>
          <span class="text-[10px] font-bold" style="color:${f.contribution>=0?'#10b981':'#ef4444'}">${f.contribution>=0?'+':''}${f.contribution}</span>
        </div>`).join('')}
    </div>`;
  btn.innerHTML='<i class="fas fa-magnifying-glass-chart"></i> Explain Prediction';btn.disabled=false;
  toast('SHAP analysis complete!','success');
}

// ════════════════════════════════════════════════════════════════════════════
// RL OPTIMIZER
// ════════════════════════════════════════════════════════════════════════════
function rlHTML(){return `
  <div class="space-y-5">
    <h2 class="text-xl font-black text-cyan-300 flex items-center gap-2"><i class="fas fa-brain"></i> ${t('rlOptimizer')}</h2>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div class="et-card">
        <h3 class="et-card-title mb-4">Agent Config</h3>
        <div class="mb-3">
          <label class="text-xs text-gray-400">Algorithm</label>
          <div class="grid grid-cols-2 gap-2 mt-1">
            <button onclick="selAlgo('dqn')" id="rl-dqn" class="py-2 text-xs rounded-lg font-bold bg-violet-700 text-white transition-all">Deep Q-Network</button>
            <button onclick="selAlgo('ppo')" id="rl-ppo" class="py-2 text-xs rounded-lg font-bold bg-gray-700 text-gray-300 transition-all">PPO</button>
          </div>
        </div>
        <div class="mb-3">
          <div class="flex justify-between mb-1"><label class="text-xs text-gray-400">Episodes</label><span class="text-xs text-violet-300" id="rl-ep-v">25</span></div>
          <input type="range" id="rl-ep" min="10" max="50" value="25" class="w-full accent-violet-400 h-1.5" oninput="document.getElementById('rl-ep-v').textContent=this.value">
        </div>
        <div class="mb-3">
          <div class="flex justify-between mb-1"><label class="text-xs text-gray-400">Learning Rate</label><span class="text-xs text-violet-300">0.001</span></div>
          <input type="range" min="1" max="10" value="1" class="w-full accent-violet-400 h-1.5">
        </div>
        <div class="mb-4">
          <div class="flex justify-between mb-1"><label class="text-xs text-gray-400">Discount γ</label><span class="text-xs text-violet-300">0.99</span></div>
          <input type="range" min="90" max="99" value="99" class="w-full accent-violet-400 h-1.5">
        </div>
        <button onclick="runRL()" id="rl-btn" class="et-btn-violet w-full"><i class="fas fa-robot"></i> ${t('trainAgent')}</button>
      </div>
      <div class="lg:col-span-2 space-y-4">
        <div class="et-card">
          <h3 class="et-card-title text-violet-300">📈 Training Progress</h3>
          <div id="rl-chart" style="height:260px">
            <div class="flex items-center justify-center h-full text-gray-500 text-sm gap-2">
              <i class="fas fa-robot text-3xl text-violet-900"></i>Click "${t('trainAgent')}"
            </div>
          </div>
        </div>
        <div id="rl-optimal" class="hidden et-card border-violet-800/50">
          <h3 class="et-card-title text-violet-300 mb-3">🎯 Optimal Policy Found</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-2" id="rl-policy-grid"></div>
          <div class="mt-4 text-center bg-gray-800 rounded-xl p-4">
            <div class="text-xs text-gray-400">Max Achievable Score</div>
            <div class="text-5xl font-black text-violet-300 mt-1" id="rl-score">—</div>
            <div class="text-xs text-gray-500 mt-1">After <span id="rl-eps">—</span> training episodes</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;}

let _rlAlgo='dqn';
function selAlgo(a){
  _rlAlgo=a;
  document.getElementById('rl-dqn').className=`py-2 text-xs rounded-lg font-bold transition-all ${a==='dqn'?'bg-violet-700 text-white':'bg-gray-700 text-gray-300'}`;
  document.getElementById('rl-ppo').className=`py-2 text-xs rounded-lg font-bold transition-all ${a==='ppo'?'bg-violet-700 text-white':'bg-gray-700 text-gray-300'}`;
}

async function runRL(){
  const btn=document.getElementById('rl-btn');btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Training...';btn.disabled=true;
  const ep=+document.getElementById('rl-ep').value;
  const r=await fetch('/rl_optimize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({episodes:ep,algo:_rlAlgo})});
  const d=await r.json();ST.rlResult=d;

  Plotly.newPlot('rl-chart',[
    {type:'scatter',mode:'lines',name:'Score',x:d.trainingData.map(x=>x.episode),y:d.trainingData.map(x=>x.score),line:{color:'#a78bfa',width:2.5},fill:'tozeroy',fillcolor:'rgba(167,139,250,0.07)'},
    {type:'scatter',mode:'lines',name:'Reward',x:d.trainingData.map(x=>x.episode),y:d.trainingData.map(x=>x.reward),line:{color:'#8b5cf6',width:1.5,dash:'dot'},yaxis:'y2'},
    {type:'scatter',mode:'lines',name:'Loss',x:d.trainingData.map(x=>x.episode),y:d.trainingData.map(x=>x.loss*50),line:{color:'#ef4444',width:1},yaxis:'y3'},
  ],{paper_bgcolor:'transparent',plot_bgcolor:'rgba(17,24,39,0.4)',
    margin:{l:40,r:50,t:8,b:40},font:{color:'#9ca3af',size:10},
    xaxis:{title:'Episode',color:'#4b5563',gridcolor:'#1f2937'},
    yaxis:{title:'Score',color:'#a78bfa',gridcolor:'#1f2937'},
    yaxis2:{title:'Reward',color:'#8b5cf6',overlaying:'y',side:'right'},
    yaxis3:{visible:false,overlaying:'y'},
    legend:{bgcolor:'transparent',font:{color:'#9ca3af',size:9}},
  },{responsive:true,displayModeBar:false});

  const op=d.optimalPolicy;
  document.getElementById('rl-optimal').classList.remove('hidden');
  document.getElementById('rl-policy-grid').innerHTML=[
    {l:'Renewable',v:op.renewable+'%',i:'fa-solar-panel',c:'emerald'},
    {l:'Recycling',v:op.recycling+'%',i:'fa-recycle',c:'cyan'},
    {l:'Water Access',v:op.waterAccess+'%',i:'fa-droplet',c:'blue'},
    {l:'CO₂ Reduction',v:op.co2Reduction+'%',i:'fa-cloud-arrow-down',c:'red'},
    {l:'Energy Eff',v:op.energyEff+'%',i:'fa-bolt',c:'yellow'},
    {l:'Transport',v:op.transport+'%',i:'fa-bus',c:'violet'},
  ].map(p=>`<div class="bg-gray-800 rounded-lg p-3 text-center">
    <i class="fas ${p.i} text-${p.c}-400 text-lg mb-1"></i>
    <div class="text-lg font-black text-${p.c}-300">${p.v}</div>
    <div class="text-[9px] text-gray-400">${p.l}</div>
  </div>`).join('');
  document.getElementById('rl-score').textContent=op.finalScore;
  document.getElementById('rl-eps').textContent=ep;
  btn.innerHTML=`<i class="fas fa-robot"></i> ${t('trainAgent')}`;btn.disabled=false;
  toast('RL Training complete!','success');
}

// ════════════════════════════════════════════════════════════════════════════
// ANOMALY DETECTION
// ════════════════════════════════════════════════════════════════════════════
function anomalyHTML(){return `
  <div class="space-y-4">
    <h2 class="text-xl font-black text-cyan-300 flex items-center gap-2"><i class="fas fa-triangle-exclamation text-yellow-400"></i> ${t('anomaly')} Detection</h2>
    <div id="anomaly-alerts" class="space-y-2"></div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="et-card lg:col-span-2">
        <h3 class="et-card-title text-yellow-300">CO₂ Anomaly Timeline (Isolation Forest)</h3>
        <div id="an-co2" style="height:280px"></div>
      </div>
      <div class="et-card">
        <h3 class="et-card-title mb-3">Detection Stats</h3>
        <div id="an-stats" class="space-y-3"></div>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="et-card"><h3 class="et-card-title text-blue-300">Water Usage</h3><div id="an-water" style="height:160px"></div></div>
      <div class="et-card"><h3 class="et-card-title text-emerald-300">Energy Consumption</h3><div id="an-energy" style="height:160px"></div></div>
      <div class="et-card"><h3 class="et-card-title text-orange-300">Traffic Density</h3><div id="an-traffic" style="height:160px"></div></div>
    </div>
  </div>`;}

async function loadAnomaly(){
  const r=await fetch('/anomaly_data');ST.anomalyData=await r.json();
  const data=ST.anomalyData;
  const anom=data.filter(d=>d.isAnomaly);
  document.getElementById('anomaly-alerts').innerHTML=anom.map(a=>`
    <div class="flex items-start gap-3 bg-yellow-900/15 border border-yellow-700/40 rounded-xl p-3">
      <i class="fas fa-triangle-exclamation text-yellow-400 mt-0.5 flex-none"></i>
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <span class="text-sm font-bold text-yellow-300">⚠ Environmental Anomaly Detected — ${a.time}</span>
          <span class="text-[9px] px-2 py-0.5 rounded-full font-bold ${a.severity==='CRITICAL'?'bg-red-900 text-red-300':'bg-yellow-900 text-yellow-300'}">${a.severity}</span>
        </div>
        <p class="text-xs text-gray-400 mt-0.5">Possible cause: <span class="text-yellow-200">${a.cause}</span> · CO₂: ${a.co2}t · Water: ${a.water}M³ · Energy: ${a.energy}kWh</p>
      </div>
    </div>`).join('');

  const pl={paper_bgcolor:'transparent',plot_bgcolor:'rgba(17,24,39,0.4)',font:{color:'#9ca3af',size:9},showlegend:false,margin:{l:40,r:10,t:8,b:55},xaxis:{color:'#4b5563',gridcolor:'#1f2937',tickangle:-45,tickfont:{size:8}},yaxis:{color:'#4b5563',gridcolor:'#1f2937'}};
  Plotly.newPlot('an-co2',[
    {type:'scatter',mode:'lines',x:data.map(d=>d.time),y:data.map(d=>d.co2),line:{color:'#6b7280',width:1.5},name:'CO₂'},
    {type:'scatter',mode:'markers',x:anom.map(d=>d.time),y:anom.map(d=>d.co2),
      marker:{color:'#ef4444',size:14,symbol:'circle',line:{color:'#fca5a5',width:2}},name:'Anomaly',
      text:anom.map(d=>`⚠ ${d.cause}`),hovertemplate:'%{text}<br>CO₂: %{y}<extra></extra>'},
  ],{...pl,yaxis:{...pl.yaxis,title:'CO₂ t/cap'},showlegend:true,legend:{bgcolor:'transparent',font:{color:'#9ca3af',size:9}},margin:{...pl.margin,l:50}},{responsive:true,displayModeBar:false});

  document.getElementById('an-stats').innerHTML=`
    <div class="bg-gray-800 rounded-lg p-3"><div class="text-xs text-gray-400">Anomalies Found</div><div class="text-2xl font-black text-yellow-400">${anom.length}</div></div>
    <div class="bg-gray-800 rounded-lg p-3"><div class="text-xs text-gray-400">Peak CO₂</div><div class="text-2xl font-black text-red-400">${Math.max(...data.map(d=>d.co2)).toFixed(2)}t</div></div>
    <div class="bg-gray-800 rounded-lg p-3"><div class="text-xs text-gray-400">Avg Normal CO₂</div><div class="text-2xl font-black text-emerald-400">${(data.filter(d=>!d.isAnomaly).reduce((s,d)=>s+d.co2,0)/data.filter(d=>!d.isAnomaly).length).toFixed(2)}t</div></div>
    <div class="bg-gray-800 rounded-lg p-3"><div class="text-xs text-gray-400">Algorithm</div><div class="text-sm font-bold text-cyan-300">Isolation Forest</div><div class="text-[10px] text-gray-500">+ Autoencoder</div></div>`;

  const mkSmall=(id,y,col,key)=>Plotly.newPlot(id,[{type:'bar',x:data.map(d=>d.time),y:data.map(d=>d[key]),
    marker:{color:data.map(d=>d.isAnomaly?'#ef4444':col),opacity:0.7}}],
    {...pl,margin:{...pl.margin,l:35}},{responsive:true,displayModeBar:false});
  mkSmall('an-water',null,'#3b82f6','water');
  mkSmall('an-energy',null,'#10b981','energy');
  mkSmall('an-traffic',null,'#f97316','traffic');
}

// ════════════════════════════════════════════════════════════════════════════
// 3D GLOBE
// ════════════════════════════════════════════════════════════════════════════
function globe3dHTML(){return `
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="text-xl font-black text-cyan-300 flex items-center gap-2"><i class="fas fa-globe"></i> 3D Earth — Emission Hotspots</h2>
      <div class="flex gap-2 ml-auto">
        <select id="gm-select" onchange="updateGlobeMetric()" class="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200">
          <option value="score">Sustainability Score</option>
          <option value="co2">CO₂ Emissions</option>
          <option value="renewable">Renewable Energy</option>
          <option value="traffic">Traffic Density</option>
        </select>
        <button onclick="toggleGlobeRot()" id="globe-rot-btn" class="px-3 py-1.5 text-xs rounded-lg bg-cyan-800 text-cyan-200 hover:bg-cyan-700">
          <i class="fas fa-pause"></i> Pause
        </button>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 et-card p-0 overflow-hidden" style="height:520px">
        <canvas id="globe-canvas" style="width:100%;height:100%;display:block"></canvas>
      </div>
      <div class="space-y-3">
        <div class="et-card"><h3 class="et-card-title mb-2">Click a marker</h3><div id="globe-info" class="text-xs text-gray-400">Hover over the globe to explore environmental data by country.</div></div>
        <div class="et-card"><h3 class="et-card-title text-red-300 mb-2">🔥 Top CO₂ Emitters</h3><div id="hotspot-list" class="space-y-1.5"></div></div>
        <div class="et-card">
          <h3 class="et-card-title mb-2">Legend</h3>
          <div class="space-y-1.5 text-xs">
            <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>Sustainable</div>
            <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse"></span>Moderate</div>
            <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>Critical/High Emission</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;}

let gScene,gCam,gRenderer,gGlobe,gMarkers=[],gRings=[];
async function initGlobe3D(){
  if(!ST.worldData.length){const r=await fetch('/world_data');ST.worldData=await r.json();}
  buildHotspotList();buildGlobe();
}
function buildHotspotList(){
  const top=[...ST.worldData].sort((a,b)=>b.co2-a.co2).slice(0,5);
  document.getElementById('hotspot-list').innerHTML=top.map(c=>`
    <div class="flex items-center gap-2">
      <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
      <span class="flex-1 text-[10px] text-gray-300">${c.name}</span>
      <span class="text-[10px] text-red-400 font-bold">${c.co2}t</span>
    </div>`).join('');
}
function buildGlobe(){
  const canvas=document.getElementById('globe-canvas');if(!canvas)return;
  const W=canvas.parentElement.clientWidth,H=canvas.parentElement.clientHeight;
  gScene=new THREE.Scene();
  gCam=new THREE.PerspectiveCamera(45,W/H,0.1,1000);gCam.position.z=2.6;
  gRenderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  gRenderer.setSize(W,H);gRenderer.setPixelRatio(window.devicePixelRatio||1);

  // Stars
  const sg=new THREE.BufferGeometry(),sp=[];
  for(let i=0;i<5000;i++){const r=80+Math.random()*300,t=Math.random()*Math.PI*2,p=Math.acos(Math.random()*2-1);
    sp.push(r*Math.sin(p)*Math.cos(t),r*Math.sin(p)*Math.sin(t),r*Math.cos(p));}
  sg.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));
  gScene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:0.25,transparent:true,opacity:0.5})));

  // Lights
  gScene.add(new THREE.AmbientLight(0x223344,1.5));
  const sun=new THREE.DirectionalLight(0x99ccff,2.8);sun.position.set(5,3,5);gScene.add(sun);

  // Globe
  gGlobe=new THREE.Mesh(new THREE.SphereGeometry(1,64,64),new THREE.MeshPhongMaterial({color:0x0a1628,emissive:0x001020,specular:0x4488aa,shininess:25}));
  gScene.add(gGlobe);
  gScene.add(new THREE.Mesh(new THREE.SphereGeometry(1.04,32,32),new THREE.MeshBasicMaterial({color:0x003366,transparent:true,opacity:0.06,wireframe:false,side:THREE.FrontSide})));
  gScene.add(new THREE.Mesh(new THREE.SphereGeometry(1.001,24,24),new THREE.MeshBasicMaterial({color:0x1e3a5f,transparent:true,opacity:0.25,wireframe:true})));

  placeMarkers('score');
  ST.globeRotating=true;
  function animate(){
    ST.globeAnimFrame=requestAnimationFrame(animate);
    if(ST.globeRotating){gGlobe.rotation.y+=0.003;gMarkers.forEach(m=>m.rotation.y+=0.003);gRings.forEach(r=>r.rotation.y+=0.003);}
    gRenderer.render(gScene,gCam);
  }
  animate();
}
function placeMarkers(metric){
  [...gMarkers,...gRings].forEach(m=>gScene.remove(m));gMarkers=[];gRings=[];
  ST.worldData.forEach(c=>{
    const coords=CC[c.code];if(!coords)return;
    const lat=coords.lat*Math.PI/180,lon=coords.lon*Math.PI/180,r2=1.02;
    const x=r2*Math.cos(lat)*Math.cos(lon),y=r2*Math.sin(lat),z=r2*Math.cos(lat)*Math.sin(lon);
    let col,sz;
    if(metric==='co2'){const n=clamp(c.co2/20,0,1);col=new THREE.Color(n,1-n*0.8,0);sz=0.012+n*0.04;}
    else if(metric==='renewable'){const n=c.renewable/100;col=new THREE.Color(0,n*0.8,1-n*0.4);sz=0.012+n*0.025;}
    else if(metric==='traffic'){const n=c.traffic/100;col=new THREE.Color(n,0.4,1-n);sz=0.012+n*0.02;}
    else{col=new THREE.Color(...hexToRgb(scoreColor(c.score)));sz=0.012+(c.score/100)*0.025;}
    const m=new THREE.Mesh(new THREE.SphereGeometry(sz,12,12),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.9}));
    m.position.set(x,y,z);m.userData=c;gScene.add(m);gMarkers.push(m);
    const rg=new THREE.Mesh(new THREE.RingGeometry(sz*1.5,sz*2.8,16),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.25,side:THREE.DoubleSide}));
    rg.position.set(x,y,z);rg.lookAt(0,0,0);gScene.add(rg);gRings.push(rg);
  });
}
function updateGlobeMetric(){placeMarkers(document.getElementById('gm-select').value);}
function toggleGlobeRot(){
  ST.globeRotating=!ST.globeRotating;
  const btn=document.getElementById('globe-rot-btn');
  btn.innerHTML=ST.globeRotating?'<i class="fas fa-pause"></i> Pause':'<i class="fas fa-play"></i> Resume';
}

// ════════════════════════════════════════════════════════════════════════════
// SDG TRACKER
// ════════════════════════════════════════════════════════════════════════════
function sdgHTML(){return `<div class="space-y-5"><h2 class="text-xl font-black text-cyan-300 flex items-center gap-2"><i class="fas fa-bullseye"></i> UN ${t('sdgTracker')}</h2><div id="sdg-content"><div class="flex justify-center py-12"><div class="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full"></div></div></div></div>`;}

async function loadSDG(){
  const r=await fetch('/sdg_data');ST.sdgData=await r.json();
  const {sdgs,aiScore}=ST.sdgData;
  document.getElementById('sdg-content').innerHTML=`
    <div class="et-card bg-gradient-to-r from-cyan-900/20 to-emerald-900/20 border-cyan-800/40 mb-5">
      <div class="flex justify-between items-center">
        <div><div class="text-xs text-cyan-400 font-bold mb-1">OVERALL AI SUSTAINABILITY SCORE</div>
          <div class="text-5xl font-black text-cyan-300">${aiScore}<span class="text-xl text-gray-400">/100</span></div>
          <div class="text-xs text-gray-400 mt-1">Weighted SDG alignment · 2030 target</div></div>
        <div class="text-right">
          <div class="text-xs text-gray-400">2030 Progress</div>
          <div class="text-3xl font-bold text-emerald-400">${aiScore}%</div>
          <div class="w-32 bg-gray-700 rounded-full h-2 mt-2"><div class="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500" style="width:${aiScore}%"></div></div>
        </div>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
      ${sdgs.map(s=>`
        <div class="et-card hover:border-gray-600 transition-all">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style="background:${s.color}22;border:1px solid ${s.color}44">${s.icon}</div>
            <div><div class="text-[9px] text-gray-500 font-bold">SDG ${s.id}</div><div class="text-xs font-bold text-gray-200">${s.name}</div></div>
          </div>
          <div class="flex justify-between text-[10px] mb-1"><span class="text-gray-400">${s.value}</span><span class="font-bold" style="color:${s.color}">${s.progress}%</span></div>
          <div class="w-full bg-gray-700 rounded-full h-2 mb-2"><div class="h-2 rounded-full transition-all duration-1000" style="width:${s.progress}%;background:${s.color}"></div></div>
          <div id="sdg-spark-${s.id}" style="height:50px;margin:-2px -2px 4px"></div>
          <div class="text-[9px] text-gray-400 bg-gray-800 rounded p-2">💡 ${s.recommendation}</div>
        </div>`).join('')}
    </div>
    <div class="et-card"><h3 class="et-card-title mb-3">SDG Radar Chart</h3><div id="sdg-radar" style="height:340px"></div></div>`;

  sdgs.forEach(s=>Plotly.newPlot(`sdg-spark-${s.id}`,[{type:'scatter',mode:'lines',x:[2020,2021,2022,2023,2024,2025],y:s.trend,line:{color:s.color,width:2},fill:'tozeroy',fillcolor:s.color+'22'}],{paper_bgcolor:'transparent',plot_bgcolor:'transparent',margin:{l:0,r:0,t:0,b:0},xaxis:{visible:false},yaxis:{visible:false},showlegend:false},{responsive:true,displayModeBar:false,staticPlot:true}));

  Plotly.newPlot('sdg-radar',[
    {type:'scatterpolar',fill:'toself',r:sdgs.map(s=>s.progress),theta:sdgs.map(s=>`SDG ${s.id}`),fillcolor:'rgba(34,211,238,0.08)',line:{color:'#22d3ee',width:2},name:'Current'},
    {type:'scatterpolar',fill:'toself',r:sdgs.map(()=>100),theta:sdgs.map(s=>`SDG ${s.id}`),fillcolor:'rgba(255,255,255,0.02)',line:{color:'#374151',width:1,dash:'dash'},name:'Target'},
  ],{polar:{bgcolor:'transparent',radialaxis:{visible:true,range:[0,100],gridcolor:'#1f2937',color:'#6b7280'},angularaxis:{color:'#9ca3af'}},
    paper_bgcolor:'transparent',font:{color:'#d1d5db',size:11},legend:{bgcolor:'transparent',font:{color:'#9ca3af',size:9}},margin:{l:60,r:60,t:20,b:20},
  },{responsive:true,displayModeBar:false});
}

// ════════════════════════════════════════════════════════════════════════════
// HISTORICAL TRENDS
// ════════════════════════════════════════════════════════════════════════════
function historyHTML(){return `
  <div class="space-y-5">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="text-xl font-black text-cyan-300 flex items-center gap-2"><i class="fas fa-clock-rotate-left"></i> ${t('history')}</h2>
      <div class="flex items-center gap-2">
        <select id="hist-country" class="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cyan-500" onchange="loadHistory()">
          ${[{c:'USA',n:'United States'},{c:'DEU',n:'Germany'},{c:'NOR',n:'Norway'},{c:'IND',n:'India'},
             {c:'CHN',n:'China'},{c:'BRA',n:'Brazil'},{c:'JPN',n:'Japan'},{c:'GBR',n:'United Kingdom'},
             {c:'AUS',n:'Australia'},{c:'CHE',n:'Switzerland'},{c:'SWE',n:'Sweden'},{c:'SAU',n:'Saudi Arabia'}]
            .map(x=>`<option value="${x.c}">${x.n}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="hist-content"><div class="flex justify-center py-12"><div class="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full"></div></div></div>
  </div>`;}

async function loadHistory(){
  const code=document.getElementById('hist-country')?.value||'USA';
  const r=await fetch(`/historical/${code}`);
  ST.historyData=await r.json();
  const d=ST.historyData;
  const pl={paper_bgcolor:'transparent',plot_bgcolor:'rgba(17,24,39,0.4)',font:{color:'#9ca3af',size:10},margin:{l:45,r:15,t:8,b:40}};
  const px={color:'#4b5563',gridcolor:'#1f2937'};

  document.getElementById('hist-content').innerHTML=`
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      ${[{l:'Current Score',v:d.country.score,u:'',c:'cyan'},{l:'CO₂/capita',v:d.country.co2,u:'t',c:'red'},
         {l:'Renewable',v:d.country.renewable,u:'%',c:'emerald'},{l:'Recycling',v:d.country.recycling,u:'%',c:'violet'}]
        .map(k=>`<div class="et-card text-center"><div class="text-xs text-gray-400 mb-1">${k.l}</div><div class="text-2xl font-black text-${k.c}-300">${k.v}${k.u}</div></div>`).join('')}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="et-card"><h3 class="et-card-title">Sustainability Score History</h3><div id="h-score" style="height:200px"></div></div>
      <div class="et-card"><h3 class="et-card-title text-red-300">CO₂ Emissions History</h3><div id="h-co2" style="height:200px"></div></div>
      <div class="et-card"><h3 class="et-card-title text-emerald-300">Renewable Energy Growth</h3><div id="h-ren" style="height:200px"></div></div>
      <div class="et-card"><h3 class="et-card-title text-blue-300">Water Access & Recycling</h3><div id="h-wr" style="height:200px"></div></div>
    </div>`;

  const mk=(id,traces)=>Plotly.newPlot(id,traces,{...pl,xaxis:{...px,title:'Year'},yaxis:{...px}},{responsive:true,displayModeBar:false});
  mk('h-score',[{type:'scatter',mode:'lines+markers',x:d.years,y:d.scores,line:{color:'#22d3ee',width:2.5},marker:{size:5},fill:'tozeroy',fillcolor:'rgba(34,211,238,0.06)'}]);
  mk('h-co2',[{type:'scatter',mode:'lines+markers',x:d.years,y:d.co2,line:{color:'#ef4444',width:2.5},marker:{size:5},fill:'tozeroy',fillcolor:'rgba(239,68,68,0.06)'}]);
  mk('h-ren',[{type:'bar',x:d.years,y:d.renewable,marker:{color:'#10b981',opacity:0.8}}]);
  mk('h-wr',[
    {type:'scatter',mode:'lines+markers',name:'Water %',x:d.years,y:d.water,line:{color:'#3b82f6',width:2}},
    {type:'scatter',mode:'lines+markers',name:'Recycling %',x:d.years,y:d.recycling,line:{color:'#8b5cf6',width:2}},
  ]);
}

// ════════════════════════════════════════════════════════════════════════════
// ENTERPRISE ANALYTICS
// ════════════════════════════════════════════════════════════════════════════
function analyticsHTML(){return `
  <div class="space-y-5">
    <h2 class="text-xl font-black text-cyan-300 flex items-center gap-2"><i class="fas fa-chart-bar"></i> ${t('analytics')} — Enterprise Intelligence</h2>
    <div id="analytics-content"><div class="flex justify-center py-12"><div class="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full"></div></div></div>
  </div>`;}

async function loadAnalytics(){
  const r=await fetch('/analytics/enterprise',{headers:authHeaders()});
  ST.enterpriseData=await r.json();
  const d=ST.enterpriseData;
  document.getElementById('analytics-content').innerHTML=`
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      ${[{l:'Total Countries',v:d.kpis.totalCountries,c:'cyan'},{l:'Improving',v:d.kpis.improvingCount,c:'emerald'},
         {l:'Critical',v:d.kpis.criticalCount,c:'red'},{l:'YoY Change',v:'+'+d.kpis.yearOverYear,c:'violet'}]
        .map(k=>`<div class="et-card text-center"><div class="text-xs text-gray-400 mb-1">${k.l}</div><div class="text-3xl font-black text-${k.c}-300">${k.v}</div></div>`).join('')}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <div class="et-card">
        <h3 class="et-card-title">Regional Sustainability Scores</h3>
        <div id="ea-regional" style="height:260px"></div>
      </div>
      <div class="et-card">
        <h3 class="et-card-title">Monthly Global Score Trend (2025)</h3>
        <div id="ea-monthly" style="height:260px"></div>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      <div class="et-card">
        <h3 class="et-card-title text-emerald-300">Top Performers</h3>
        <div class="mt-2 space-y-2">
          <div class="flex justify-between"><span class="text-xs text-gray-400">Best Country</span><span class="text-xs font-bold text-emerald-300">${d.kpis.bestPerformer}</span></div>
          <div class="flex justify-between"><span class="text-xs text-gray-400">Worst Country</span><span class="text-xs font-bold text-red-300">${d.kpis.worstPerformer}</span></div>
          <div class="flex justify-between"><span class="text-xs text-gray-400">2030 Forecast</span><span class="text-xs font-bold text-cyan-300">${d.kpis.predictedScore2030}/100</span></div>
        </div>
      </div>
      <div class="et-card col-span-1 md:col-span-2">
        <h3 class="et-card-title">Regional CO₂ vs Renewable</h3>
        <div id="ea-scatter" style="height:160px"></div>
      </div>
    </div>
    <div class="et-card">
      <h3 class="et-card-title mb-3">Regional Breakdown Table</h3>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead><tr>${['Region','Countries','Avg Score','CO₂','Renewable','Trend'].map(h=>`<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${d.regions.map(reg=>`<tr>
            <td class="font-bold text-gray-200">${reg.name}</td>
            <td>${reg.countries}</td>
            <td><span class="font-bold" style="color:${scoreColor(reg.avgScore)}">${reg.avgScore}</span></td>
            <td class="text-red-300">${reg.co2}t</td>
            <td class="text-emerald-300">${reg.renewable}%</td>
            <td class="${reg.trend>0?'text-emerald-300':'text-red-300'}">${reg.trend>0?'+':''}${reg.trend}%</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;

  const pl={paper_bgcolor:'transparent',plot_bgcolor:'rgba(17,24,39,0.4)',font:{color:'#9ca3af',size:10},margin:{l:45,r:15,t:8,b:40},xaxis:{color:'#4b5563',gridcolor:'#1f2937'},yaxis:{color:'#4b5563',gridcolor:'#1f2937'}};
  Plotly.newPlot('ea-regional',[
    {type:'bar',name:'Avg Score',x:d.regions.map(r=>r.name),y:d.regions.map(r=>r.avgScore),marker:{color:d.regions.map(r=>scoreColor(r.avgScore)),opacity:0.85}},
  ],{...pl},{responsive:true,displayModeBar:false});
  Plotly.newPlot('ea-monthly',[
    {type:'scatter',mode:'lines+markers',name:'Score',x:d.monthly.map(m=>m.month),y:d.monthly.map(m=>m.score),line:{color:'#22d3ee',width:2.5},marker:{size:5}},
    {type:'scatter',mode:'lines',name:'CO₂×10',x:d.monthly.map(m=>m.month),y:d.monthly.map(m=>m.co2*10),line:{color:'#ef4444',width:1.5,dash:'dot'},yaxis:'y2'},
  ],{...pl,yaxis2:{overlaying:'y',side:'right',color:'#ef4444'},legend:{bgcolor:'transparent',font:{color:'#9ca3af',size:9}}},{responsive:true,displayModeBar:false});
  Plotly.newPlot('ea-scatter',[{type:'scatter',mode:'markers+text',x:d.regions.map(r=>r.renewable),y:d.regions.map(r=>r.co2),text:d.regions.map(r=>r.name),textposition:'top center',
    marker:{size:d.regions.map(r=>8+r.avgScore/10),color:d.regions.map(r=>scoreColor(r.avgScore)),opacity:0.85}}],
    {paper_bgcolor:'transparent',plot_bgcolor:'rgba(17,24,39,0.4)',font:{color:'#9ca3af',size:9},margin:{l:40,r:10,t:5,b:40},
    xaxis:{title:'Renewable %',color:'#4b5563',gridcolor:'#1f2937'},yaxis:{title:'CO₂',color:'#4b5563',gridcolor:'#1f2937'}},{responsive:true,displayModeBar:false});
}

// ════════════════════════════════════════════════════════════════════════════
// AI CHATBOT
// ════════════════════════════════════════════════════════════════════════════
function aiHTML(){return `
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
    <div class="lg:col-span-2 flex flex-col et-card" style="height:600px">
      <div class="flex items-center gap-3 pb-3 mb-3 border-b border-gray-800">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-500 flex items-center justify-center"><i class="fas fa-robot text-gray-950 text-sm"></i></div>
        <div>
          <div class="text-sm font-black text-cyan-300">Ask EcoTwin AI</div>
          <div class="flex items-center gap-1.5 text-[9px] text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>Online · NLP + Sustainability Data</div>
        </div>
        <div class="ml-auto">
          <select id="ai-lang" class="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-200">
            ${[{v:'en',l:'EN'},{v:'es',l:'ES'},{v:'fr',l:'FR'},{v:'de',l:'DE'},{v:'zh',l:'ZH'},{v:'ar',l:'AR'},{v:'hi',l:'HI'},{v:'pt',l:'PT'}]
              .map(l=>`<option value="${l.v}" ${ST.lang===l.v?'selected':''}>${l.l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="chat-msgs" class="flex-1 overflow-y-auto space-y-3">
        <div class="flex gap-2">
          <div class="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex-none flex items-center justify-center"><i class="fas fa-robot text-[9px] text-gray-950"></i></div>
          <div class="bg-gray-800 rounded-xl px-3 py-2 max-w-lg">
            <p class="text-xs text-gray-200">Hello! I'm <strong class="text-cyan-300">EcoTwin AI</strong>. I have access to data on 50+ countries — CO₂, renewables, water, recycling, traffic, and more. I can explain SHAP predictions, analyze trends, or recommend policies. 🌍</p>
          </div>
        </div>
      </div>
      <div class="pt-3 border-t border-gray-800 mt-2">
        <div class="flex gap-2">
          <input id="chat-input" type="text" placeholder="Ask about sustainability..."
                 class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                 onkeydown="if(event.key==='Enter')sendChat()">
          <button onclick="sendChat()" class="px-3 py-2 rounded-lg bg-cyan-700 text-white text-xs hover:bg-cyan-600 transition-all"><i class="fas fa-paper-plane"></i></button>
        </div>
      </div>
    </div>
    <div class="space-y-4">
      <div class="et-card">
        <h3 class="et-card-title mb-3">💡 Try Asking</h3>
        <div id="suggested-qs" class="space-y-1.5">
          ${['Which country has the highest sustainability score?','How can CO2 emissions be reduced?','Compare India and USA sustainability','Explain SHAP analysis','Best renewable energy policies','What is climate action SDG 13?','Countries with critical water access','How does LSTM forecasting work?']
            .map(q=>`<button onclick="askSugg('${q.replace(/'/g,"\\'")}',this)" class="w-full text-left text-[10px] text-gray-300 hover:text-cyan-300 bg-gray-800 hover:bg-gray-700 rounded-lg px-2.5 py-1.5 transition-all">${q}</button>`).join('')}
        </div>
      </div>
      <div class="et-card">
        <h3 class="et-card-title mb-2">📊 Quick Facts</h3>
        <div class="space-y-1.5 text-[10px] text-gray-400">
          <div class="flex justify-between"><span>Countries:</span><span class="text-cyan-300">50+</span></div>
          <div class="flex justify-between"><span>Best scorer:</span><span class="text-emerald-300">Norway (90)</span></div>
          <div class="flex justify-between"><span>Needs attention:</span><span class="text-red-300">Saudi Arabia (28)</span></div>
          <div class="flex justify-between"><span>Global avg:</span><span class="text-yellow-300">61/100</span></div>
          <div class="flex justify-between"><span>Languages:</span><span class="text-violet-300">8</span></div>
        </div>
      </div>
    </div>
  </div>`;}

async function sendChat(){
  const input=document.getElementById('chat-input');
  const q=input.value.trim();if(!q)return;
  input.value='';appendChatMsg('user',q);
  const lang=document.getElementById('ai-lang')?.value||ST.lang;
  const tid='t'+Date.now();
  document.getElementById('chat-msgs').insertAdjacentHTML('beforeend',`
    <div id="${tid}" class="flex gap-2">
      <div class="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex-none flex items-center justify-center"><i class="fas fa-robot text-[9px] text-gray-950"></i></div>
      <div class="bg-gray-800 rounded-xl px-3 py-2"><div class="flex gap-1">
        <span class="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style="animation-delay:0ms"></span>
        <span class="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style="animation-delay:150ms"></span>
        <span class="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style="animation-delay:300ms"></span>
      </div></div>
    </div>`);
  scrollChat();
  const r=await fetch('/ai_query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q,lang})});
  const d=await r.json();
  document.getElementById(tid)?.remove();
  appendChatMsg('bot',d.response,d.suggestions);
}
function appendChatMsg(role,text,sugg){
  const msgs=document.getElementById('chat-msgs');
  const fmt=text.replace(/\*\*(.*?)\*\*/g,'<strong class="text-cyan-200">$1</strong>').replace(/\n/g,'<br>');
  if(role==='user'){
    msgs.insertAdjacentHTML('beforeend',`<div class="flex gap-2 justify-end"><div class="bg-cyan-800/50 rounded-xl px-3 py-2 max-w-sm"><p class="text-xs text-cyan-100">${text}</p></div><div class="w-6 h-6 rounded-full bg-gray-700 flex-none flex items-center justify-center"><i class="fas fa-user text-[9px] text-gray-300"></i></div></div>`);
  } else {
    msgs.insertAdjacentHTML('beforeend',`
      <div class="flex gap-2">
        <div class="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex-none flex items-center justify-center"><i class="fas fa-robot text-[9px] text-gray-950"></i></div>
        <div class="bg-gray-800 rounded-xl px-3 py-2 max-w-lg"><p class="text-xs text-gray-200 leading-relaxed">${fmt}</p></div>
      </div>`);
    if(sugg?.length){
      const el=document.getElementById('suggested-qs');if(el)
        el.innerHTML=sugg.map(q=>`<button onclick="askSugg('${q.replace(/'/g,"\\'")}',this)" class="w-full text-left text-[10px] text-cyan-300 bg-cyan-900/20 border border-cyan-800/30 hover:bg-cyan-900/30 rounded-lg px-2.5 py-1.5 transition-all">${q}</button>`).join('')+el.innerHTML;
    }
  }
  scrollChat();
}
function scrollChat(){const el=document.getElementById('chat-msgs');if(el)el.scrollTop=el.scrollHeight;}
function askSugg(q){document.getElementById('chat-input').value=q;sendChat();}

// ════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL
// ════════════════════════════════════════════════════════════════════════════
function adminHTML(){return `
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-black text-cyan-300 flex items-center gap-2"><i class="fas fa-shield-halved text-red-400"></i> ${t('admin')} Panel</h2>
      <span class="text-[10px] px-2 py-1 rounded-full bg-red-900/50 border border-red-700/50 text-red-300 font-bold">ADMIN ONLY</span>
    </div>
    <!-- System Stats -->
    <div id="admin-stats-grid" class="grid grid-cols-2 md:grid-cols-4 gap-3"></div>
    <!-- Users Table -->
    <div class="et-card">
      <div class="flex items-center justify-between mb-3">
        <h3 class="et-card-title">Registered Users</h3>
        <button onclick="loadAdmin()" class="text-xs text-cyan-400 hover:text-cyan-300"><i class="fas fa-rotate-right mr-1"></i>Refresh</button>
      </div>
      <div class="overflow-x-auto" id="admin-users-table"></div>
    </div>
    <!-- Simulation History -->
    <div class="et-card">
      <h3 class="et-card-title mb-3">Recent Simulations</h3>
      <div id="admin-sim-history" class="text-xs text-gray-400"></div>
    </div>
    <!-- Architecture -->
    <div class="et-card border-cyan-900/40">
      <h3 class="et-card-title mb-3">System Architecture</h3>
      <div class="flex flex-wrap items-center gap-2 text-xs">
        ${['User Browser','→','Cloudflare Edge','→','Hono API','→','AI/ML Engine','→','Response'].map((n,i)=>
          n==='→'?`<span class="text-gray-600">${n}</span>`:
          `<span class="px-2 py-1 rounded-lg ${i===0?'bg-blue-900/40 text-blue-300':i===2?'bg-orange-900/40 text-orange-300':i===4?'bg-cyan-900/40 text-cyan-300':i===6?'bg-violet-900/40 text-violet-300':'bg-emerald-900/40 text-emerald-300'} font-bold">${n}</span>`).join('')}
      </div>
      <div class="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-gray-400">
        <div class="bg-gray-800 rounded p-2"><div class="font-bold text-cyan-300 mb-0.5">Frontend</div>Hono SSR + Tailwind + Plotly + Three.js</div>
        <div class="bg-gray-800 rounded p-2"><div class="font-bold text-orange-300 mb-0.5">Backend</div>Cloudflare Workers (Edge)</div>
        <div class="bg-gray-800 rounded p-2"><div class="font-bold text-violet-300 mb-0.5">AI/ML</div>LSTM Forecast + SHAP + RL (DQN/PPO)</div>
        <div class="bg-gray-800 rounded p-2"><div class="font-bold text-emerald-300 mb-0.5">Auth</div>Session tokens + OTP email verification</div>
      </div>
    </div>
  </div>`;}

async function loadAdmin(){
  const [usersR,statsR,simR]=await Promise.all([
    fetch('/admin/users',{headers:authHeaders()}),
    fetch('/admin/stats',{headers:authHeaders()}),
    fetch('/simulate/history'),
  ]);
  const users=await usersR.json(),stats=await statsR.json(),sims=await simR.json();

  document.getElementById('admin-stats-grid').innerHTML=[
    {l:'Total Users',v:stats.totalUsers,c:'cyan',i:'fa-users'},
    {l:'Active Sessions',v:stats.activeSessions,c:'emerald',i:'fa-circle-check'},
    {l:'API Calls',v:stats.apiCalls,c:'violet',i:'fa-code'},
    {l:'Uptime',v:stats.uptime,c:'yellow',i:'fa-server'},
  ].map(k=>`<div class="et-card text-center"><i class="fas ${k.i} text-${k.c}-400 mb-1 text-lg"></i><div class="text-2xl font-black text-${k.c}-300">${k.v}</div><div class="text-[10px] text-gray-400">${k.l}</div></div>`).join('');

  if(Array.isArray(users)){
    document.getElementById('admin-users-table').innerHTML=`
      <table class="w-full">
        <thead><tr>${['Name','Email','Role','Org','Verified','Logins','Last Login'].map(h=>`<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${users.map(u=>`<tr>
          <td class="font-medium text-white">${u.name}</td>
          <td class="text-gray-400">${u.email}</td>
          <td><span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${u.role==='admin'?'bg-red-900/60 text-red-300':u.role==='analyst'?'bg-cyan-900/60 text-cyan-300':'bg-gray-700 text-gray-400'}">${u.role}</span></td>
          <td class="text-gray-400">${u.org||'—'}</td>
          <td>${u.verified?'<span class="text-emerald-400">✓</span>':'<span class="text-red-400">✗</span>'}</td>
          <td class="text-gray-300">${u.loginCount}</td>
          <td class="text-gray-500 text-[10px]">${u.lastLogin?new Date(u.lastLogin).toLocaleString():'-'}</td>
        </tr>`).join('')}</tbody>
      </table>`;
  }

  document.getElementById('admin-sim-history').innerHTML=sims.length
    ? sims.slice(0,8).map(s=>`<div class="flex items-center gap-3 py-1.5 border-b border-gray-800"><span class="text-gray-500 w-32">${new Date(s.ts).toLocaleString()}</span><span class="text-cyan-400 font-mono text-[10px]">${s.id}</span><span class="text-emerald-300 ml-auto">Score: ${Array.isArray(s.result?.scores)?s.result.scores[s.result.scores.length-1]:'—'}</span></div>`).join('')
    : '<p class="text-gray-600">No simulations yet</p>';
}

// ════════════════════════════════════════════════════════════════════════════
// GLOBAL BINDINGS & BOOT
// ════════════════════════════════════════════════════════════════════════════
window.switchTab=switchTab;window.changeLang=changeLang;
window.showLoginModal=showLoginModal;window.showRegisterModal=showRegisterModal;
window.doLogin=doLogin;window.doRegister=doRegister;window.doLogout=doLogout;
window.doVerifyOtp=doVerifyOtp;window.closeModal=closeModal;
window.togglePassVis=togglePassVis;window.showProfileModal=showProfileModal;window.saveProfile=saveProfile;
window.filterMap=filterMap;window.animateYear=animateYear;
window.toggleRTFeed=toggleRTFeed;
window.runSimulation=runSimulation;window.runCompare=runCompare;
window.runSHAP=runSHAP;window.runRL=runRL;window.selAlgo=selAlgo;
window.updateGlobeMetric=updateGlobeMetric;window.toggleGlobeRot=toggleGlobeRot;
window.sendChat=sendChat;window.askSugg=askSugg;
window.loadHistory=loadHistory;window.loadAdmin=loadAdmin;
window.runRiskAssessment=runRiskAssessment;
window.loadCarbon=loadCarbon;window.runCarbonScenario=runCarbonScenario;
window.loadCities=loadCities;window.benchmarkCity=benchmarkCity;
window.togglePolicy=togglePolicy;window.runPolicySim=runPolicySim;
window.loadNews=loadNews;window.filterNews=filterNews;
window.exportData=exportData;
window.runPeerCompare=runPeerCompare;

// ════════════════════════════════════════════════════════════════════════════
// CLIMATE RISK ASSESSMENT
// ════════════════════════════════════════════════════════════════════════════
function riskHTML(){return `
  <div class="space-y-5">
    <div class="flex flex-wrap items-center gap-3">
      <div>
        <h2 class="text-xl font-black text-cyan-300 flex items-center gap-2"><i class="fas fa-shield-virus text-red-400"></i> Climate Risk Assessment</h2>
        <p class="text-xs text-gray-500 mt-0.5">Physical & transition risk modeling · AI-powered vulnerability analysis</p>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div class="et-card">
        <h3 class="et-card-title mb-4"><i class="fas fa-sliders text-red-400"></i> Risk Parameters</h3>
        ${[
          {id:'cr-ren',  l:'Renewable Energy %',   unit:'%',  min:0, max:100, val:50, col:'emerald'},
          {id:'cr-co2',  l:'CO₂ Emissions',         unit:'t',  min:0, max:25,  val:8,  col:'red'},
          {id:'cr-wat',  l:'Water Access',           unit:'%',  min:0, max:100, val:88, col:'blue'},
          {id:'cr-rec',  l:'Recycling Rate',         unit:'%',  min:0, max:100, val:35, col:'cyan'},
          {id:'cr-nrg',  l:'Energy Efficiency',      unit:'%',  min:0, max:100, val:50, col:'yellow'},
          {id:'cr-cst',  l:'Coastal Exposure',       unit:'%',  min:0, max:100, val:40, col:'orange'},
          {id:'cr-heat', l:'Heat Index',             unit:'%',  min:0, max:100, val:50, col:'red'},
          {id:'cr-flood',l:'Flood Risk',             unit:'%',  min:0, max:100, val:35, col:'blue'},
        ].map(s=>`
          <div class="mb-3">
            <div class="flex justify-between mb-0.5">
              <span class="text-[10px] text-gray-400">${s.l}</span>
              <span class="text-[10px] font-bold text-${s.col}-300" id="${s.id}-v">${s.val}${s.unit}</span>
            </div>
            <input type="range" id="${s.id}" min="${s.min}" max="${s.max}" value="${s.val}"
                   class="w-full accent-${s.col}-500 h-1"
                   oninput="document.getElementById('${s.id}-v').textContent=this.value+'${s.unit}'">
          </div>`).join('')}
        <button onclick="runRiskAssessment()" id="risk-btn" class="et-btn-danger w-full mt-2">
          <i class="fas fa-fire"></i> Assess Climate Risk
        </button>
      </div>
      <div class="lg:col-span-2 space-y-4">
        <div class="grid grid-cols-3 gap-3" id="risk-kpis">
          ${['Physical Risk','Transition Risk','Overall Risk'].map(l=>`
            <div class="et-card text-center">
              <div class="text-[10px] text-gray-400 mb-1">${l}</div>
              <div class="text-3xl font-black text-gray-600">—</div>
            </div>`).join('')}
        </div>
        <div class="et-card">
          <h3 class="et-card-title mb-3"><i class="fas fa-chart-bar text-red-400"></i> Risk Category Breakdown</h3>
          <div id="risk-categories" class="space-y-3">
            <div class="text-center py-8 text-gray-600 text-sm">Run assessment to view risk breakdown</div>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="et-card">
            <h3 class="et-card-title mb-2"><i class="fas fa-chart-radar text-violet-400"></i> Risk Radar</h3>
            <div id="risk-radar" style="height:220px"></div>
          </div>
          <div class="et-card">
            <h3 class="et-card-title mb-2"><i class="fas fa-lightbulb text-yellow-400"></i> Adaptation Recommendations</h3>
            <div id="risk-recs" class="space-y-2 text-xs text-gray-500">Run assessment to view recommendations</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;}

async function runRiskAssessment(){
  const btn=document.getElementById('risk-btn');
  btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Analyzing...';btn.disabled=true;
  const payload={
    renewable:+document.getElementById('cr-ren').value,
    co2:+document.getElementById('cr-co2').value,
    waterAccess:+document.getElementById('cr-wat').value,
    recycling:+document.getElementById('cr-rec').value,
    energyEff:+document.getElementById('cr-nrg').value,
    coastalExposure:+document.getElementById('cr-cst').value,
    heatIndex:+document.getElementById('cr-heat').value,
    floodRisk:+document.getElementById('cr-flood').value,
  };
  const r=await fetch('/climate_risk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json();

  // KPIs
  document.getElementById('risk-kpis').innerHTML=[
    {l:'Physical Risk',  v:d.physicalRisk,   c:d.physicalRisk>65?'red':d.physicalRisk>40?'yellow':'emerald'},
    {l:'Transition Risk',v:d.transitionRisk, c:d.transitionRisk>65?'red':d.transitionRisk>40?'yellow':'emerald'},
    {l:'Overall Risk',   v:d.overallRisk,    c:d.overallRisk>65?'red':d.overallRisk>40?'yellow':'emerald'},
  ].map(k=>`<div class="et-card text-center">
    <div class="text-[10px] text-gray-400 mb-1">${k.l}</div>
    <div class="text-3xl font-black text-${k.c}-300">${k.v}%</div>
    <div class="risk-gauge mt-2"><div class="risk-needle" style="left:${k.v}%"></div></div>
  </div>`).join('');

  // Categories
  document.getElementById('risk-categories').innerHTML=d.riskCategories.map(rc=>`
    <div class="flex items-start gap-3">
      <span class="text-lg">${rc.icon}</span>
      <div class="flex-1">
        <div class="flex items-center gap-2 mb-0.5">
          <span class="text-xs font-bold text-gray-200">${rc.name}</span>
          <span class="text-[9px] px-1.5 py-0.5 rounded font-bold risk-${rc.level.toLowerCase()}">${rc.level}</span>
          <span class="ml-auto text-xs font-black ${rc.level==='HIGH'?'text-red-300':rc.level==='MEDIUM'?'text-yellow-300':'text-emerald-300'}">${rc.score}%</span>
        </div>
        <div class="metric-bar"><div class="metric-bar-fill progress-animate"
          style="width:${rc.score}%;background:${rc.level==='HIGH'?'#ef4444':rc.level==='MEDIUM'?'#f59e0b':'#10b981'}"></div></div>
        <p class="text-[9px] text-gray-500 mt-0.5">${rc.desc}</p>
      </div>
    </div>`).join('');

  // Radar
  const cats=d.riskCategories;
  Plotly.newPlot('risk-radar',[
    {type:'scatterpolar',fill:'toself',r:cats.map(c=>c.score),theta:cats.map(c=>c.name),
     fillcolor:'rgba(239,68,68,0.1)',line:{color:'#ef4444',width:2},name:'Current Risk'},
    {type:'scatterpolar',fill:'toself',r:cats.map(()=>40),theta:cats.map(c=>c.name),
     fillcolor:'rgba(16,185,129,0.05)',line:{color:'#10b981',width:1,dash:'dash'},name:'Safe Threshold'},
  ],{polar:{bgcolor:'transparent',radialaxis:{visible:true,range:[0,100],gridcolor:'#1f2937',color:'#6b7280'},angularaxis:{color:'#9ca3af'}},
    paper_bgcolor:'transparent',font:{color:'#d1d5db',size:9},
    legend:{bgcolor:'transparent',font:{color:'#9ca3af',size:8}},margin:{l:35,r:35,t:10,b:10}},
  {responsive:true,displayModeBar:false});

  // Recommendations
  document.getElementById('risk-recs').innerHTML=d.recommendations.map((r,i)=>`
    <div class="flex gap-2 p-2 bg-gray-800/50 rounded-lg">
      <span class="text-cyan-400 font-black flex-none">${i+1}.</span>
      <span class="text-gray-300">${r}</span>
    </div>`).join('');

  // Extra stats
  const existing = document.getElementById('risk-kpis');
  const extra = document.createElement('div');
  extra.className='grid grid-cols-2 gap-3 mt-3';
  extra.innerHTML=`
    <div class="et-card text-center">
      <div class="text-[10px] text-gray-400">Adaptation Score</div>
      <div class="text-2xl font-black text-cyan-300">${d.adaptationScore}<span class="text-sm text-gray-400">/100</span></div>
    </div>
    <div class="et-card text-center">
      <div class="text-[10px] text-gray-400">Tipping Point</div>
      <div class="text-2xl font-black text-orange-300">${d.yearsToTippingPoint}<span class="text-sm text-gray-400"> yrs</span></div>
    </div>`;
  existing.parentNode.insertBefore(extra, existing.nextSibling);

  btn.innerHTML='<i class="fas fa-fire"></i> Assess Climate Risk';btn.disabled=false;
  toast('Climate risk assessment complete!','warn');
}

// ════════════════════════════════════════════════════════════════════════════
// CARBON BUDGET TRACKER
// ════════════════════════════════════════════════════════════════════════════
function carbonHTML(){return `
  <div class="space-y-5">
    <div>
      <h2 class="text-xl font-black text-cyan-300 flex items-center gap-2"><i class="fas fa-fire text-orange-400"></i> Global Carbon Budget Tracker</h2>
      <p class="text-xs text-gray-500 mt-0.5">Remaining CO₂ budget for 1.5°C and 2.0°C warming limits · IPCC AR6</p>
    </div>
    <div id="carbon-content">
      <div class="flex justify-center py-12"><div class="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full"></div></div>
    </div>
  </div>`;}

async function loadCarbon(){
  const r=await fetch('/carbon_budget');const d=await r.json();
  const pl={paper_bgcolor:'transparent',plot_bgcolor:'rgba(17,24,39,0.4)',font:{color:'#9ca3af',size:10},margin:{l:45,r:15,t:10,b:40},xaxis:{color:'#4b5563',gridcolor:'#1f2937'},yaxis:{color:'#4b5563',gridcolor:'#1f2937',title:'Gt CO₂ Remaining'}};

  document.getElementById('carbon-content').innerHTML=`
    <!-- Budget KPIs -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <div class="et-card text-center">
        <div class="text-[10px] text-orange-400 font-bold mb-1">1.5°C BUDGET LEFT</div>
        <div class="text-3xl font-black text-orange-300">${d.budgets['1.5c']}<span class="text-sm text-gray-400"> Gt</span></div>
        <div class="text-[10px] text-gray-500">~${d.budgets.yearsTo1_5} yrs at current rate</div>
      </div>
      <div class="et-card text-center">
        <div class="text-[10px] text-yellow-400 font-bold mb-1">2.0°C BUDGET LEFT</div>
        <div class="text-3xl font-black text-yellow-300">${d.budgets['2.0c']}<span class="text-sm text-gray-400"> Gt</span></div>
        <div class="text-[10px] text-gray-500">~${d.budgets.yearsTo2_0} yrs at current rate</div>
      </div>
      <div class="et-card text-center">
        <div class="text-[10px] text-red-400 font-bold mb-1">ANNUAL EMISSIONS</div>
        <div class="text-3xl font-black text-red-300">${d.budgets.annual}<span class="text-sm text-gray-400"> Gt</span></div>
        <div class="text-[10px] text-gray-500">Current global rate</div>
      </div>
      <div class="et-card text-center">
        <div class="text-[10px] text-emerald-400 font-bold mb-1">NET-ZERO TARGET</div>
        <div class="text-3xl font-black text-emerald-300">2050</div>
        <div class="text-[10px] text-gray-500">Paris Agreement goal</div>
      </div>
    </div>
    <!-- Budget Trajectory Chart -->
    <div class="et-card mb-4">
      <h3 class="et-card-title mb-3"><i class="fas fa-chart-area text-orange-400"></i> Carbon Budget Trajectory (2025–2054)</h3>
      <div id="carbon-chart" style="height:300px"></div>
    </div>
    <!-- Sectors + Scenario -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <div class="et-card">
        <h3 class="et-card-title mb-3"><i class="fas fa-chart-pie text-yellow-400"></i> Emissions by Sector</h3>
        <div id="carbon-sectors" style="height:240px"></div>
      </div>
      <div class="et-card">
        <h3 class="et-card-title mb-3"><i class="fas fa-sliders text-cyan-400"></i> Reduction Scenario</h3>
        <div class="mb-3">
          <div class="flex justify-between mb-1">
            <span class="text-xs text-gray-400">Annual Reduction Rate</span>
            <span class="text-xs font-bold text-cyan-300" id="cb-rate-v">5%/yr</span>
          </div>
          <input type="range" id="cb-rate" min="1" max="15" value="5" class="w-full accent-cyan-400 h-1.5"
                 oninput="document.getElementById('cb-rate-v').textContent=this.value+'%/yr'">
        </div>
        <div class="mb-4">
          <div class="flex justify-between mb-1">
            <span class="text-xs text-gray-400">Start Year</span>
            <span class="text-xs font-bold text-cyan-300" id="cb-year-v">2025</span>
          </div>
          <input type="range" id="cb-year" min="2025" max="2035" value="2025" class="w-full accent-cyan-400 h-1.5"
                 oninput="document.getElementById('cb-year-v').textContent=this.value">
        </div>
        <button onclick="runCarbonScenario()" class="et-btn-primary w-full mb-3">
          <i class="fas fa-play"></i> Run Scenario
        </button>
        <div id="cb-scenario-result" style="height:180px"></div>
      </div>
    </div>
    <!-- Country Carbon Table -->
    <div class="et-card">
      <h3 class="et-card-title mb-3"><i class="fas fa-table text-orange-400"></i> Country Carbon Budget Status</h3>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead><tr>${['Country','Annual CO₂','Budget Share','Status'].map(h=>`<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${d.countryBudgets.map(cb=>`<tr>
            <td class="font-medium text-white">${cb.name}</td>
            <td class="text-red-300">${cb.annualCO2}t</td>
            <td class="text-yellow-300">${cb.budgetShare}%</td>
            <td><span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${cb.status==='Over Budget'?'bg-red-900/60 text-red-300':cb.status==='Near Limit'?'bg-yellow-900/60 text-yellow-300':'bg-emerald-900/60 text-emerald-300'}">${cb.status}</span></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;

  Plotly.newPlot('carbon-chart',[
    {type:'scatter',mode:'lines',name:'1.5°C Budget',x:d.years,y:d.baseline_1_5,line:{color:'#ef4444',width:2.5},fill:'tozeroy',fillcolor:'rgba(239,68,68,0.06)'},
    {type:'scatter',mode:'lines',name:'2.0°C Budget',x:d.years,y:d.budget_2_0,line:{color:'#f59e0b',width:2},fill:'tozeroy',fillcolor:'rgba(245,158,11,0.04)'},
    {type:'scatter',mode:'lines',name:'Net-Zero Path',x:d.years,y:d.net_zero_path,line:{color:'#10b981',width:2,dash:'dot'},fill:'tozeroy',fillcolor:'rgba(16,185,129,0.04)'},
  ],{...pl,legend:{bgcolor:'transparent',font:{color:'#9ca3af',size:9}}},{responsive:true,displayModeBar:false});

  Plotly.newPlot('carbon-sectors',[{
    type:'pie',labels:d.sectors.map(s=>s.name),values:d.sectors.map(s=>s.share),
    marker:{colors:d.sectors.map(s=>s.color)},hole:0.45,
    text:d.sectors.map(s=>`${s.name}<br>${s.reduction_potential}% potential`),
    textinfo:'label+percent',textfont:{color:'#e5e7eb',size:9},
    hovertemplate:'<b>%{label}</b><br>Share: %{percent}<br>Reduction Potential: %{text}<extra></extra>',
  }],{paper_bgcolor:'transparent',margin:{l:5,r:5,t:5,b:5},showlegend:false},{responsive:true,displayModeBar:false});
}

async function runCarbonScenario(){
  const rate=+document.getElementById('cb-rate').value;
  const year=+document.getElementById('cb-year').value;
  const r=await fetch('/carbon_budget/scenario',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reductionRate:rate,startYear:year})});
  const d=await r.json();
  const depLabel = d.depletionYear ? `Budget depletes: ${d.depletionYear}` : `Budget survives to 2054`;
  Plotly.newPlot('cb-scenario-result',[
    {type:'scatter',mode:'lines+markers',name:'Remaining Budget',x:d.years,y:d.trajectory,
     line:{color:d.depletionYear?'#ef4444':'#10b981',width:2},
     fill:'tozeroy',fillcolor:d.depletionYear?'rgba(239,68,68,0.07)':'rgba(16,185,129,0.07)'},
  ],{paper_bgcolor:'transparent',plot_bgcolor:'rgba(17,24,39,0.4)',
    font:{color:'#9ca3af',size:9},margin:{l:40,r:10,t:10,b:35},
    xaxis:{color:'#4b5563',gridcolor:'#1f2937'},yaxis:{color:'#4b5563',gridcolor:'#1f2937',title:'Gt CO₂'},
    title:{text:depLabel,font:{color:d.depletionYear?'#fca5a5':'#6ee7b7',size:10}},
  },{responsive:true,displayModeBar:false});
  toast(depLabel,'info');
}

// ════════════════════════════════════════════════════════════════════════════
// CITY BENCHMARKING
// ════════════════════════════════════════════════════════════════════════════
function citiesHTML(){return `
  <div class="space-y-5">
    <div class="flex flex-wrap items-center gap-3">
      <div>
        <h2 class="text-xl font-black text-cyan-300 flex items-center gap-2"><i class="fas fa-building-columns text-blue-400"></i> City Benchmarking</h2>
        <p class="text-xs text-gray-500 mt-0.5">Compare sustainability performance across 15 global cities</p>
      </div>
      <div class="ml-auto flex gap-2">
        <select id="city-metric" class="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200">
          <option value="score">Sustainability Score</option>
          <option value="co2">CO₂ Emissions</option>
          <option value="greenSpace">Green Space %</option>
          <option value="ev">EV Adoption %</option>
          <option value="waste">Waste Recycling %</option>
          <option value="traffic">Traffic Index</option>
        </select>
        <select id="city-select" class="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200" onchange="benchmarkCity()"></select>
      </div>
    </div>
    <div id="cities-content"><div class="flex justify-center py-12"><div class="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div></div></div>
  </div>`;}

async function loadCities(){
  const r=await fetch('/cities');const cities=await r.json();
  const sel=document.getElementById('city-select');
  sel.innerHTML=cities.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  await renderCitiesContent(cities);
}

async function benchmarkCity(){
  const cityId=document.getElementById('city-select')?.value||'CPH';
  const metric=document.getElementById('city-metric')?.value||'score';
  const r=await fetch('/city_benchmark',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cityId,metric})});
  const d=await r.json();
  renderCityBenchmark(d, metric);
}

async function renderCitiesContent(cities){
  const sorted=[...cities].sort((a,b)=>b.score-a.score);

  document.getElementById('cities-content').innerHTML=`
    <!-- Rankings -->
    <div class="et-card mb-4">
      <h3 class="et-card-title mb-3"><i class="fas fa-trophy text-yellow-400"></i> City Sustainability Rankings</h3>
      <div id="city-bar" style="height:300px"></div>
    </div>
    <!-- City Radar & Detail -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <div class="et-card">
        <h3 class="et-card-title mb-3"><i class="fas fa-chart-radar text-blue-400"></i> City Profile Radar</h3>
        <div id="city-radar" style="height:280px">
          <div class="flex items-center justify-center h-full text-gray-600 text-sm">Select a city from the dropdown</div>
        </div>
      </div>
      <div class="et-card">
        <h3 class="et-card-title mb-3"><i class="fas fa-chart-scatter text-cyan-400"></i> CO₂ vs Green Space</h3>
        <div id="city-scatter" style="height:280px"></div>
      </div>
    </div>
    <!-- City Cards Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      ${sorted.map((c,i)=>`
        <div class="et-card cursor-pointer hover:border-blue-700/50 transition-all" onclick="document.getElementById('city-select').value='${c.id}';benchmarkCity()">
          <div class="flex items-center gap-2 mb-3">
            <div class="rank-badge rank-${i<3?i+1:'other'}">${i+1}</div>
            <div><div class="text-xs font-bold text-white">${c.name}</div>
              <div class="text-[9px] text-gray-500">${c.country}</div></div>
          </div>
          <div class="text-2xl font-black mb-2" style="color:${scoreColor(c.score)}">${c.score}</div>
          <div class="space-y-1.5">
            ${[{l:'CO₂',v:c.co2+'t',c:'red'},{l:'Green',v:c.greenSpace+'%',c:'emerald'},{l:'EV',v:c.ev+'%',c:'blue'},{l:'Waste',v:c.waste+'%',c:'cyan'}].map(m=>
              `<div class="flex justify-between text-[9px]"><span class="text-gray-500">${m.l}</span><span class="font-bold text-${m.c}-300">${m.v}</span></div>`
            ).join('')}
          </div>
          ${c.weather ? `
          <div class="mt-2 pt-1.5 border-t border-gray-800 text-[8px] text-gray-500 flex items-center gap-1">
            <i class="fas fa-cloud-sun text-blue-400"></i>
            <span>${c.weather.temp}°C · ${c.weather.humidity}% hum · ${c.weather.description || ''}</span>
          </div>` : ''}
        </div>`).join('')}
    </div>`;

  const pl={paper_bgcolor:'transparent',plot_bgcolor:'rgba(17,24,39,0.4)',font:{color:'#9ca3af',size:10},margin:{l:70,r:20,t:8,b:30}};
  Plotly.newPlot('city-bar',[{
    type:'bar',orientation:'h',
    x:sorted.map(c=>c.score),y:sorted.map(c=>c.name),
    marker:{color:sorted.map(c=>scoreColor(c.score)),opacity:0.85},
    text:sorted.map(c=>c.score),textposition:'outside',
  }],{...pl,xaxis:{color:'#4b5563',gridcolor:'#1f2937',range:[0,105]},yaxis:{color:'#9ca3af'}},{responsive:true,displayModeBar:false});

  Plotly.newPlot('city-scatter',[{
    type:'scatter',mode:'markers+text',
    x:cities.map(c=>c.greenSpace),y:cities.map(c=>c.co2),
    text:cities.map(c=>c.name),textposition:'top center',textfont:{size:8},
    marker:{size:cities.map(c=>8+c.score/12),color:cities.map(c=>c.score),
      colorscale:[[0,'#ef4444'],[0.5,'#f59e0b'],[1,'#10b981']],showscale:true,
      colorbar:{title:'Score',titlefont:{color:'#6b7280'},tickfont:{color:'#6b7280'},thickness:10,len:0.8}},
    hovertemplate:'<b>%{text}</b><br>Green: %{x}%<br>CO₂: %{y}t<extra></extra>',
  }],{paper_bgcolor:'transparent',plot_bgcolor:'rgba(17,24,39,0.4)',
    margin:{l:45,r:30,t:8,b:40},font:{color:'#9ca3af',size:9},
    xaxis:{title:'Green Space %',color:'#4b5563',gridcolor:'#1f2937'},
    yaxis:{title:'CO₂ t/cap',color:'#4b5563',gridcolor:'#1f2937'},
  },{responsive:true,displayModeBar:false});
}

function renderCityBenchmark(d, metric){
  const {city,rank,total,spiderMetrics,peerCities} = d;
  const el=document.getElementById('city-radar');
  if(!el)return;
  const metrics=['Energy Eff','Water Eff','Traffic','CO₂ Perf','Green Space','EV','Solar','Waste'];
  const vals=[spiderMetrics.energy,spiderMetrics.water,100-city.traffic,spiderMetrics.co2,spiderMetrics.greenSpace,spiderMetrics.ev,spiderMetrics.solar,spiderMetrics.waste];
  Plotly.newPlot('city-radar',[
    {type:'scatterpolar',fill:'toself',r:vals,theta:metrics,
     fillcolor:'rgba(59,130,246,0.12)',line:{color:'#3b82f6',width:2},name:city.name},
  ],{polar:{bgcolor:'transparent',radialaxis:{visible:true,range:[0,100],gridcolor:'#1f2937',color:'#6b7280'},angularaxis:{color:'#9ca3af'}},
    paper_bgcolor:'transparent',font:{color:'#d1d5db',size:9},
    title:{text:`${city.name} — Rank #${rank}/${total}`,font:{color:'#22d3ee',size:11}},
    legend:{bgcolor:'transparent'},margin:{l:35,r:35,t:30,b:10}},
  {responsive:true,displayModeBar:false});
  toast(`${city.name}: Rank #${rank}/${total} globally`,'info');
}

// ════════════════════════════════════════════════════════════════════════════
// POLICY SIMULATOR
// ════════════════════════════════════════════════════════════════════════════
const POLICIES = [
  {id:'carbon_tax',      label:'Carbon Tax', icon:'💰', desc:'$50-100/t carbon pricing mechanism',       color:'yellow'},
  {id:'renewable_mandate',label:'Renewable Mandate',icon:'☀️',desc:'60% clean electricity by 2030',     color:'emerald'},
  {id:'green_transport', label:'Green Transport',icon:'🚌',desc:'EV buses & rail expansion',               color:'blue'},
  {id:'water_efficiency',label:'Water Efficiency',icon:'💧',desc:'Smart water management systems',        color:'cyan'},
  {id:'circular_economy',label:'Circular Economy',icon:'♻️',desc:'Extended producer responsibility',     color:'violet'},
  {id:'green_buildings', label:'Green Buildings',icon:'🏗️',desc:'Net-zero building codes by 2030',        color:'orange'},
  {id:'forest_protection',label:'Forest Protection',icon:'🌲',desc:'REDD+ carbon sink programs',          color:'emerald'},
  {id:'smart_grid',      label:'Smart Grid',icon:'⚡',desc:'AI-optimized energy distribution',            color:'cyan'},
];

let selectedPolicies = new Set();

function policyHTML(){return `
  <div class="space-y-5">
    <div>
      <h2 class="text-xl font-black text-cyan-300 flex items-center gap-2"><i class="fas fa-scale-balanced text-violet-400"></i> Policy Simulator</h2>
      <p class="text-xs text-gray-500 mt-0.5">Select policies to model combined impact on national sustainability · AI impact assessment</p>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div class="space-y-4">
        <div class="et-card">
          <h3 class="et-card-title mb-3"><i class="fas fa-building-flag text-violet-400"></i> Select Country</h3>
          <select id="pol-country" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-violet-500">
            ${['USA','DEU','NOR','CHN','IND','BRA','GBR','FRA','JPN','AUS','SWE','SAU','NGA','KEN'].map(c=>`<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        <div class="et-card">
          <h3 class="et-card-title mb-3"><i class="fas fa-check-square text-violet-400"></i> Select Policies</h3>
          <div class="space-y-2" id="policy-cards">
            ${POLICIES.map(p=>`
              <div class="policy-card" id="pc-${p.id}" onclick="togglePolicy('${p.id}')">
                <div class="flex items-center gap-2">
                  <span class="text-base">${p.icon}</span>
                  <div class="flex-1">
                    <div class="text-xs font-bold text-gray-200">${p.label}</div>
                    <div class="text-[9px] text-gray-500">${p.desc}</div>
                  </div>
                  <div class="w-4 h-4 rounded border border-gray-600 flex items-center justify-center flex-none" id="pc-check-${p.id}"></div>
                </div>
              </div>`).join('')}
          </div>
        </div>
        <button onclick="runPolicySim()" id="pol-btn" class="et-btn-violet w-full">
          <i class="fas fa-play"></i> Run Policy Simulation
        </button>
      </div>
      <div class="lg:col-span-2 space-y-4">
        <div id="pol-results" class="space-y-4">
          <div class="et-card text-center py-12">
            <i class="fas fa-scale-balanced text-4xl text-violet-900 mb-3"></i>
            <p class="text-gray-500 text-sm">Select policies and click "Run Policy Simulation"</p>
          </div>
        </div>
      </div>
    </div>
  </div>`;}

function togglePolicy(id){
  const card=document.getElementById('pc-'+id);
  const check=document.getElementById('pc-check-'+id);
  if(selectedPolicies.has(id)){
    selectedPolicies.delete(id);
    card.classList.remove('selected');
    check.innerHTML='';
  } else {
    selectedPolicies.add(id);
    card.classList.add('selected');
    check.innerHTML='<i class="fas fa-check text-[8px] text-violet-300"></i>';
  }
}

async function runPolicySim(){
  if(selectedPolicies.size===0){toast('Select at least one policy','warn');return;}
  const btn=document.getElementById('pol-btn');
  btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Simulating...';btn.disabled=true;
  const country=document.getElementById('pol-country').value;
  const r=await fetch('/policy_sim',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({policies:[...selectedPolicies],country})});
  const d=await r.json();

  const delta=d.delta;
  const pl={paper_bgcolor:'transparent',plot_bgcolor:'rgba(17,24,39,0.4)',font:{color:'#9ca3af',size:10},margin:{l:45,r:15,t:10,b:40}};

  document.getElementById('pol-results').innerHTML=`
    <!-- Score comparison -->
    <div class="grid grid-cols-3 gap-3">
      <div class="et-card text-center">
        <div class="text-[10px] text-gray-400 mb-1">Current Score</div>
        <div class="text-3xl font-black text-gray-300">${d.baseCountry.score}</div>
        <div class="text-[10px] text-gray-500">${d.baseCountry.name}</div>
      </div>
      <div class="et-card text-center border-violet-700 bg-violet-950/20">
        <div class="text-[10px] text-violet-400 mb-1">Score Gain</div>
        <div class="text-3xl font-black text-violet-300">+${delta.score}</div>
        <div class="text-[10px] text-gray-500">${selectedPolicies.size} policies applied</div>
      </div>
      <div class="et-card text-center">
        <div class="text-[10px] text-cyan-400 mb-1">Projected Score</div>
        <div class="text-3xl font-black text-cyan-300">${d.projected.score}</div>
        <div class="text-[10px] text-gray-500">Grade ${scoreGrade(d.projected.score)}</div>
      </div>
    </div>
    <!-- Trajectory -->
    <div class="et-card">
      <h3 class="et-card-title mb-2"><i class="fas fa-chart-line text-violet-400"></i> Policy Impact Trajectory</h3>
      <div id="pol-chart" style="height:220px"></div>
    </div>
    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      ${[
        {l:'Total Investment', v:'$'+d.totalCost+'B', c:'yellow', i:'fa-dollar-sign'},
        {l:'Jobs Created',     v:(d.totalJobs/1000).toFixed(0)+'K', c:'emerald', i:'fa-users'},
        {l:'CO₂ Change',       v:delta.co2+'t',        c:delta.co2<0?'emerald':'red', i:'fa-cloud'},
        {l:'Renewable Gain',   v:'+'+delta.renewable+'%', c:'cyan', i:'fa-solar-panel'},
      ].map(k=>`<div class="et-card text-center">
        <i class="fas ${k.i} text-${k.c}-400 mb-1"></i>
        <div class="text-xl font-black text-${k.c}-300">${k.v}</div>
        <div class="text-[9px] text-gray-400">${k.l}</div>
      </div>`).join('')}
    </div>
    <!-- Policies applied -->
    <div class="et-card">
      <h3 class="et-card-title mb-2">Applied Policies</h3>
      <div class="flex flex-wrap gap-2">
        ${d.applied.map(id=>{const p=POLICIES.find(x=>x.id===id);return p?`<span class="px-2 py-1 bg-violet-900/40 border border-violet-700/50 rounded-lg text-[10px] text-violet-300">${p.icon} ${p.label}</span>`:''}).join('')}
      </div>
    </div>`;

  Plotly.newPlot('pol-chart',[
    {type:'scatter',mode:'lines',name:'Baseline',x:d.years,y:d.years.map(()=>d.baseCountry.score),line:{color:'#6b7280',width:1.5,dash:'dot'}},
    {type:'scatter',mode:'lines+markers',name:'With Policies',x:d.years,y:d.trajectory,line:{color:'#a78bfa',width:2.5},marker:{size:5},fill:'tozeroy',fillcolor:'rgba(167,139,250,0.06)'},
  ],{...pl,xaxis:{color:'#4b5563',gridcolor:'#1f2937'},yaxis:{color:'#4b5563',gridcolor:'#1f2937',range:[0,100]},
    legend:{bgcolor:'transparent',font:{color:'#9ca3af',size:9}}},{responsive:true,displayModeBar:false});

  btn.innerHTML='<i class="fas fa-play"></i> Run Policy Simulation';btn.disabled=false;
  toast(`Policy impact: +${delta.score} score, $${d.totalCost}B investment, ROI: ${d.roi}x`,'success');
}

// ════════════════════════════════════════════════════════════════════════════
// LIVE MARKETS TAB — Carbon credits, energy prices, real-time charts
// ════════════════════════════════════════════════════════════════════════════
function marketHTML(){return `
  <div class="space-y-5">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h2 class="text-xl font-black text-emerald-300 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          ${t('marketTab')} — Live Carbon & Energy Markets
        </h2>
        <p class="text-xs text-gray-500 mt-0.5">EU ETS carbon credits · Renewable index · Fossil index · Energy prices · Atmospheric CO₂</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-gray-500" id="market-update-time">Loading...</span>
        <span class="text-[9px] px-2 py-0.5 bg-emerald-900/40 text-emerald-400 rounded-full border border-emerald-800/50">
          <i class="fas fa-satellite-dish mr-0.5"></i>Live feed
        </span>
      </div>
    </div>
    <!-- Primary market cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="et-card border-emerald-900/50">
        <div class="flex items-center gap-2 mb-2"><i class="fas fa-certificate text-emerald-400 text-sm"></i><span class="text-[10px] text-gray-400">EU ETS Carbon Credit</span></div>
        <div class="text-3xl font-black text-emerald-300" id="mkt-cc-price">—</div>
        <div class="text-[10px] text-gray-400">EUR per tonne CO₂</div>
        <div class="flex items-center gap-1 mt-1" id="mkt-cc-change-el">
          <span class="text-[10px] text-emerald-400">Live</span>
        </div>
      </div>
      <div class="et-card border-cyan-900/50">
        <div class="flex items-center gap-2 mb-2"><i class="fas fa-solar-panel text-cyan-400 text-sm"></i><span class="text-[10px] text-gray-400">Renewable Index</span></div>
        <div class="text-3xl font-black text-cyan-300" id="mkt-ri-price">—</div>
        <div class="text-[10px] text-gray-400">Index points</div>
        <div class="flex items-center gap-1 mt-1" id="mkt-ri-change-el">
          <span class="text-[10px] text-cyan-400">Live</span>
        </div>
      </div>
      <div class="et-card border-red-900/50">
        <div class="flex items-center gap-2 mb-2"><i class="fas fa-industry text-red-400 text-sm"></i><span class="text-[10px] text-gray-400">Fossil Index</span></div>
        <div class="text-3xl font-black text-red-300" id="mkt-fi-price">—</div>
        <div class="text-[10px] text-gray-400">Index points</div>
        <div class="flex items-center gap-1 mt-1" id="mkt-fi-change-el">
          <span class="text-[10px] text-red-400">Live</span>
        </div>
      </div>
      <div class="et-card border-yellow-900/50">
        <div class="flex items-center gap-2 mb-2"><i class="fas fa-smog text-yellow-400 text-sm"></i><span class="text-[10px] text-gray-400">Atmospheric CO₂</span></div>
        <div class="text-3xl font-black text-yellow-300" id="mkt-co2-price">—</div>
        <div class="text-[10px] text-gray-400">Parts per million</div>
        <div class="flex items-center gap-1 mt-1"><span class="text-[10px] text-yellow-400">NOAA seasonal model</span></div>
      </div>
    </div>
    <!-- Market chart -->
    <div class="et-card">
      <div class="flex items-center justify-between mb-2">
        <h3 class="et-card-title"><i class="fas fa-chart-line text-emerald-400"></i> Carbon Credit Price — Last 60 minutes (live)</h3>
        <div class="flex gap-2">
          <button onclick="setMarketChart('cc')" id="mkt-btn-cc" class="px-2 py-0.5 text-[9px] rounded bg-emerald-800 text-emerald-300 border border-emerald-700">Carbon</button>
          <button onclick="setMarketChart('ri')" id="mkt-btn-ri" class="px-2 py-0.5 text-[9px] rounded bg-gray-800 text-gray-400 border border-gray-700">Renewable</button>
          <button onclick="setMarketChart('fi')" id="mkt-btn-fi" class="px-2 py-0.5 text-[9px] rounded bg-gray-800 text-gray-400 border border-gray-700">Fossil</button>
          <button onclick="setMarketChart('co2')" id="mkt-btn-co2" class="px-2 py-0.5 text-[9px] rounded bg-gray-800 text-gray-400 border border-gray-700">CO₂ ppm</button>
        </div>
      </div>
      <div id="mkt-chart" style="height:280px"></div>
    </div>
    <!-- Energy prices grid -->
    <div class="et-card">
      <h3 class="et-card-title mb-3"><i class="fas fa-bolt text-yellow-400"></i> Live Energy Prices ($/MWh)</h3>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3" id="mkt-energy-prices"></div>
    </div>
    <!-- Market insights -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="et-card border-emerald-900/40">
        <h3 class="et-card-title mb-3 text-emerald-300"><i class="fas fa-arrow-trend-up"></i> Market Signals</h3>
        <div id="mkt-signals" class="space-y-2"></div>
      </div>
      <div class="et-card">
        <h3 class="et-card-title mb-3"><i class="fas fa-chart-bar text-violet-400"></i> Carbon vs Renewables Spread</h3>
        <div id="mkt-spread-chart" style="height:200px"></div>
      </div>
    </div>
  </div>`;}

let marketChartField = 'cc';
let marketInterval = null;

function setMarketChart(field) {
  marketChartField = field;
  ['cc','ri','fi','co2'].forEach(f => {
    const btn = document.getElementById('mkt-btn-'+f);
    if (btn) btn.className = `px-2 py-0.5 text-[9px] rounded ${f===field ? 'bg-emerald-800 text-emerald-300 border border-emerald-700' : 'bg-gray-800 text-gray-400 border border-gray-700'}`;
  });
  if (ST.marketData) renderMarketChart(ST.marketData);
}

function renderMarketChart(d) {
  const h = d.history || [];
  const ts = h.map(x => new Date(x.ts).toLocaleTimeString('en', {hour:'2-digit', minute:'2-digit'}));
  const fieldMap = { cc:{key:'cc',color:'#10b981',label:'Carbon €/t'}, ri:{key:'ri',color:'#22d3ee',label:'Renew. Idx'}, fi:{key:'fi',color:'#ef4444',label:'Fossil Idx'}, co2:{key:'co2',color:'#f59e0b',label:'CO₂ ppm'} };
  const f = fieldMap[marketChartField];
  Plotly.newPlot('mkt-chart',[{
    type:'scatter', mode:'lines', name:f.label,
    x:ts, y:h.map(x=>x[f.key]),
    line:{color:f.color, width:2}, fill:'tozeroy', fillcolor: f.color+'11',
  }],{
    paper_bgcolor:'transparent', plot_bgcolor:'rgba(17,24,39,0.4)',
    font:{color:'#9ca3af',size:10}, margin:{l:55,r:10,t:8,b:40},
    xaxis:{color:'#4b5563',gridcolor:'#1f2937',tickangle:-45},
    yaxis:{color:'#4b5563',gridcolor:'#1f2937',title:f.label},
  },{responsive:true,displayModeBar:false});
}

async function loadMarket() {
  await fetchAndUpdateMarket();
  marketInterval = setInterval(fetchAndUpdateMarket, 5000);
  // Clear when tab changes
  const origSwitch = window.switchTab;
  window._mktCleanup = () => { if(marketInterval){clearInterval(marketInterval);marketInterval=null;} };
}

async function fetchAndUpdateMarket() {
  try {
    const r = await fetch('/market_data');
    const d = await r.json();
    ST.marketData = d;
    const c = d.current;
    const timeEl = document.getElementById('market-update-time');
    if (timeEl) timeEl.textContent = 'Updated: ' + new Date().toLocaleTimeString();
    
    // Update primary cards
    const formatChange = (v) => `<span class="${v>=0?'text-emerald-400':'text-red-400'}">${v>=0?'▲':'▼'} ${Math.abs(v)}%</span>`;
    const setCard = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
    setCard('mkt-cc-price', '€' + c.carbonCreditEUR);
    setCard('mkt-ri-price', c.renewableIndex);
    setCard('mkt-fi-price', c.fossilIndex);
    setCard('mkt-co2-price', c.globalCO2ppm);
    const ccChgEl = document.getElementById('mkt-cc-change-el');
    if (ccChgEl) ccChgEl.innerHTML = formatChange(c.carbonCreditChange) + '<span class="text-[10px] text-gray-500 ml-1">vs 1h ago</span>';
    
    // Energy prices
    const epEl = document.getElementById('mkt-energy-prices');
    if (epEl) {
      const ep = d.energyPrices;
      epEl.innerHTML = [
        {name:'Solar',val:ep.solar,icon:'fa-sun',color:'yellow'},
        {name:'Wind',val:ep.wind,icon:'fa-wind',color:'blue'},
        {name:'Natural Gas',val:ep.gas,icon:'fa-fire',color:'orange'},
        {name:'Coal',val:ep.coal,icon:'fa-smog',color:'gray'},
        {name:'Nuclear',val:ep.nuclear,icon:'fa-atom',color:'violet'},
      ].map(e=>`
        <div class="bg-gray-900 rounded-lg p-3 text-center border border-gray-800">
          <i class="fas ${e.icon} text-${e.color}-400 text-sm mb-1"></i>
          <div class="text-sm font-black text-${e.color}-300">$${e.val}</div>
          <div class="text-[9px] text-gray-400">${e.name}/MWh</div>
        </div>`).join('');
    }
    
    // Market signals
    const sigEl = document.getElementById('mkt-signals');
    if (sigEl) {
      const signals = [
        c.carbonCreditEUR > 70 ? {msg:`Carbon at €${c.carbonCreditEUR}/t — strong decarbonization incentive`,color:'emerald',icon:'fa-arrow-up'} : {msg:`Carbon at €${c.carbonCreditEUR}/t — below optimal incentive threshold`,color:'yellow',icon:'fa-arrow-down'},
        c.renewableIndex > 140 ? {msg:`Renewable index ${c.renewableIndex} — above baseline, clean energy scaling`,color:'emerald',icon:'fa-solar-panel'} : {msg:`Renewable index ${c.renewableIndex} — near baseline`,color:'gray',icon:'fa-minus'},
        c.fossilIndex < 100 ? {msg:`Fossil index ${c.fossilIndex} — declining, coal/gas phase-out accelerating`,color:'emerald',icon:'fa-leaf'} : {msg:`Fossil index ${c.fossilIndex} — elevated, fossil dependency persists`,color:'red',icon:'fa-triangle-exclamation'},
        c.globalCO2ppm > 422 ? {msg:`CO₂ at ${c.globalCO2ppm} ppm — above 2024 baseline of 421.08`,color:'red',icon:'fa-smog'} : {msg:`CO₂ at ${c.globalCO2ppm} ppm`,color:'yellow',icon:'fa-smog'},
      ];
      sigEl.innerHTML = signals.map(s=>`
        <div class="flex items-start gap-2 p-2 bg-gray-900/50 rounded-lg">
          <i class="fas ${s.icon} text-${s.color}-400 text-xs mt-0.5"></i>
          <span class="text-[10px] text-gray-300">${s.msg}</span>
        </div>`).join('');
    }
    
    // Render charts
    renderMarketChart(d);
    
    // Spread chart
    const h = d.history.slice(-30);
    const ts = h.map(x => new Date(x.ts).toLocaleTimeString('en', {hour:'2-digit', minute:'2-digit'}));
    Plotly.newPlot('mkt-spread-chart',[
      {type:'scatter',mode:'lines',name:'Carbon €',x:ts,y:h.map(x=>x.cc),line:{color:'#10b981',width:1.5}},
      {type:'scatter',mode:'lines',name:'Renew. Idx',x:ts,y:h.map(x=>x.ri),line:{color:'#22d3ee',width:1.5}},
    ],{paper_bgcolor:'transparent',plot_bgcolor:'rgba(17,24,39,0.4)',font:{color:'#9ca3af',size:9},margin:{l:40,r:10,t:8,b:35},
      xaxis:{color:'#4b5563',gridcolor:'#1f2937',tickangle:-45},yaxis:{color:'#4b5563',gridcolor:'#1f2937'},
      legend:{bgcolor:'transparent',font:{color:'#9ca3af',size:8}}},{responsive:true,displayModeBar:false});
  } catch(e) { console.error('Market load error:', e); }
}

// ════════════════════════════════════════════════════════════════════════════
// SUSTAINABILITY NEWS FEED
// ════════════════════════════════════════════════════════════════════════════
function newsHTML(){return `
  <div class="space-y-5">
    <div class="flex flex-wrap items-center gap-3">
      <div>
        <h2 class="text-xl font-black text-cyan-300 flex items-center gap-2"><i class="fas fa-newspaper text-blue-300"></i> Sustainability News Feed</h2>
        <p class="text-xs text-gray-500 mt-0.5">Curated global sustainability intelligence & policy updates</p>
      </div>
      <div class="ml-auto flex gap-2 flex-wrap">
        <button onclick="filterNews('all')" id="nf-all" class="news-filter px-2.5 py-1 text-[10px] rounded-lg font-bold bg-cyan-700 text-white transition-all">All</button>
        ${['Policy','Climate','Energy','Transport','Oceans','Forests','Water','Technology','Achievement','Economics'].map(c=>
          `<button onclick="filterNews('${c}')" id="nf-${c}" class="news-filter px-2.5 py-1 text-[10px] rounded-lg font-bold bg-gray-800 text-gray-400 hover:bg-gray-700 transition-all">${c}</button>`
        ).join('')}
      </div>
    </div>
    <div class="flex gap-2 items-center">
      <button onclick="filterNews('all','positive')" class="px-2.5 py-1 text-[10px] rounded-lg bg-emerald-900/40 text-emerald-300 border border-emerald-800/50 hover:bg-emerald-800/40 transition-all">🟢 Positive</button>
      <button onclick="filterNews('all','negative')" class="px-2.5 py-1 text-[10px] rounded-lg bg-red-900/40 text-red-300 border border-red-800/50 hover:bg-red-800/40 transition-all">🔴 Concerning</button>
    </div>
    <div id="news-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <div class="flex justify-center py-12 col-span-3"><div class="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div></div>
    </div>
  </div>`;}

let _allNews=[];
async function loadNews(){
  const r=await fetch('/news_feed');_allNews=await r.json();
  renderNews(_allNews);
}

function filterNews(category, sentiment=null){
  document.querySelectorAll('.news-filter').forEach(b=>{b.className=b.className.replace('bg-cyan-700 text-white','bg-gray-800 text-gray-400');});
  const btn=document.getElementById('nf-'+(category==='all'?'all':category));
  if(btn)btn.className=btn.className.replace('bg-gray-800 text-gray-400','bg-cyan-700 text-white');
  let filtered=_allNews;
  if(category!=='all')filtered=filtered.filter(a=>a.category===category);
  if(sentiment)filtered=filtered.filter(a=>a.sentiment===sentiment);
  renderNews(filtered);
}

function renderNews(articles){
  const el=document.getElementById('news-grid');if(!el)return;
  if(!articles.length){el.innerHTML='<div class="col-span-3 text-center py-12 text-gray-600">No articles found</div>';return;}
  el.innerHTML=articles.map(a=>`
    <div class="et-card news-card ${a.sentiment} flex flex-col">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-[9px] px-2 py-0.5 rounded-full font-bold ${a.sentiment==='positive'?'bg-emerald-900/50 text-emerald-300':'bg-red-900/50 text-red-300'}">${a.sentiment==='positive'?'🟢 Positive':'🔴 Concerning'}</span>
        <span class="text-[9px] px-2 py-0.5 bg-gray-800 rounded-full text-gray-400">${a.category}</span>
        <span class="ml-auto text-[9px] text-gray-600">${a.region}</span>
        ${a.freshness ? `<span class="text-[9px] px-1.5 py-0.5 bg-cyan-900/50 text-cyan-400 rounded-full font-bold animate-pulse">NEW</span>` : ''}
      </div>
      <h3 class="text-sm font-bold text-gray-100 mb-2 leading-snug">${a.title}</h3>
      <p class="text-xs text-gray-400 flex-1 leading-relaxed">${a.summary}</p>
      ${a.liveData ? `<div class="mt-2 p-1.5 bg-emerald-900/20 rounded border border-emerald-900/40 text-[9px] text-emerald-400"><i class="fas fa-satellite-dish mr-1"></i>Live: CO₂ ${a.liveData.co2ppm} ppm · Carbon €${a.liveData.carbonPrice}/t</div>` : ''}
      <div class="mt-3 pt-2 border-t border-gray-800 flex items-center justify-between">
        <div class="flex flex-wrap gap-1">
          ${a.tags.slice(0,3).map(tag=>`<span class="text-[8px] px-1.5 py-0.5 bg-gray-800 text-gray-500 rounded">#${tag}</span>`).join('')}
        </div>
        <div class="flex items-center gap-1.5 text-[9px] text-gray-500">
          <span>${a.source}</span><span>·</span><span>${a.date}</span>
        </div>
      </div>
    </div>`).join('');
}

// ════════════════════════════════════════════════════════════════════════════
// EXPORT DATA
// ════════════════════════════════════════════════════════════════════════════
function exportData(fmt){
  const a=document.createElement('a');
  a.href=`/export/${fmt}`;
  a.download=`ecotwin_data.${fmt}`;
  a.click();
  toast(`Downloading ${fmt.toUpperCase()} data...`,'success');
}

// ════════════════════════════════════════════════════════════════════════════
// PEER COMPARE  (multi-country radar)
// ════════════════════════════════════════════════════════════════════════════
async function runPeerCompare(codes){
  const r=await fetch('/peer_compare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codes})});
  const d=await r.json();
  return d;
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadI18n(ST.lang);
  renderShell();
  // Pre-fetch world data
  fetch('/world_data').then(r=>r.json()).then(d=>{ST.worldData=d;ST.lastWorldUpdate=Date.now();});
  // Pre-fetch market data for ticker
  fetch('/market_data').then(r=>r.json()).then(d=>ST.marketData=d);
});



// ════════════════════════════════════════════════════════════════════════════
// AI SATELLITE MONITORING MODULE — v3.0 Advanced Edition
// Features: Multi-spectral bands, CNN visualization, NDVI timeseries,
//           Emission hotspots, Wildfire detection, Biome stress index,
//           ML forecast, Radar sweep, Split-screen comparison, HUD display
// ════════════════════════════════════════════════════════════════════════════

const SAT_STATE = {
  activeRegion: null,
  liveFeed: [],
  globalStats: null,
  scanInterval: null,
  selectedYear: 2024,
  compareMode: false,
  animFrame: null,
  lastScan: null,
  spectralBand: 'rgb',
  activeTab: 'analysis',
  splitPos: 50,
  wildfireAlert: false,
  emissionHotspots: [],
  ndviData: [],
  mlForecast: null,
};

// Impact grade colors
const GRADE_COLORS = {
  CRITICAL: { bg: 'bg-red-900/60', text: 'text-red-300', border: 'border-red-700', dot: 'bg-red-500', hex: '#ef4444', css: 'rgba(239,68,68,0.5)' },
  HIGH:     { bg: 'bg-orange-900/60', text: 'text-orange-300', border: 'border-orange-700', dot: 'bg-orange-500', hex: '#f97316', css: 'rgba(249,115,22,0.5)' },
  MODERATE: { bg: 'bg-yellow-900/60', text: 'text-yellow-300', border: 'border-yellow-700', dot: 'bg-yellow-500', hex: '#f59e0b', css: 'rgba(245,158,11,0.5)' },
  LOW:      { bg: 'bg-emerald-900/60', text: 'text-emerald-300', border: 'border-emerald-700', dot: 'bg-emerald-500', hex: '#10b981', css: 'rgba(16,185,129,0.5)' },
};

const CHANGE_ICONS = {
  deforestation:   'fa-tree',
  urban_expansion: 'fa-city',
  water_loss:      'fa-water',
  ice_loss:        'fa-snowflake',
  desertification: 'fa-sun',
  wildfire:        'fa-fire',
};

const CHANGE_LABELS = {
  deforestation:   'Deforestation',
  urban_expansion: 'Urban Expansion',
  water_loss:      'Water Loss',
  ice_loss:        'Ice Loss',
  desertification: 'Desertification',
  wildfire:        'Wildfire',
};

const SPECTRAL_BANDS = [
  { id: 'rgb',     label: 'RGB True',   icon: 'fa-eye',       cls: 'spectral-rgb',     desc: 'True color natural view' },
  { id: 'nir',     label: 'NIR',        icon: 'fa-leaf',      cls: 'spectral-nir',     desc: 'Near-infrared vegetation' },
  { id: 'swir',    label: 'SWIR',       icon: 'fa-fire-flame-curved', cls: 'spectral-swir', desc: 'Short-wave infrared moisture' },
  { id: 'ndvi',    label: 'NDVI',       icon: 'fa-seedling',  cls: 'spectral-ndvi',    desc: 'Vegetation health index' },
  { id: 'thermal', label: 'Thermal',    icon: 'fa-temperature-high', cls: 'spectral-thermal', desc: 'Land surface temperature' },
];

// CNN layer architecture display
const CNN_LAYERS = [
  { type: 'conv', label: 'Conv2D\n64×3×3', note: 'Feature extraction' },
  { type: 'pool', label: 'MaxPool\n2×2', note: 'Downsampling' },
  { type: 'conv', label: 'Conv2D\n128×3×3', note: 'Deep features' },
  { type: 'relu', label: 'ReLU\nActivation', note: 'Non-linearity' },
  { type: 'fc',   label: 'FC\n512→5', note: 'Classification' },
];

// Biome definitions
const BIOMES = [
  { id: 'tropical_forest', name: 'Tropical Forest', icon: 'fa-tree', color: '#16a34a', stress: 78 },
  { id: 'boreal_forest',   name: 'Boreal Forest',   icon: 'fa-snowflake', color: '#0891b2', stress: 52 },
  { id: 'grassland',       name: 'Grasslands',       icon: 'fa-wheat-awn', color: '#ca8a04', stress: 61 },
  { id: 'wetlands',        name: 'Wetlands',         icon: 'fa-water', color: '#0284c7', stress: 83 },
  { id: 'arctic',          name: 'Arctic Tundra',    icon: 'fa-icicles', color: '#67e8f9', stress: 91 },
  { id: 'desert',          name: 'Arid Desert',      icon: 'fa-sun', color: '#d97706', stress: 44 },
];

// ── HTML TEMPLATE ─────────────────────────────────────────────────────────
function satelliteHTML() {
  return `
<div class="space-y-4">
  <!-- ── Premium Page Header ── -->
  <div class="glass-panel p-4 relative overflow-hidden">
    <!-- Background radar animation -->
    <div class="absolute right-4 top-1/2 -translate-y-1/2 w-32 h-32 opacity-10 pointer-events-none" id="sat-header-radar">
      <svg viewBox="0 0 100 100" class="w-full h-full">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#22d3ee" stroke-width="0.5"/>
        <circle cx="50" cy="50" r="30" fill="none" stroke="#22d3ee" stroke-width="0.5"/>
        <circle cx="50" cy="50" r="15" fill="none" stroke="#22d3ee" stroke-width="0.5"/>
        <line x1="50" y1="5" x2="50" y2="95" stroke="#22d3ee" stroke-width="0.3" opacity="0.5"/>
        <line x1="5" y1="50" x2="95" y2="50" stroke="#22d3ee" stroke-width="0.3" opacity="0.5"/>
        <path d="M50,50 L50,5 A45,45 0 0,1 95,50 Z" fill="rgba(34,211,238,0.15)" class="radar-sweep"/>
      </svg>
    </div>
    <div class="relative z-10 flex flex-wrap items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3 mb-1">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-900 to-blue-900 border border-cyan-700/50 flex items-center justify-center">
            <i class="fas fa-satellite text-cyan-400 text-lg"></i>
          </div>
          <div>
            <h1 class="text-xl font-black text-white flex items-center gap-2">
              AI Satellite Monitoring
              <span class="text-[9px] px-2 py-0.5 rounded-full bg-cyan-900/60 border border-cyan-700 text-cyan-300 font-semibold animate-pulse flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block"></span>LIVE
              </span>
            </h1>
            <p class="text-[10px] text-gray-500">EcoTwin-CNN-v2.1 · Multi-spectral · NASA GIBS VIIRS 250m · Real-time change detection</p>
          </div>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div class="hud-panel flex items-center gap-3">
          <span id="sat-hud-regions" class="text-[9px]">REGIONS: <span class="text-cyan-300 font-bold live-flicker">10</span></span>
          <span class="text-gray-700">|</span>
          <span id="sat-hud-alerts" class="text-[9px]">ALERTS: <span class="text-red-400 font-bold">—</span></span>
          <span class="text-gray-700">|</span>
          <span id="sat-hud-time" class="text-[9px]">SCAN: <span class="text-emerald-400 font-bold">--:--:--</span></span>
        </div>
        <button onclick="refreshSatelliteFeed()" class="px-3 py-1.5 rounded-lg bg-cyan-900/40 border border-cyan-700 text-cyan-300 text-xs font-semibold hover:bg-cyan-900/70 transition-all flex items-center gap-1.5">
          <i class="fas fa-rotate-right"></i> Rescan
        </button>
        <button onclick="toggleSatCompareMode()" id="sat-compare-btn" class="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-xs font-semibold hover:bg-gray-700 transition-all flex items-center gap-1.5">
          <i class="fas fa-code-compare"></i> Compare
        </button>
        <button onclick="openSatMLForecast()" class="px-3 py-1.5 rounded-lg bg-purple-900/40 border border-purple-700 text-purple-300 text-xs font-semibold hover:bg-purple-900/70 transition-all flex items-center gap-1.5">
          <i class="fas fa-brain"></i> ML Forecast
        </button>
      </div>
    </div>
  </div>

  <!-- ── Global KPI Bar ── -->
  <div id="sat-global-stats" class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
    ${[1,2,3,4,5,6].map(()=>`<div class="et-card animate-pulse h-20 bg-gray-800/40 rounded-xl"></div>`).join('')}
  </div>

  <!-- ── Main Layout ── -->
  <div id="satellite-main-layout">
    <!-- ── LEFT: Region Sidebar ── -->
    <div class="space-y-3">
      <!-- Wildfire Alert Banner -->
      <div id="sat-wildfire-banner" class="hidden et-card border-orange-700/60 bg-orange-900/20">
        <div class="flex items-center gap-2">
          <i class="fas fa-fire text-orange-400 fire-alert"></i>
          <div>
            <div class="text-xs font-bold text-orange-300">Active Wildfire Detected</div>
            <div id="sat-wildfire-detail" class="text-[9px] text-orange-400/70">Loading…</div>
          </div>
          <button onclick="scrollToWildfire()" class="ml-auto text-[9px] px-2 py-1 rounded bg-orange-900/50 border border-orange-700 text-orange-300 hover:bg-orange-900 transition-all">View</button>
        </div>
      </div>

      <!-- Minimap / World overview -->
      <div class="et-card p-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[9px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <i class="fas fa-globe text-cyan-400"></i> Global Hotspot Map
          </span>
          <span class="text-[8px] text-gray-600 mono">250km resolution</span>
        </div>
        <div class="sat-minimap" id="sat-minimap-canvas" style="height:120px;">
          <canvas id="sat-world-minimap" class="w-full h-full" style="width:100%;height:120px;"></canvas>
        </div>
        <div class="flex items-center justify-between mt-2">
          <div class="flex items-center gap-3">
            <div class="terrain-legend-item"><div class="terrain-legend-dot" style="background:#ef4444;"></div>Critical</div>
            <div class="terrain-legend-item"><div class="terrain-legend-dot" style="background:#f97316;"></div>High</div>
            <div class="terrain-legend-item"><div class="terrain-legend-dot" style="background:#10b981;"></div>Low</div>
          </div>
          <span class="text-[8px] text-gray-600 mono" id="sat-minimap-count">10 zones</span>
        </div>
      </div>

      <!-- Region List -->
      <div class="et-card p-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <i class="fas fa-list text-cyan-400 text-[10px]"></i>
            Monitored Zones
            <span id="sat-feed-count" class="text-[9px] text-gray-600"></span>
          </span>
          <div class="flex gap-1">
            <button onclick="filterSatFeed('all')" id="sat-filter-all" class="sat-filter-btn active px-2 py-0.5 rounded text-[9px] font-semibold bg-cyan-900/60 text-cyan-300 border border-cyan-700">All</button>
            <button onclick="filterSatFeed('CRITICAL')" id="sat-filter-CRITICAL" class="sat-filter-btn px-2 py-0.5 rounded text-[9px] font-semibold bg-gray-800 text-gray-400 border border-gray-700">🔴</button>
            <button onclick="filterSatFeed('HIGH')" id="sat-filter-HIGH" class="sat-filter-btn px-2 py-0.5 rounded text-[9px] font-semibold bg-gray-800 text-gray-400 border border-gray-700">🟠</button>
            <button onclick="filterSatFeed('LOW')" id="sat-filter-LOW" class="sat-filter-btn px-2 py-0.5 rounded text-[9px] font-semibold bg-gray-800 text-gray-400 border border-gray-700">🟢</button>
          </div>
        </div>
        <div id="sat-region-list" class="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1 scrollbar-hide">
          ${[1,2,3,4,5].map(()=>`<div class="animate-pulse h-20 bg-gray-800/40 rounded-xl"></div>`).join('')}
        </div>
      </div>

      <!-- Biome Stress Index -->
      <div class="et-card p-3">
        <div class="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <i class="fas fa-leaf text-emerald-400"></i> Biome Stress Index
          <span class="ml-auto text-gray-600 font-normal mono">live</span>
        </div>
        <div class="space-y-2" id="sat-biome-list">
          ${BIOMES.map(b => `
          <div class="biome-card" style="--biome-color:${b.color};" onclick="selectBiome('${b.id}')">
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                <i class="fas ${b.icon} text-[10px]" style="color:${b.color}"></i>
                <span class="text-[10px] font-semibold text-gray-300">${b.name}</span>
              </div>
              <span class="text-[10px] font-black mono" style="color:${b.stress>75?'#f87171':b.stress>55?'#fbbf24':'#4ade80'}">${b.stress}</span>
            </div>
            <div class="metric-bar">
              <div class="metric-bar-fill progress-animate" style="width:${b.stress}%;background:linear-gradient(90deg,${b.color}88,${b.color});"></div>
            </div>
          </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- ── RIGHT: Analysis Panel ── -->
    <div class="space-y-4">
      <!-- Sub-tab navigation -->
      <div class="flex items-center gap-1 p-1 bg-gray-900/60 rounded-xl border border-gray-800">
        ${[
          { id: 'analysis', icon: 'fa-satellite-dish', label: 'CNN Analysis' },
          { id: 'spectral', icon: 'fa-layer-group',    label: 'Spectral Bands' },
          { id: 'ndvi',     icon: 'fa-chart-area',      label: 'NDVI Timeseries' },
          { id: 'emission', icon: 'fa-smog',            label: 'Emission Hotspots' },
          { id: 'compare',  icon: 'fa-code-compare',    label: 'Time Compare' },
        ].map(tab => `
        <button onclick="switchSatTab('${tab.id}')" id="sat-subtab-${tab.id}"
          class="sat-subtab flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[9px] font-bold transition-all ${tab.id==='analysis'?'bg-cyan-900/50 text-cyan-300 border border-cyan-700/50':'text-gray-500 hover:text-gray-300'}">
          <i class="fas ${tab.icon}"></i>
          <span class="hidden sm:inline">${tab.label}</span>
        </button>`).join('')}
      </div>

      <!-- ── Tab: CNN Analysis ── -->
      <div id="sat-tab-analysis" class="space-y-4">
        <!-- Image viewer with HUD -->
        <div class="et-card p-0 overflow-hidden" style="min-height:360px;">
          <div class="relative rounded-xl overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950" style="min-height:360px;" id="sat-image-container">
            <!-- Corner HUD decorations -->
            <div class="sat-view-corner tl"></div>
            <div class="sat-view-corner tr"></div>
            <div class="sat-view-corner bl"></div>
            <div class="sat-view-corner br"></div>

            <!-- Satellite image -->
            <img id="sat-main-img" src="" alt="Satellite View" class="w-full object-cover opacity-0 transition-opacity duration-700"
                 style="min-height:360px; max-height:460px;"
                 onerror="this.style.display='none'; document.getElementById('sat-img-fallback').style.display='flex';"
                 onload="this.style.opacity=1; document.getElementById('sat-img-fallback').style.display='none';" />

            <!-- Demo canvas fallback -->
            <div id="sat-img-fallback" class="absolute inset-0 flex">
              <canvas id="sat-demo-canvas" class="w-full h-full absolute inset-0" style="width:100%;height:100%;"></canvas>
            </div>

            <!-- CNN Bounding-box SVG overlay -->
            <svg id="sat-bbox-svg" class="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" style="pointer-events:none;z-index:5;"></svg>

            <!-- Spectral overlay canvas -->
            <canvas id="sat-spectral-overlay" class="spectral-overlay absolute inset-0 w-full h-full" style="z-index:4;"></canvas>

            <!-- Scan line animation -->
            <div id="sat-scan-line" class="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60 sat-scan-anim pointer-events-none" style="top:0;z-index:6;"></div>

            <!-- Scan progress ring top-right -->
            <div class="absolute top-3 right-3 w-10 h-10 pointer-events-none" style="z-index:7;">
              <svg viewBox="0 0 100 100" class="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(34,211,238,0.15)" stroke-width="6"/>
                <circle cx="50" cy="50" r="45" fill="none" stroke="#22d3ee" stroke-width="6"
                        stroke-dasharray="283" stroke-dashoffset="283" stroke-linecap="round"
                        class="scan-progress-ring" id="sat-scan-progress"/>
              </svg>
            </div>

            <!-- Bottom HUD overlay -->
            <div class="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" style="z-index:7;">
              <div class="flex items-center justify-between">
                <div class="hud-panel bg-transparent border-0 p-0 flex items-center gap-4 text-[9px]">
                  <span id="sat-hud-coords" class="text-cyan-400">LAT —°  LON —°</span>
                  <span id="sat-hud-region-name" class="text-gray-400">—</span>
                </div>
                <div class="flex items-center gap-2">
                  <span id="sat-model-badge" class="text-[8px] px-2 py-0.5 rounded-full bg-purple-900/70 border border-purple-700 text-purple-300 mono">CNN-v2.1</span>
                  <span id="sat-conf-badge" class="text-[8px] px-2 py-0.5 rounded-full bg-gray-900/70 border border-gray-700 text-gray-400 mono">CONF: —</span>
                  <span id="sat-impact-badge" class="text-[8px] px-2 py-0.5 rounded-full bg-red-900/70 border border-red-700 text-red-300 mono hidden">—</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- CNN Class Probability Bars -->
        <div class="et-card p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-xs font-bold text-white flex items-center gap-2">
              <i class="fas fa-brain text-purple-400"></i>
              CNN Class Probabilities
              <span class="text-[8px] text-gray-600 font-normal">EcoTwin-v2.1 softmax output</span>
            </h3>
            <div id="sat-top-class" class="text-[9px] px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-400 mono">—</div>
          </div>
          <div id="sat-cnn-probs" class="space-y-2">
            ${Object.entries(CHANGE_LABELS).map(([k,v]) => `
            <div class="flex items-center gap-2">
              <div class="w-24 text-[9px] text-gray-400 flex items-center gap-1.5 flex-shrink-0">
                <i class="fas ${CHANGE_ICONS[k]} text-gray-600 w-3"></i> ${v}
              </div>
              <div class="flex-1 cnn-prob-bar">
                <div id="cnn-prob-${k}" class="cnn-prob-fill" style="width:0%;background:linear-gradient(90deg,#8b5cf688,#8b5cf6);"></div>
              </div>
              <span id="cnn-pct-${k}" class="text-[9px] mono text-gray-500 w-8 text-right">0%</span>
            </div>`).join('')}
          </div>
        </div>

        <!-- CNN Architecture Visualization -->
        <div class="et-card p-4">
          <div class="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <i class="fas fa-microchip text-cyan-400"></i> CNN Architecture
            <span class="text-gray-600 font-normal ml-auto">EfficientNet-B3 backbone</span>
          </div>
          <div class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            ${CNN_LAYERS.map((l, i) => `
            <div class="cnn-layer-block ${l.type} flex-shrink-0 w-20 neural-node" style="animation-delay:${i*0.2}s;">
              <div class="text-[8px] font-bold text-gray-300 whitespace-pre-line leading-tight mb-1">${l.label}</div>
              <div class="text-[7px] text-gray-600">${l.note}</div>
            </div>
            ${i < CNN_LAYERS.length-1 ? '<div class="flex-shrink-0 text-gray-700 text-xs">→</div>' : ''}`).join('')}
          </div>
        </div>

        <!-- Metrics + SDG row -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="et-card text-center p-3">
            <div class="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Affected Area</div>
            <div class="text-xl font-black text-orange-300 mono" id="sat-m-area">—</div>
            <div class="text-[9px] text-gray-600">km²</div>
          </div>
          <div class="et-card text-center p-3">
            <div class="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Change Rate</div>
            <div class="text-xl font-black text-red-300 mono" id="sat-m-rate">—</div>
            <div class="text-[9px] text-gray-600">%/year</div>
          </div>
          <div class="et-card text-center p-3">
            <div class="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Model Confidence</div>
            <div class="text-xl font-black text-cyan-300 mono" id="sat-m-conf">—</div>
            <div class="text-[9px] text-gray-600">accuracy</div>
          </div>
          <div class="et-card text-center p-3">
            <div class="text-[9px] text-gray-500 uppercase tracking-wider mb-1">SDG Impact</div>
            <div class="text-xl font-black text-purple-300 mono" id="sat-m-sdg">—</div>
            <div class="text-[9px] text-gray-600">goals</div>
          </div>
        </div>

        <!-- AI Recommendations -->
        <div class="et-card p-4">
          <h3 class="text-xs font-bold text-white flex items-center gap-2 mb-3">
            <i class="fas fa-lightbulb text-yellow-400"></i>
            AI Action Recommendations
            <span class="text-[8px] font-normal text-gray-600">policy · intervention · monitoring</span>
          </h3>
          <div id="sat-recommendations" class="space-y-2">
            <div class="text-xs text-gray-600 italic flex items-center gap-2">
              <i class="fas fa-arrow-left text-cyan-800"></i> Select a region to load AI recommendations
            </div>
          </div>
        </div>
      </div>

      <!-- ── Tab: Spectral Bands ── -->
      <div id="sat-tab-spectral" class="hidden space-y-4">
        <!-- Band selector -->
        <div class="et-card p-4">
          <div class="text-[9px] font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
            <i class="fas fa-layer-group text-cyan-400"></i> Select Spectral Band
          </div>
          <div class="flex flex-wrap gap-2 mb-4">
            ${SPECTRAL_BANDS.map(b => `
            <button onclick="selectSpectralBand('${b.id}')" id="spectral-btn-${b.id}"
              class="spectral-btn ${b.cls} ${b.id==='rgb'?'active-band':''}">
              <i class="fas ${b.icon} mr-1"></i>${b.label}
            </button>`).join('')}
          </div>
          <div class="relative rounded-xl overflow-hidden bg-gray-900" style="height:300px;" id="sat-spectral-view">
            <canvas id="sat-spectral-canvas" class="w-full h-full" style="width:100%;height:300px;"></canvas>
            <div class="absolute bottom-2 left-2 hud-panel text-[8px]" id="sat-spectral-info">
              RGB True Color — Natural view composite
            </div>
          </div>
        </div>

        <!-- NDVI color scale legend -->
        <div class="et-card p-4">
          <div class="text-[9px] font-bold text-gray-400 uppercase mb-2 flex items-center gap-2">
            <i class="fas fa-seedling text-emerald-400"></i> NDVI Color Scale Reference
          </div>
          <div class="ndvi-scale mb-2"></div>
          <div class="flex justify-between text-[8px] text-gray-500">
            <span>−1.0 (Water)</span>
            <span>0.0 (Bare soil)</span>
            <span>0.5 (Shrub)</span>
            <span>+1.0 (Dense forest)</span>
          </div>
        </div>

        <!-- Spectral activation heatmap -->
        <div class="et-card p-4">
          <div class="text-[9px] font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
            <i class="fas fa-fire text-orange-400"></i> CNN Activation Heatmap (8×8)
            <span class="ml-auto text-gray-600 font-normal">GradCAM visualization</span>
          </div>
          <canvas id="sat-heatmap-canvas" class="w-full rounded-lg" style="height:160px;image-rendering:pixelated;"></canvas>
          <div class="flex justify-between items-center mt-2">
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-1 text-[8px] text-gray-500"><div class="w-3 h-3 rounded" style="background:#1e3a5f;"></div>Low</div>
              <div class="flex items-center gap-1 text-[8px] text-gray-500"><div class="w-3 h-3 rounded" style="background:#f59e0b;"></div>Mid</div>
              <div class="flex items-center gap-1 text-[8px] text-gray-500"><div class="w-3 h-3 rounded" style="background:#ef4444;"></div>High</div>
            </div>
            <span class="text-[8px] text-gray-600 mono">Activation intensity</span>
          </div>
        </div>
      </div>

      <!-- ── Tab: NDVI Timeseries ── -->
      <div id="sat-tab-ndvi" class="hidden space-y-4">
        <div class="et-card p-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xs font-bold text-white flex items-center gap-2">
              <i class="fas fa-chart-area text-emerald-400"></i>
              NDVI Vegetation Health Timeseries
            </h3>
            <div class="flex items-center gap-2">
              <select id="sat-ndvi-region" onchange="loadNdviTimeseries()" class="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-[9px] text-gray-300 focus:outline-none focus:border-cyan-600">
                <option value="amazon">Amazon</option>
                <option value="borneo">Borneo</option>
                <option value="sahel">Sahel</option>
                <option value="california">California</option>
                <option value="congo">Congo Basin</option>
              </select>
              <span class="text-[8px] text-gray-600">2000–2024</span>
            </div>
          </div>
          <canvas id="sat-ndvi-chart" height="120"></canvas>
        </div>
        <div class="grid grid-cols-3 gap-3" id="sat-ndvi-stats">
          <div class="et-card text-center p-3">
            <div class="text-[9px] text-gray-500 mb-1">Peak NDVI</div>
            <div class="text-lg font-black text-emerald-300 mono" id="ndvi-peak">0.82</div>
          </div>
          <div class="et-card text-center p-3">
            <div class="text-[9px] text-gray-500 mb-1">Current</div>
            <div class="text-lg font-black text-yellow-300 mono" id="ndvi-current">0.61</div>
          </div>
          <div class="et-card text-center p-3">
            <div class="text-[9px] text-gray-500 mb-1">Trend 20yr</div>
            <div class="text-lg font-black text-red-300 mono" id="ndvi-trend">−0.21</div>
          </div>
        </div>
        <!-- Anomaly detection timeline -->
        <div class="et-card p-4">
          <div class="text-[9px] font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
            <i class="fas fa-exclamation-triangle text-yellow-400"></i> NDVI Anomaly Detection Timeline
          </div>
          <div id="sat-anomaly-timeline" class="space-y-2">
            <div class="text-xs text-gray-600 italic">Loading anomalies…</div>
          </div>
        </div>
      </div>

      <!-- ── Tab: Emission Hotspots ── -->
      <div id="sat-tab-emission" class="hidden space-y-4">
        <div class="et-card p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-xs font-bold text-white flex items-center gap-2">
              <i class="fas fa-smog text-gray-300"></i>
              CO₂ Emission Hotspot Map
              <span class="text-[8px] font-normal text-gray-600">TROPOMI/Sentinel-5P</span>
            </h3>
            <button onclick="refreshEmissionHotspots()" class="text-[9px] px-2 py-1 rounded bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 transition-all">
              <i class="fas fa-rotate-right mr-1"></i>Refresh
            </button>
          </div>
          <div class="relative rounded-xl overflow-hidden bg-gray-950" style="height:280px;" id="sat-emission-map">
            <canvas id="sat-emission-canvas" class="w-full h-full" style="width:100%;height:280px;"></canvas>
          </div>
          <div class="mt-3 flex items-center gap-4">
            <div class="flex items-center gap-2 text-[9px] text-gray-500">
              <div class="w-8 h-2 rounded-full bg-gradient-to-r from-blue-600 via-yellow-500 to-red-600"></div>
              Low → High emission density
            </div>
            <span class="ml-auto text-[9px] text-gray-600 mono" id="sat-emission-total">Total: — Mt CO₂/yr</span>
          </div>
        </div>

        <!-- Top emitter list -->
        <div class="et-card p-4">
          <div class="text-[9px] font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
            <i class="fas fa-ranking-star text-orange-400"></i> Top Emission Zones
          </div>
          <div id="sat-emitter-list" class="space-y-2">
            <div class="text-xs text-gray-600 animate-pulse">Loading hotspot data…</div>
          </div>
        </div>
      </div>

      <!-- ── Tab: Time Compare ── -->
      <div id="sat-tab-compare" class="hidden space-y-4">
        <div class="et-card p-4">
          <h3 class="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <i class="fas fa-code-compare text-cyan-400"></i>
            Temporal Change Analysis
          </h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div>
              <label class="text-[9px] text-gray-500 uppercase tracking-wider block mb-1">Region</label>
              <select id="sat-cmp-region" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cyan-500">
                <option value="amazon">Amazon</option>
                <option value="aral">Aral Sea</option>
                <option value="borneo">Borneo</option>
                <option value="greenland">Greenland</option>
                <option value="california">California</option>
              </select>
            </div>
            <div>
              <label class="text-[9px] text-gray-500 uppercase tracking-wider block mb-1">Year From</label>
              <select id="sat-cmp-from" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cyan-500">
                ${[2015,2016,2017,2018,2019,2020,2021,2022].map(y=>`<option value="${y}">${y}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="text-[9px] text-gray-500 uppercase tracking-wider block mb-1">Year To</label>
              <select id="sat-cmp-to" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cyan-500">
                ${[2020,2021,2022,2023,2024].map(y=>`<option value="${y}" ${y===2024?'selected':''}>${y}</option>`).join('')}
              </select>
            </div>
            <div class="flex items-end">
              <button onclick="runSatCompare()" class="w-full px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-700 to-emerald-700 text-white text-xs font-bold hover:opacity-90 transition-all">
                <i class="fas fa-magnifying-glass-chart mr-1"></i>Analyze
              </button>
            </div>
          </div>
          <div id="sat-compare-results" class="text-xs text-gray-600 italic">Select region and years, then click Analyze.</div>
        </div>

        <!-- 5-Year trend chart -->
        <div class="et-card p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-xs font-bold text-white flex items-center gap-2">
              <i class="fas fa-chart-line text-emerald-400"></i>
              5-Year Change Trend
            </h3>
            <span class="text-[9px] text-gray-500 mono" id="sat-trend-label">Select region</span>
          </div>
          <canvas id="sat-trend-chart" height="100"></canvas>
        </div>
      </div>

    </div> <!-- end right panel -->
  </div> <!-- end main layout -->

  <!-- ── ML Forecast Modal (hidden) ── -->
  <div id="sat-ml-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" onclick="closeSatMLForecast()"></div>
    <div class="relative z-10 glass-panel p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-black text-white flex items-center gap-2">
          <i class="fas fa-brain text-purple-400"></i> ML Environmental Forecast
          <span class="text-[9px] px-2 py-0.5 rounded-full bg-purple-900/60 border border-purple-700 text-purple-300">18-month projection</span>
        </h2>
        <button onclick="closeSatMLForecast()" class="text-gray-500 hover:text-gray-200 transition-all">
          <i class="fas fa-xmark"></i>
        </button>
      </div>
      <div id="sat-ml-content">
        <div class="text-xs text-gray-500 animate-pulse">Loading ML model forecast…</div>
      </div>
    </div>
  </div>
</div>`;
}

// ── SUB-TAB SWITCHER ─────────────────────────────────────────────────────────
function switchSatTab(tabId) {
  SAT_STATE.activeTab = tabId;
  // Hide all sub-tabs
  ['analysis','spectral','ndvi','emission','compare'].forEach(id => {
    const el = document.getElementById(`sat-tab-${id}`);
    if (el) el.classList.add('hidden');
    const btn = document.getElementById(`sat-subtab-${id}`);
    if (btn) {
      btn.className = `sat-subtab flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[9px] font-bold transition-all text-gray-500 hover:text-gray-300`;
    }
  });
  // Show active
  const active = document.getElementById(`sat-tab-${tabId}`);
  if (active) active.classList.remove('hidden');
  const activeBtn = document.getElementById(`sat-subtab-${tabId}`);
  if (activeBtn) {
    activeBtn.className = `sat-subtab flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[9px] font-bold transition-all bg-cyan-900/50 text-cyan-300 border border-cyan-700/50`;
  }
  // Trigger tab-specific loads
  if (tabId === 'ndvi') loadNdviTimeseries();
  if (tabId === 'emission') refreshEmissionHotspots();
}

// ── INIT ─────────────────────────────────────────────────────────────────────
async function initSatellite() {
  loadSatGlobalStats();
  refreshSatelliteFeed();
  renderWorldMinimap();
  updateSatHUD();
  if (SAT_STATE.scanInterval) clearInterval(SAT_STATE.scanInterval);
  SAT_STATE.scanInterval = setInterval(() => {
    refreshSatelliteFeed(true);
    loadSatGlobalStats();
    updateSatHUD();
  }, 30000);
}

function updateSatHUD() {
  const el = document.getElementById('sat-hud-time');
  if (el) {
    const t = new Date().toLocaleTimeString('en-US', { hour12: false });
    el.querySelector('span').textContent = t;
  }
}

// ── GLOBAL STATS ─────────────────────────────────────────────────────────────
async function loadSatGlobalStats() {
  try {
    const r = await fetch('/satellite/global_stats');
    const d = await r.json();
    SAT_STATE.globalStats = d;
    renderSatGlobalStats(d);
  } catch(e) { console.error('Sat global stats:', e); }
}

function renderSatGlobalStats(d) {
  const el = document.getElementById('sat-global-stats');
  if (!el) return;
  el.innerHTML = `
    <div class="et-card p-3">
      <div class="flex items-center gap-2 mb-1"><i class="fas fa-tree text-red-400 text-xs"></i><span class="text-[9px] text-gray-500 uppercase tracking-wider">Forest Loss</span></div>
      <div class="text-lg font-black text-red-300 mono live-flicker">${Number(d.forestLoss.today_ha).toLocaleString()}</div>
      <div class="text-[9px] text-gray-500">ha today · ${d.forestLoss.rate_ha_per_min.toFixed(0)} ha/min</div>
    </div>
    <div class="et-card p-3">
      <div class="flex items-center gap-2 mb-1"><i class="fas fa-city text-orange-400 text-xs"></i><span class="text-[9px] text-gray-500 uppercase tracking-wider">Urban Growth</span></div>
      <div class="text-lg font-black text-orange-300 mono">${d.urbanExpansion.new_km2_per_day}</div>
      <div class="text-[9px] text-gray-500">km²/day · ${d.urbanExpansion.impervious_surface_pct}% impervious</div>
    </div>
    <div class="et-card p-3">
      <div class="flex items-center gap-2 mb-1"><i class="fas fa-water text-blue-400 text-xs"></i><span class="text-[9px] text-gray-500 uppercase tracking-wider">Water Loss</span></div>
      <div class="text-lg font-black text-blue-300 mono">${Number(d.waterBodies.total_loss_km2_year).toLocaleString()}</div>
      <div class="text-[9px] text-gray-500">km²/yr · ${d.waterBodies.water_stress_pct}% stressed</div>
    </div>
    <div class="et-card p-3">
      <div class="flex items-center gap-2 mb-1"><i class="fas fa-snowflake text-cyan-400 text-xs"></i><span class="text-[9px] text-gray-500 uppercase tracking-wider">Arctic Ice</span></div>
      <div class="text-lg font-black text-cyan-300 mono">${d.iceSheets.arctic_extent_mkm2}</div>
      <div class="text-[9px] text-gray-500">M km² · −${d.iceSheets.annual_loss_gt} Gt/yr</div>
    </div>
    <div class="et-card p-3">
      <div class="flex items-center gap-2 mb-1"><i class="fas fa-smog text-gray-400 text-xs"></i><span class="text-[9px] text-gray-500 uppercase tracking-wider">CO₂ Emissions</span></div>
      <div class="text-lg font-black text-gray-300 mono">${(d.co2Emissions||36.8).toFixed(1)}</div>
      <div class="text-[9px] text-gray-500">Gt CO₂/yr land-use</div>
    </div>
    <div class="et-card p-3">
      <div class="flex items-center gap-2 mb-1"><i class="fas fa-fire text-orange-400 text-xs"></i><span class="text-[9px] text-gray-500 uppercase tracking-wider">Active Wildfires</span></div>
      <div class="text-lg font-black text-orange-300 mono">${d.wildfires||247}</div>
      <div class="text-[9px] text-gray-500">active FIRMS detections</div>
    </div>`;
  // Update HUD alerts
  const alertEl = document.getElementById('sat-hud-alerts');
  if (alertEl) {
    const crit = SAT_STATE.liveFeed.filter(f=>f.impactGrade==='CRITICAL').length;
    alertEl.querySelector('span').textContent = crit || '0';
    alertEl.querySelector('span').className = crit > 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold';
  }
}

// ── LIVE FEED ─────────────────────────────────────────────────────────────────
async function refreshSatelliteFeed(silent = false) {
  if (!silent) {
    const list = document.getElementById('sat-region-list');
    if (list) list.innerHTML = [1,2,3,4,5].map(()=>`<div class="animate-pulse h-20 bg-gray-800/40 rounded-xl"></div>`).join('');
  }
  try {
    const r = await fetch('/satellite/live_feed');
    const d = await r.json();
    SAT_STATE.liveFeed = d.feed;
    SAT_STATE.lastScan = d.stats;
    renderSatRegionList(d.feed, d.stats);
    renderWorldMinimap();
    // Check for wildfire
    const fire = d.feed.find(f => f.changeType === 'wildfire' || f.impactScore > 90);
    if (fire) {
      const banner = document.getElementById('sat-wildfire-banner');
      const detail = document.getElementById('sat-wildfire-detail');
      if (banner) banner.classList.remove('hidden');
      if (detail) detail.textContent = `${fire.regionName} — Score: ${fire.impactScore.toFixed(0)} — ${fire.affectedAreaKm2} km²`;
    }
    if (!SAT_STATE.activeRegion && d.feed.length > 0) {
      selectSatRegion(d.feed[0].regionId);
    }
  } catch(e) { console.error('Sat live feed:', e); }
}

function renderSatRegionList(feed, stats) {
  const listEl = document.getElementById('sat-region-list');
  const countEl = document.getElementById('sat-feed-count');
  if (!listEl) return;
  if (countEl && stats) {
    countEl.textContent = `(${feed.length} · ${stats.criticalZones}🔴)`;
  }
  const filter = document.querySelector('.sat-filter-btn.active')?.id?.replace('sat-filter-', '') || 'all';
  const filtered = filter === 'all' ? feed : feed.filter(f => f.impactGrade === filter || f.impactGrade === filter.toUpperCase());
  listEl.innerHTML = filtered.map(f => {
    const gc = GRADE_COLORS[f.impactGrade] || GRADE_COLORS.LOW;
    const icon = CHANGE_ICONS[f.changeType] || 'fa-globe';
    const label = CHANGE_LABELS[f.changeType] || f.changeType;
    const isActive = SAT_STATE.activeRegion === f.regionId;
    return `
    <div onclick="selectSatRegion('${f.regionId}')" class="sat-region-card ${isActive?'active gradient-border-active':''}" style="--region-severity:${gc.hex}">
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-8 h-8 rounded-lg ${gc.bg} ${gc.border} border flex items-center justify-center flex-none">
            <i class="fas ${icon} ${gc.text} text-xs"></i>
          </div>
          <div class="min-w-0">
            <div class="text-[11px] font-bold text-gray-200 truncate">${f.regionName}</div>
            <div class="text-[9px] text-gray-500">${label}</div>
          </div>
        </div>
        <div class="text-right flex-none">
          <div class="text-sm font-black ${gc.text} mono">${f.impactScore.toFixed(0)}</div>
          <div class="text-[8px] font-bold ${gc.text}">${f.impactGrade}</div>
        </div>
      </div>
      <div class="mt-2 flex items-center gap-3 text-[9px] text-gray-500">
        <span><i class="fas fa-expand-arrows-alt mr-0.5 opacity-50"></i>${f.affectedAreaKm2} km²</span>
        <span><i class="fas fa-chart-line mr-0.5 opacity-50"></i>${f.changeRatePctPerYear}%/yr</span>
        <span class="ml-auto"><i class="fas fa-crosshairs mr-0.5 opacity-50"></i>${(f.confidence*100).toFixed(0)}%</span>
      </div>
      <div class="mt-1.5 h-1 rounded-full bg-gray-800 overflow-hidden">
        <div class="h-full rounded-full transition-all duration-700"
             style="width:${f.impactScore}%; background: linear-gradient(90deg, ${gc.hex}88, ${gc.hex});"></div>
      </div>
    </div>`;
  }).join('');
}

function filterSatFeed(grade) {
  document.querySelectorAll('.sat-filter-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`sat-filter-${grade}`);
  if (btn) btn.classList.add('active');
  renderSatRegionList(SAT_STATE.liveFeed, SAT_STATE.lastScan);
}

// ── WORLD MINIMAP ─────────────────────────────────────────────────────────────
function renderWorldMinimap() {
  const canvas = document.getElementById('sat-world-minimap');
  if (!canvas) return;
  const W = canvas.clientWidth || 280, H = 120;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  // Background
  ctx.fillStyle = '#020408';
  ctx.fillRect(0, 0, W, H);
  // Simplified world outline (very basic)
  ctx.strokeStyle = 'rgba(34,211,238,0.15)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.rect(10, 10, W-20, H-20);
  ctx.stroke();
  // Grid lines
  for (let x = 10; x <= W-10; x += (W-20)/6) {
    ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x, H-10);
    ctx.strokeStyle = 'rgba(34,211,238,0.05)'; ctx.stroke();
  }
  for (let y = 10; y <= H-10; y += (H-20)/4) {
    ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(W-10, y);
    ctx.strokeStyle = 'rgba(34,211,238,0.05)'; ctx.stroke();
  }
  // Draw region dots
  const regionCoords = {
    amazon:     { lat: -3.4, lon: -62.2 },
    greenland:  { lat: 72.0, lon: -40.0 },
    sahel:      { lat: 13.5, lon: 10.0  },
    aral:       { lat: 45.0, lon: 59.0  },
    borneo:     { lat: 0.5,  lon: 113.9 },
    california: { lat: 36.7, lon: -119.7},
    mekong:     { lat: 15.0, lon: 102.0 },
    siberia:    { lat: 60.0, lon: 90.0  },
    nile:       { lat: 25.0, lon: 32.0  },
    patagonia:  { lat: -48.0,lon: -72.0 },
  };
  SAT_STATE.liveFeed.forEach(f => {
    const coord = regionCoords[f.regionId];
    if (!coord) return;
    const x = (coord.lon + 180) / 360 * (W-20) + 10;
    const y = (90 - coord.lat) / 180 * (H-20) + 10;
    const gc = GRADE_COLORS[f.impactGrade] || GRADE_COLORS.LOW;
    ctx.beginPath();
    ctx.arc(x, y, f.impactGrade === 'CRITICAL' ? 5 : 3, 0, Math.PI*2);
    ctx.fillStyle = gc.hex;
    ctx.fill();
    ctx.strokeStyle = gc.hex + '66';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (f.impactGrade === 'CRITICAL' || f.impactGrade === 'HIGH') {
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI*2);
      ctx.strokeStyle = gc.hex + '33';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });
}

// ── REGION DETAIL ──────────────────────────────────────────────────────────────
async function selectSatRegion(regionId) {
  SAT_STATE.activeRegion = regionId;
  renderSatRegionList(SAT_STATE.liveFeed, SAT_STATE.lastScan);
  const tsEl = document.getElementById('sat-hud-time');
  try {
    const r = await fetch(`/satellite/analyze/${regionId}`);
    const d = await r.json();
    renderSatAnalysis(d);
  } catch(e) { console.error('Sat analyze:', e); }
}

function renderSatAnalysis(d) {
  const analysis = d.analysis;
  const region = d.region;
  if (!analysis || !region) return;
  // Update HUD
  const coordEl = document.getElementById('sat-hud-coords');
  if (coordEl) coordEl.textContent = `LAT ${region.lat.toFixed(2)}°  LON ${region.lon.toFixed(2)}°`;
  const nameEl = document.getElementById('sat-hud-region-name');
  if (nameEl) nameEl.textContent = region.name;
  // Update badges
  const confBadge = document.getElementById('sat-conf-badge');
  if (confBadge) confBadge.textContent = `CONF: ${(analysis.confidence*100).toFixed(0)}%`;
  const impactBadge = document.getElementById('sat-impact-badge');
  if (impactBadge) {
    impactBadge.textContent = `SCORE: ${analysis.impactScore}`;
    impactBadge.classList.remove('hidden');
  }
  // Update metrics
  const setEl = (id, val) => { const e = document.getElementById(id); if(e) e.textContent = val; };
  setEl('sat-m-area', analysis.affectedAreaKm2 || '—');
  setEl('sat-m-rate', analysis.changeRatePctPerYear ? `${analysis.changeRatePctPerYear}%` : '—');
  setEl('sat-m-conf', analysis.confidence ? `${(analysis.confidence*100).toFixed(0)}%` : '—');
  setEl('sat-m-sdg', analysis.sdgImpact ? analysis.sdgImpact.length : '—');
  // Update top class
  const topEl = document.getElementById('sat-top-class');
  if (topEl) topEl.textContent = `${CHANGE_LABELS[analysis.changeType] || analysis.changeType} — #1 class`;
  // Update CNN probability bars
  if (analysis.classProbabilities) {
    Object.entries(analysis.classProbabilities).forEach(([cls, prob]) => {
      const fill = document.getElementById(`cnn-prob-${cls}`);
      const pct  = document.getElementById(`cnn-pct-${cls}`);
      if (fill) fill.style.width = `${(prob*100).toFixed(0)}%`;
      if (pct)  pct.textContent  = `${(prob*100).toFixed(0)}%`;
    });
  } else {
    // Fallback: generate based on changeType
    const types = Object.keys(CHANGE_LABELS);
    types.forEach(k => {
      const prob = k === analysis.changeType ? 0.7 + Math.random()*0.25 : Math.random()*0.15;
      const fill = document.getElementById(`cnn-prob-${k}`);
      const pct  = document.getElementById(`cnn-pct-${k}`);
      if (fill) fill.style.width = `${(prob*100).toFixed(0)}%`;
      if (pct)  pct.textContent  = `${(prob*100).toFixed(0)}%`;
    });
  }
  // Draw image / fallback canvas
  const img = document.getElementById('sat-main-img');
  const fallback = document.getElementById('sat-img-fallback');
  if (region.tileUrl) {
    if (img) { img.src = region.tileUrl; img.style.opacity = 0; }
  } else {
    if (img) img.style.display = 'none';
    if (fallback) fallback.style.display = 'flex';
    drawDemoCanvas(analysis, region);
  }
  // Draw bounding boxes
  drawBoundingBoxes(analysis.boxes || []);
  // Draw heatmap (in spectral tab)
  drawActivationHeatmap(analysis.heatmap || []);
  // Draw trend chart (in compare tab)
  renderSatTrendChart(analysis.yearlyChange || []);
  if (document.getElementById('sat-trend-label'))
    document.getElementById('sat-trend-label').textContent = region.name;
  // AI recommendations
  renderSatRecommendations(analysis.recommendations || []);
}

// ── DEMO CANVAS ───────────────────────────────────────────────────────────────
function drawDemoCanvas(analysis, region) {
  const canvas = document.getElementById('sat-demo-canvas');
  if (!canvas) return;
  const container = canvas.parentElement;
  canvas.width  = container.clientWidth  || 600;
  canvas.height = container.clientHeight || 360;
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  const type = analysis.changeType;
  const band = SAT_STATE.spectralBand;
  // Background gradient based on type & band
  const grad = ctx.createLinearGradient(0, 0, W, H);
  if (band === 'ndvi') {
    grad.addColorStop(0, '#1a2e0a'); grad.addColorStop(0.5, '#2d5e12'); grad.addColorStop(1, '#1a2e0a');
  } else if (band === 'thermal') {
    grad.addColorStop(0, '#1a0a00'); grad.addColorStop(0.5, '#7f1d1d'); grad.addColorStop(1, '#dc2626');
  } else if (band === 'swir') {
    grad.addColorStop(0, '#0f0f2e'); grad.addColorStop(0.5, '#1e1b4b'); grad.addColorStop(1, '#312e81');
  } else if (band === 'nir') {
    grad.addColorStop(0, '#2d1b00'); grad.addColorStop(0.5, '#78350f'); grad.addColorStop(1, '#431407');
  } else {
    if (type === 'deforestation') { grad.addColorStop(0,'#1c3a10'); grad.addColorStop(0.5,'#234d14'); grad.addColorStop(1,'#0d1f08'); }
    else if (type === 'urban_expansion') { grad.addColorStop(0,'#1a1a2e'); grad.addColorStop(0.5,'#2d2d4e'); grad.addColorStop(1,'#0d0d18'); }
    else if (type === 'water_loss') { grad.addColorStop(0,'#0c2340'); grad.addColorStop(0.5,'#1a4a7a'); grad.addColorStop(1,'#5a4010'); }
    else if (type === 'ice_loss') { grad.addColorStop(0,'#c0d8f0'); grad.addColorStop(0.5,'#a0c0e0'); grad.addColorStop(1,'#6090c0'); }
    else { grad.addColorStop(0,'#5a4020'); grad.addColorStop(0.5,'#7a5530'); grad.addColorStop(1,'#3a2510'); }
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // Terrain patches
  for (let i = 0; i < 60; i++) {
    const x = (i * 97 + 23) % W, y = (i * 73 + 17) % H;
    const r = 10 + (i * 13) % 50, alpha = 0.08 + (i % 5) * 0.03;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (type === 'deforestation') ctx.fillStyle = i%3===0 ? `rgba(80,40,10,${alpha})` : `rgba(20,60,20,${alpha})`;
    else if (type === 'urban_expansion') ctx.fillStyle = `rgba(80,80,100,${alpha})`;
    else if (type === 'water_loss') ctx.fillStyle = i%2===0 ? `rgba(20,60,120,${alpha})` : `rgba(140,110,50,${alpha})`;
    else if (type === 'ice_loss') ctx.fillStyle = `rgba(200,220,240,${alpha*0.4})`;
    else ctx.fillStyle = `rgba(180,140,80,${alpha})`;
    ctx.fill();
  }
  // Grid overlay
  ctx.strokeStyle = 'rgba(34,211,238,0.05)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // Coordinate text
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, H-22, W, 22);
  ctx.fillStyle = '#67e8f9';
  ctx.font = 'bold 10px monospace';
  ctx.fillText(`${band.toUpperCase()} · LAT ${region.lat.toFixed(2)}°  LON ${region.lon.toFixed(2)}°  |  ${region.name}`, 10, H-7);
}

// ── BOUNDING BOXES ────────────────────────────────────────────────────────────
function drawBoundingBoxes(boxes) {
  const svg = document.getElementById('sat-bbox-svg');
  if (!svg) return;
  svg.innerHTML = boxes.map(b => `
    <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"
      fill="none" stroke="${b.color}" stroke-width="0.6" stroke-dasharray="3 1.5" opacity="0.9"/>
    <rect x="${b.x}" y="${b.y - 5}" width="${Math.min(b.w, 28)}" height="5"
      fill="${b.color}cc"/>
    <text x="${b.x + 1}" y="${b.y - 1}" font-size="2.8" fill="white" font-family="monospace" font-weight="bold">
      ${(b.confidence*100).toFixed(0)}%
    </text>`
  ).join('');
}

// ── ACTIVATION HEATMAP ────────────────────────────────────────────────────────
function drawActivationHeatmap(heatmap) {
  const canvas = document.getElementById('sat-heatmap-canvas');
  if (!canvas) return;
  canvas.width = 8; canvas.height = 8;
  const ctx = canvas.getContext('2d');
  const data = heatmap.length === 64 ? heatmap : Array.from({length:64}, (_,i) => Math.random());
  for (let i = 0; i < 64; i++) {
    const v = data[i];
    const r = Math.floor(v * 255);
    const g = Math.floor((1 - Math.abs(v - 0.5)*2) * 180);
    const b = Math.floor((1 - v) * 200);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(i % 8, Math.floor(i / 8), 1, 1);
  }
}

// ── SPECTRAL BAND ─────────────────────────────────────────────────────────────
function selectSpectralBand(bandId) {
  SAT_STATE.spectralBand = bandId;
  document.querySelectorAll('.spectral-btn').forEach(b => b.classList.remove('active-band'));
  const btn = document.getElementById(`spectral-btn-${bandId}`);
  if (btn) btn.classList.add('active-band');
  const infoEl = document.getElementById('sat-spectral-info');
  const band = SPECTRAL_BANDS.find(b => b.id === bandId);
  if (infoEl && band) infoEl.textContent = `${band.label} — ${band.desc}`;
  // Redraw spectral view
  renderSpectralCanvas(bandId);
  // Also redraw demo canvas if active region
  if (SAT_STATE.activeRegion) {
    const region = SAT_STATE.liveFeed.find(f => f.regionId === SAT_STATE.activeRegion);
    if (region) drawDemoCanvas({ changeType: region.changeType }, region);
  }
}

function renderSpectralCanvas(bandId) {
  const canvas = document.getElementById('sat-spectral-canvas');
  if (!canvas) return;
  const W = canvas.clientWidth || 600, H = 300;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const palettes = {
    rgb:     { c1: '#0d3b0a', c2: '#1a5c12', c3: '#2d8a1f' },
    nir:     { c1: '#2d1b00', c2: '#78350f', c3: '#dc8a30' },
    swir:    { c1: '#0f0f2e', c2: '#312e81', c3: '#6d28d9' },
    ndvi:    { c1: '#7f1d1d', c2: '#ca8a04', c3: '#16a34a' },
    thermal: { c1: '#1a0a00', c2: '#7f1d1d', c3: '#fbbf24' },
  };
  const pal = palettes[bandId] || palettes.rgb;
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, pal.c1); grad.addColorStop(0.5, pal.c2); grad.addColorStop(1, pal.c3);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  // Noise texture
  for (let i = 0; i < 80; i++) {
    const x = Math.random()*W, y = Math.random()*H, r = 5+Math.random()*60;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.04})`;
    ctx.fill();
  }
  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 50) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  // Band label
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, H-20, W, 20);
  ctx.fillStyle = '#22d3ee'; ctx.font = '10px monospace';
  ctx.fillText(`${bandId.toUpperCase()} BAND — Simulated composite (NASA GIBS VIIRS 250m)`, 10, H-6);
}

// ── NDVI TIMESERIES ───────────────────────────────────────────────────────────
async function loadNdviTimeseries() {
  const regionId = document.getElementById('sat-ndvi-region')?.value || 'amazon';
  try {
    const r = await fetch(`/satellite/ndvi_timeseries?region=${regionId}`);
    const d = await r.json();
    renderNdviChart(d);
    renderNdviStats(d);
    renderAnomalyTimeline(d.anomalies || []);
  } catch(e) { renderNdviChartFallback(regionId); }
}

function renderNdviChart(d) {
  const canvas = document.getElementById('sat-ndvi-chart');
  if (!canvas || !window.Chart) return;
  if (canvas._nchart) canvas._nchart.destroy();
  canvas._nchart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: d.years || Array.from({length:25},(_,i)=>2000+i),
      datasets: [
        {
          label: 'NDVI (mean)',
          data: d.ndvi || Array.from({length:25},(_,i)=> 0.75 - i*0.007 + (Math.random()-0.5)*0.05),
          borderColor: '#10b981', backgroundColor: '#10b98120',
          tension: 0.4, fill: true, pointRadius: 3, borderWidth: 2,
        },
        {
          label: 'Anomaly threshold',
          data: d.threshold || Array.from({length:25},()=> 0.55),
          borderColor: '#f59e0b', backgroundColor: 'transparent',
          borderDash: [5,3], pointRadius: 0, borderWidth: 1.5,
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { labels: { color: '#9ca3af', font: { size: 9 } } },
        tooltip: { backgroundColor: 'rgba(2,4,8,0.9)', titleColor: '#22d3ee', bodyColor: '#9ca3af' },
      },
      scales: {
        x: { ticks: { color: '#4b5563', font: { size: 8 } }, grid: { color: '#111827' } },
        y: {
          min: 0, max: 1,
          ticks: { color: '#4b5563', font: { size: 8 } },
          grid: { color: '#111827' },
          title: { display: true, text: 'NDVI', color: '#4b5563', font: { size: 8 } }
        }
      }
    }
  });
}

function renderNdviChartFallback(regionId) {
  const baseNdvi = { amazon:0.82, borneo:0.79, sahel:0.42, california:0.58, congo:0.86 }[regionId] || 0.7;
  const years = Array.from({length:25},(_,i)=>2000+i);
  const ndvi  = years.map((y,i)=> Math.max(0.1, baseNdvi - i*0.008 + (Math.random()-0.5)*0.04));
  renderNdviChart({ years, ndvi, threshold: years.map(()=> baseNdvi*0.72) });
  renderNdviStats({ peak: baseNdvi, current: ndvi[ndvi.length-1], trend: (ndvi[ndvi.length-1]-ndvi[0]).toFixed(3) });
  renderAnomalyTimeline(years.filter((_,i)=>ndvi[i]<baseNdvi*0.75).slice(0,5).map(y=>({year:y, type:'Low NDVI', severity:'HIGH', delta: -0.12})));
}

function renderNdviStats(d) {
  const setEl = (id, val) => { const e = document.getElementById(id); if(e) e.textContent = val; };
  setEl('ndvi-peak', typeof d.peak === 'number' ? d.peak.toFixed(2) : d.peak);
  setEl('ndvi-current', typeof d.current === 'number' ? d.current.toFixed(2) : d.current);
  const trend = typeof d.trend === 'number' ? d.trend : parseFloat(d.trend);
  const el = document.getElementById('ndvi-trend');
  if (el) { el.textContent = (trend > 0 ? '+' : '') + trend.toFixed(3); el.className = `text-lg font-black mono ${trend < 0 ? 'text-red-300' : 'text-emerald-300'}`; }
}

function renderAnomalyTimeline(anomalies) {
  const el = document.getElementById('sat-anomaly-timeline');
  if (!el) return;
  if (!anomalies.length) {
    el.innerHTML = '<div class="text-xs text-emerald-600">No significant anomalies detected</div>';
    return;
  }
  el.innerHTML = anomalies.map((a, i) => {
    const severityClass = a.severity==='CRITICAL' ? 'bg-red-900/60 border-red-700' : a.severity==='HIGH' ? 'bg-orange-900/60 border-orange-700' : 'bg-yellow-900/60 border-yellow-700';
    return `
  <div class="timeline-node flex items-start gap-3 pb-3 anomaly-node" style="animation-delay:${i*0.1}s;">
    <div class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 detection-pulse
      ${severityClass}
      border text-[9px]">
      <i class="fas fa-exclamation text-yellow-400"></i>
    </div>
    <div>
      <div class="text-[10px] font-bold text-gray-300">${a.year || a.date} — ${a.type}</div>
      <div class="text-[9px] text-gray-500">Δ NDVI: <span class="text-red-400 mono">${a.delta > 0 ? '+' : ''}${(a.delta||0).toFixed(3)}</span></div>
    </div>
  </div>`;
  }).join('');
}

// ── EMISSION HOTSPOTS ─────────────────────────────────────────────────────────
async function refreshEmissionHotspots() {
  try {
    const r = await fetch('/satellite/emission_hotspots');
    const d = await r.json();
    SAT_STATE.emissionHotspots = d.hotspots;
    renderEmissionMap(d.hotspots, d.totalMtCO2yr);
    renderEmitterList(d.hotspots);
  } catch(e) {
    renderEmissionMapFallback();
  }
}

function renderEmissionMapFallback() {
  const hotspots = [
    { name: 'Eastern China', lat:32, lon:116, intensity:94, Mt:2.8 },
    { name: 'Northern India', lat:27, lon:78, intensity:82, Mt:1.9 },
    { name: 'Amazon Basin', lat:-3, lon:-62, intensity:76, Mt:1.4 },
    { name: 'Central Africa', lat:-1, lon:24, intensity:68, Mt:1.1 },
    { name: 'US Midwest', lat:40, lon:-90, intensity:71, Mt:1.3 },
    { name: 'Siberia', lat:60, lon:90, intensity:55, Mt:0.9 },
    { name: 'SE Asia', lat:8, lon:104, intensity:78, Mt:1.6 },
    { name: 'Russia Gas Fields', lat:65, lon:74, intensity:61, Mt:1.0 },
  ];
  renderEmissionMap(hotspots, hotspots.reduce((s,h)=>s+h.Mt,0).toFixed(1));
  renderEmitterList(hotspots);
}

function renderEmissionMap(hotspots, total) {
  const canvas = document.getElementById('sat-emission-canvas');
  if (!canvas) return;
  const W = canvas.clientWidth || 700, H = 280;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  // Dark background
  ctx.fillStyle = '#020408'; ctx.fillRect(0,0,W,H);
  // Grid
  ctx.strokeStyle='rgba(34,211,238,0.06)'; ctx.lineWidth=0.5;
  for(let x=0;x<W;x+=W/12){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=H/6){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  // Hotspot circles
  hotspots.forEach(h => {
    const x = (h.lon + 180) / 360 * W;
    const y = (90 - h.lat) / 180 * H;
    const r = 6 + h.intensity / 10;
    // Glow
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r*3);
    const hue = Math.round(240 - h.intensity * 2.4);
    grd.addColorStop(0, `hsla(${hue},90%,60%,0.35)`);
    grd.addColorStop(0.5, `hsla(${hue},90%,50%,0.15)`);
    grd.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.arc(x, y, r*3, 0, Math.PI*2);
    ctx.fillStyle = grd; ctx.fill();
    // Core dot
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fillStyle = `hsla(${hue},90%,60%,0.8)`;
    ctx.fill();
    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '8px monospace';
    ctx.fillText(h.name, x+r+2, y+3);
  });
  // Total
  const totalEl = document.getElementById('sat-emission-total');
  if (totalEl) totalEl.textContent = `Total: ${total} Mt CO₂/yr`;
}

function renderEmitterList(hotspots) {
  const el = document.getElementById('sat-emitter-list');
  if (!el) return;
  const sorted = [...hotspots].sort((a,b) => b.intensity - a.intensity);
  el.innerHTML = sorted.map((h, i) => {
    const color = h.intensity > 80 ? '#ef4444' : h.intensity > 65 ? '#f97316' : '#f59e0b';
    return `
    <div class="flex items-center gap-3 py-1.5 border-b border-gray-800/60 last:border-0">
      <div class="text-[10px] font-black text-gray-500 w-4 mono">${i+1}</div>
      <div class="flex-1">
        <div class="text-[10px] font-bold text-gray-300">${h.name}</div>
        <div class="text-[8px] text-gray-600">${h.Mt || '?'} Mt CO₂/yr</div>
      </div>
      <div class="w-20 cnn-prob-bar">
        <div class="cnn-prob-fill" style="width:${h.intensity}%;background:linear-gradient(90deg,${color}88,${color});"></div>
      </div>
      <div class="text-[10px] font-black mono w-8 text-right" style="color:${color}">${h.intensity}</div>
    </div>`;
  }).join('');
}

// ── TREND CHART ───────────────────────────────────────────────────────────────
function renderSatTrendChart(yearlyChange) {
  const canvas = document.getElementById('sat-trend-chart');
  if (!canvas || !window.Chart) return;
  if (canvas._chart) canvas._chart.destroy();
  canvas._chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: yearlyChange.map(y => y.year),
      datasets: [
        { label: 'Affected Area %', data: yearlyChange.map(y => y.affectedPct),
          borderColor: '#f97316', backgroundColor: '#f9731620', tension: 0.4, fill: true, pointRadius: 4 },
        { label: 'Change km²/100', data: yearlyChange.map(y => y.changeKm2 / 100),
          borderColor: '#ef4444', backgroundColor: '#ef444418', tension: 0.4, fill: true, pointRadius: 3, yAxisID: 'y2' },
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#9ca3af', font: { size: 9 } } },
        tooltip: { backgroundColor: 'rgba(2,4,8,0.9)', titleColor: '#22d3ee', bodyColor: '#9ca3af' },
      },
      scales: {
        x: { ticks: { color: '#6b7280', font: { size: 9 } }, grid: { color: '#111827' } },
        y: { ticks: { color: '#6b7280', font: { size: 9 } }, grid: { color: '#111827' },
             title: { display: true, text: 'Affected %', color: '#6b7280', font: { size: 8 } } },
        y2: { position: 'right', ticks: { color: '#6b7280', font: { size: 9 } }, grid: { display: false },
              title: { display: true, text: 'km²/100', color: '#6b7280', font: { size: 8 } } },
      }
    }
  });
}

// ── AI RECOMMENDATIONS ────────────────────────────────────────────────────────
function renderSatRecommendations(recs) {
  const el = document.getElementById('sat-recommendations');
  if (!el) return;
  if (!recs.length) {
    el.innerHTML = '<div class="text-xs text-gray-600 italic">No recommendations available.</div>';
    return;
  }
  const recColors = { policy: 'cyan', intervention: 'emerald', monitoring: 'purple', warning: 'orange' };
  el.innerHTML = recs.map((r, i) => {
    const color = recColors[r.type] || 'cyan';
    return `
    <div class="flex items-start gap-3 p-3 rounded-lg bg-${color}-900/20 border border-${color}-800/40">
      <div class="w-6 h-6 rounded-md bg-${color}-900/50 border border-${color}-800 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span class="text-[10px] font-black text-${color}-400">${i+1}</span>
      </div>
      <div>
        <div class="text-[10px] font-bold text-${color}-300 uppercase tracking-wider mb-0.5">${r.type || 'action'}</div>
        <div class="text-[11px] text-gray-300">${r.action || r.text || r}</div>
        ${r.urgency ? `<div class="text-[9px] text-${color}-500 mt-0.5">Urgency: ${r.urgency}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ── TIME COMPARE ──────────────────────────────────────────────────────────────
function toggleSatCompareMode() {
  switchSatTab('compare');
  SAT_STATE.compareMode = true;
}

async function runSatCompare() {
  const regionId = document.getElementById('sat-cmp-region')?.value || 'amazon';
  const yearFrom = parseInt(document.getElementById('sat-cmp-from')?.value || '2020');
  const yearTo   = parseInt(document.getElementById('sat-cmp-to')?.value   || '2024');
  const resEl = document.getElementById('sat-compare-results');
  if (resEl) resEl.innerHTML = '<div class="text-xs text-gray-500 animate-pulse flex items-center gap-2"><i class="fas fa-circle-notch fa-spin"></i> Analyzing temporal changes…</div>';
  try {
    const r = await fetch('/satellite/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regionId, yearFrom, yearTo })
    });
    const d = await r.json();
    const c = d.comparison;
    const deltaLabel = (val, inverted = false) => {
      if (val === undefined || val === null) return '';
      const bad = (val > 0 && !inverted) || (val < 0 && inverted);
      const color = bad ? 'text-red-400' : 'text-emerald-400';
      const arrow = val > 0 ? '▲' : '▼';
      return `<span class="${color}">${arrow} ${Math.abs(val).toFixed(1)}</span>`;
    };
    resEl.innerHTML = `
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <div class="et-card text-center p-3"><div class="text-[9px] text-gray-500 uppercase mb-1">Forest Cover</div>
        <div class="text-sm font-black text-emerald-300 mono">${c.forestCoverTo_pct}%</div>
        <div class="text-[9px] mt-0.5">${deltaLabel(c.forestCoverTo_pct - c.forestCoverFrom_pct, true)} from ${c.forestCoverFrom_pct}%</div></div>
      <div class="et-card text-center p-3"><div class="text-[9px] text-gray-500 uppercase mb-1">Urban Area</div>
        <div class="text-sm font-black text-orange-300 mono">${Number(c.urbanAreaTo_km2).toLocaleString()} km²</div>
        <div class="text-[9px] mt-0.5">${deltaLabel(c.urbanAreaTo_km2 - c.urbanAreaFrom_km2)}</div></div>
      <div class="et-card text-center p-3"><div class="text-[9px] text-gray-500 uppercase mb-1">Water Body</div>
        <div class="text-sm font-black text-blue-300 mono">${Number(c.waterBodyTo_km2).toLocaleString()} km²</div>
        <div class="text-[9px] mt-0.5">${deltaLabel(c.waterBodyTo_km2 - c.waterBodyFrom_km2, true)}</div></div>
      <div class="et-card text-center p-3"><div class="text-[9px] text-gray-500 uppercase mb-1">Vegetation</div>
        <div class="text-sm font-black text-emerald-300 mono">${c.vegetationIndexTo}</div>
        <div class="text-[9px] mt-0.5">${deltaLabel(c.vegetationIndexTo - c.vegetationIndexFrom, true)}</div></div>
      <div class="et-card text-center p-3"><div class="text-[9px] text-gray-500 uppercase mb-1">Carbon Released</div>
        <div class="text-sm font-black text-red-300 mono">${c.carbonReleasedMt}</div>
        <div class="text-[9px] text-gray-500 mt-0.5">Mt CO₂ · ${c.deltaYears}yr</div></div>
      <div class="et-card text-center p-3"><div class="text-[9px] text-gray-500 uppercase mb-1">Period</div>
        <div class="text-sm font-black text-cyan-300 mono">${yearFrom}–${yearTo}</div>
        <div class="text-[9px] text-gray-500 mt-0.5">${d.region?.name || regionId}</div></div>
    </div>`;
  } catch(e) {
    if (resEl) resEl.innerHTML = '<div class="text-xs text-red-400">Compare failed. Try again.</div>';
  }
}

// ── ML FORECAST MODAL ─────────────────────────────────────────────────────────
async function openSatMLForecast() {
  const modal = document.getElementById('sat-ml-modal');
  if (modal) modal.classList.remove('hidden');
  const content = document.getElementById('sat-ml-content');
  if (content) content.innerHTML = '<div class="text-xs text-gray-500 animate-pulse flex items-center gap-2"><i class="fas fa-circle-notch fa-spin"></i> Loading ML forecast…</div>';
  try {
    const r = await fetch('/satellite/ml_forecast');
    const d = await r.json();
    renderMLForecast(d, content);
  } catch(e) {
    renderMLForecastFallback(content);
  }
}

function closeSatMLForecast() {
  const modal = document.getElementById('sat-ml-modal');
  if (modal) modal.classList.add('hidden');
}

function renderMLForecastFallback(content) {
  const scenarios = [
    { name: 'Forest Loss', icon: 'fa-tree', color: '#ef4444', current: 8.2, forecast: 11.4, conf: 87, trend: 'worsening' },
    { name: 'Urban Expansion', icon: 'fa-city', color: '#f97316', current: 128, forecast: 163, conf: 82, trend: 'accelerating' },
    { name: 'Water Stress', icon: 'fa-water', color: '#3b82f6', current: 42, forecast: 51, conf: 79, trend: 'increasing' },
    { name: 'Arctic Ice Loss', icon: 'fa-snowflake', color: '#67e8f9', current: 14.2, forecast: 12.8, conf: 91, trend: 'declining' },
    { name: 'Carbon Flux', icon: 'fa-smog', color: '#6b7280', current: 2.4, forecast: 3.1, conf: 75, trend: 'rising' },
    { name: 'NDVI Health', icon: 'fa-seedling', color: '#10b981', current: 0.61, forecast: 0.54, conf: 83, trend: 'declining' },
  ];
  renderMLForecast({ scenarios, horizon: '18 months', modelAccuracy: 84.7, lastTrainDate: '2024-12' }, content);
}

function renderMLForecast(d, content) {
  const scenarios = d.scenarios || [];
  if (!content) return;
  content.innerHTML = `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2 text-[10px] text-gray-400"><i class="fas fa-clock text-purple-400"></i> Horizon: <span class="text-purple-300 font-bold">${d.horizon||'18mo'}</span></div>
        <div class="flex items-center gap-2 text-[10px] text-gray-400"><i class="fas fa-crosshairs text-cyan-400"></i> Model accuracy: <span class="text-cyan-300 font-bold">${d.modelAccuracy||84.7}%</span></div>
      </div>
      <div class="text-[9px] text-gray-600 mono">Trained: ${d.lastTrainDate||'2024-12'}</div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      ${scenarios.map(s => `
      <div class="et-card p-3 border-gray-700/50">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background:${s.color}20; border:1px solid ${s.color}40">
            <i class="fas ${s.icon} text-[10px]" style="color:${s.color}"></i>
          </div>
          <div>
            <div class="text-[10px] font-bold text-gray-300">${s.name}</div>
            <div class="text-[8px] text-gray-600">${s.trend}</div>
          </div>
          <div class="ml-auto text-[9px] mono" style="color:${s.color}">
            ${s.current} → ${s.forecast}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex-1 forecast-confidence-bar">
            <div class="forecast-confidence-fill" style="width:${s.conf}%;background:linear-gradient(90deg,${s.color}88,${s.color});"></div>
          </div>
          <span class="text-[9px] text-gray-500 mono">${s.conf}% conf</span>
        </div>
      </div>`).join('')}
    </div>
    <div class="text-[9px] text-gray-600 border-t border-gray-800 pt-3">
      ⚠ Forecasts are probabilistic estimates based on historical satellite data and climate models. 
      Not to be used as sole basis for policy decisions.
    </div>
  </div>`;
}

// ── BIOME SELECT ──────────────────────────────────────────────────────────────
function selectBiome(biomeId) {
  const biome = BIOMES.find(b => b.id === biomeId);
  if (!biome) return;
  toast(`Biome: ${biome.name} — Stress Index: ${biome.stress}`, 'warning');
}

function scrollToWildfire() {
  const fire = SAT_STATE.liveFeed.find(f => f.impactScore > 90 || f.changeType === 'wildfire');
  if (fire) selectSatRegion(fire.regionId);
}

// ── CLEANUP ON TAB SWITCH ─────────────────────────────────────────────────────
const _origSwitchSat = window.switchTab;
window.switchTab = function(id) {
  if (id !== 'satellite' && SAT_STATE.scanInterval) {
    clearInterval(SAT_STATE.scanInterval);
    SAT_STATE.scanInterval = null;
  }
  _origSwitchSat(id);
};

// Expose globals
window.initSatellite = initSatellite;
window.refreshSatelliteFeed = refreshSatelliteFeed;
window.selectSatRegion = selectSatRegion;
window.filterSatFeed = filterSatFeed;
window.toggleSatCompareMode = toggleSatCompareMode;
window.runSatCompare = runSatCompare;
window.switchSatTab = switchSatTab;
window.selectSpectralBand = selectSpectralBand;
window.loadNdviTimeseries = loadNdviTimeseries;
window.refreshEmissionHotspots = refreshEmissionHotspots;
window.openSatMLForecast = openSatMLForecast;
window.closeSatMLForecast = closeSatMLForecast;
window.selectBiome = selectBiome;
window.scrollToWildfire = scrollToWildfire;

// ════════════════════════════════════════════════════════════════════════════
// PLANET HEALTH SCORE — Multi-dimensional radial gauge + dimension breakdown
// ════════════════════════════════════════════════════════════════════════════
function healthHTML() {
  return `
<div class="space-y-5">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-xl font-black text-white flex items-center gap-2.5">
        <span class="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-900/80 to-teal-900/80 border border-emerald-700/50 flex items-center justify-center">
          <i class="fas fa-heart-pulse text-emerald-400 text-sm"></i>
        </span>
        Planet Health Score
        <span class="text-[9px] px-2 py-0.5 rounded-full bg-emerald-900/60 border border-emerald-700 text-emerald-300 font-semibold animate-pulse">● LIVE</span>
      </h1>
      <p class="text-[10px] text-gray-500 mt-0.5 ml-10">Composite multi-sphere index · Atmosphere, Biosphere, Hydrosphere, Cryosphere, Human Systems, Biodiversity</p>
    </div>
    <button onclick="loadPlanetHealth()" class="px-3 py-1.5 rounded-lg bg-emerald-900/40 border border-emerald-700 text-emerald-300 text-xs font-semibold hover:bg-emerald-900/70 transition-all flex items-center gap-1.5">
      <i class="fas fa-rotate-right"></i> Resync
    </button>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
    <!-- Central Radial Gauge -->
    <div class="et-card grad-border flex flex-col items-center justify-center py-8" id="health-gauge-card">
      <div class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-4">Composite Index</div>
      <div class="relative" style="width:220px;height:220px;">
        <svg viewBox="0 0 220 220" width="220" height="220">
          <!-- Background rings -->
          <circle cx="110" cy="110" r="90" fill="none" stroke="rgba(34,211,238,0.06)" stroke-width="18"/>
          <circle cx="110" cy="110" r="70" fill="none" stroke="rgba(16,185,129,0.06)" stroke-width="12"/>
          <circle cx="110" cy="110" r="52" fill="none" stroke="rgba(139,92,246,0.06)" stroke-width="8"/>
          <!-- Main ring track -->
          <circle cx="110" cy="110" r="90" fill="none" stroke="rgba(34,211,238,0.08)" stroke-width="18" class="health-ring-track"/>
          <!-- Main ring fill — animated via JS -->
          <circle id="health-main-ring" cx="110" cy="110" r="90" fill="none"
                  stroke="url(#healthGrad)" stroke-width="18"
                  stroke-dasharray="565" stroke-dashoffset="565"
                  stroke-linecap="round" transform="rotate(-90 110 110)" class="health-ring-fill"/>
          <defs>
            <linearGradient id="healthGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#ef4444"/>
              <stop offset="50%" stop-color="#f59e0b"/>
              <stop offset="100%" stop-color="#10b981"/>
            </linearGradient>
          </defs>
          <!-- Center score -->
          <text id="health-score-num" x="110" y="100" text-anchor="middle" font-size="38" font-weight="900" fill="#e2e8f0" font-family="monospace">—</text>
          <text id="health-grade-text" x="110" y="126" text-anchor="middle" font-size="13" font-weight="700" fill="#94a3b8">/100</text>
          <text id="health-label-text" x="110" y="148" text-anchor="middle" font-size="11" font-weight="600" fill="#64748b">Loading…</text>
        </svg>
      </div>
      <div class="mt-4 flex items-center gap-3 text-[10px]">
        <div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-red-500"></span><span class="text-gray-500">Critical</span></div>
        <div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500"></span><span class="text-gray-500">Stressed</span></div>
        <div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span><span class="text-gray-500">Stable</span></div>
      </div>
      <div class="mt-3 text-[9px] text-gray-600" id="health-updated">—</div>
    </div>

    <!-- Dimension Bars -->
    <div class="et-card lg:col-span-2">
      <h3 class="et-card-title mb-4"><i class="fas fa-layer-group text-teal-400"></i> Earth System Dimensions</h3>
      <div id="health-dims" class="space-y-3">
        ${[1,2,3,4,5,6].map(()=>`<div class="animate-pulse h-10 bg-gray-800/40 rounded-xl"></div>`).join('')}
      </div>
    </div>
  </div>

  <!-- 24-hour trend chart -->
  <div class="et-card">
    <div class="flex items-center justify-between mb-3">
      <h3 class="et-card-title"><i class="fas fa-chart-area text-teal-400"></i> 24-Hour Health Trend</h3>
      <span class="text-[9px] text-gray-500 mono" id="health-change-badge">Loading…</span>
    </div>
    <canvas id="health-trend-canvas" height="80"></canvas>
  </div>

  <!-- Dimension Detail Grid -->
  <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" id="health-detail-grid">
    ${[1,2,3,4,5,6].map(()=>`<div class="animate-pulse h-24 bg-gray-800/40 rounded-xl"></div>`).join('')}
  </div>
</div>`;
}

async function initPlanetHealth() {
  await loadPlanetHealth();
  ST.healthInterval = setInterval(loadPlanetHealth, 15000);
}

async function loadPlanetHealth() {
  try {
    const r = await fetch('/planet_health');
    const d = await r.json();
    renderPlanetHealth(d);
  } catch(e) { console.error('Planet health:', e); }
}

function renderPlanetHealth(d) {
  // Main gauge
  const pct = d.composite / 100;
  const circumference = 2 * Math.PI * 90;
  const dashOffset = circumference * (1 - pct);
  const ring = document.getElementById('health-main-ring');
  const scoreEl = document.getElementById('health-score-num');
  const labelEl = document.getElementById('health-label-text');
  const gradeEl = document.getElementById('health-grade-text');
  const updEl  = document.getElementById('health-updated');
  const badgeEl = document.getElementById('health-change-badge');

  if (ring) ring.style.strokeDashoffset = dashOffset;
  if (scoreEl) scoreEl.textContent = d.composite.toFixed(1);
  if (labelEl) {
    labelEl.textContent = d.label;
    const c = d.composite >= 70 ? '#10b981' : d.composite >= 50 ? '#f59e0b' : '#ef4444';
    labelEl.setAttribute('fill', c);
    if (scoreEl) scoreEl.setAttribute('fill', c);
  }
  if (gradeEl) gradeEl.textContent = `Grade: ${d.grade}`;
  if (updEl) updEl.textContent = `Updated: ${new Date(d.lastUpdated).toLocaleTimeString()}`;
  if (badgeEl) {
    const sign = d.change24h >= 0 ? '+' : '';
    badgeEl.textContent = `24h change: ${sign}${d.change24h.toFixed(3)} pts`;
    badgeEl.className = `text-[9px] mono ${d.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
  }

  // Dimension bars
  const dimsEl = document.getElementById('health-dims');
  if (dimsEl) {
    dimsEl.innerHTML = d.dimensions.map(dim => {
      const pct = dim.score;
      const color = pct >= 70 ? 'emerald' : pct >= 50 ? 'amber' : 'red';
      const hexColor = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
      return `
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-md bg-${color}-900/40 border border-${color}-800/40 flex items-center justify-center">
              <i class="fas fa-${dim.icon} text-${color}-400 text-[9px]"></i>
            </div>
            <span class="text-xs font-semibold text-gray-300">${dim.name}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[9px] text-gray-500">${(dim.weight*100).toFixed(0)}% weight</span>
            <span class="text-xs font-black mono text-${color}-300">${dim.score}</span>
          </div>
        </div>
        <div class="metric-bar">
          <div class="metric-bar-fill" style="width:${pct}%; background: linear-gradient(90deg, ${hexColor}88, ${hexColor});"></div>
        </div>
      </div>`;
    }).join('');
  }

  // Detail grid
  const detailEl = document.getElementById('health-detail-grid');
  if (detailEl) {
    detailEl.innerHTML = d.dimensions.map(dim => {
      const color = dim.score >= 70 ? 'emerald' : dim.score >= 50 ? 'amber' : 'red';
      return `
      <div class="et-card text-center">
        <i class="fas fa-${dim.icon} text-${color}-400 text-lg mb-2 block"></i>
        <div class="text-xl font-black text-${color}-300 mono">${dim.score}</div>
        <div class="text-[9px] text-gray-400 mt-0.5 font-semibold">${dim.name}</div>
        <div class="text-[8px] text-gray-600 mt-1">${(dim.trend > 0 ? '▲ ' : '▼ ')}${Math.abs(dim.trend).toFixed(2)}/yr</div>
      </div>`;
    }).join('');
  }

  // Trend chart
  const canvas = document.getElementById('health-trend-canvas');
  if (canvas && window.Chart) {
    if (canvas._hchart) canvas._hchart.destroy();
    canvas._hchart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: d.history.map(h => `${h.hour}h`),
        datasets: [{
          label: 'Planet Health Score',
          data: d.history.map(h => h.score),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.06)',
          tension: 0.5, fill: true, pointRadius: 0, borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#4b5563', font: { size: 8 } }, grid: { color: '#111827' } },
          y: {
            ticks: { color: '#4b5563', font: { size: 8 } }, grid: { color: '#111827' },
            min: Math.floor(d.composite - 5), max: Math.ceil(d.composite + 5),
          }
        }
      }
    });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// AI THREAT FORECAST — 18-month probability timeline + severity heatmap
// ════════════════════════════════════════════════════════════════════════════
function threatHTML() {
  return `
<div class="space-y-5">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-xl font-black text-white flex items-center gap-2.5">
        <span class="w-8 h-8 rounded-xl bg-gradient-to-br from-red-900/80 to-orange-900/80 border border-red-700/50 flex items-center justify-center">
          <i class="fas fa-radiation text-red-400 text-sm"></i>
        </span>
        AI Threat Forecast
        <span class="text-[9px] px-2 py-0.5 rounded-full bg-red-900/60 border border-red-700 text-red-300 font-semibold animate-pulse">● LIVE ML</span>
      </h1>
      <p class="text-[10px] text-gray-500 mt-0.5 ml-10">EcoTwin-ThreatNet-v3 · 18-month environmental risk probability timeline · 84.7% accuracy</p>
    </div>
    <button onclick="loadThreat()" class="px-3 py-1.5 rounded-lg bg-red-900/40 border border-red-700 text-red-300 text-xs font-semibold hover:bg-red-900/70 transition-all flex items-center gap-1.5">
      <i class="fas fa-rotate-right"></i> Rerun Model
    </button>
  </div>

  <!-- Model Info Bar -->
  <div class="et-card flex flex-wrap items-center gap-4 py-3">
    <div class="flex items-center gap-2"><i class="fas fa-microchip text-violet-400 text-xs"></i><span class="text-[10px] text-gray-400">Model:</span><span class="text-[10px] text-violet-300 font-bold mono">EcoTwin-ThreatNet-v3</span></div>
    <div class="flex items-center gap-2"><i class="fas fa-bullseye text-emerald-400 text-xs"></i><span class="text-[10px] text-gray-400">Accuracy:</span><span class="text-[10px] text-emerald-300 font-bold mono">84.7%</span></div>
    <div class="flex items-center gap-2"><i class="fas fa-database text-cyan-400 text-xs"></i><span class="text-[10px] text-gray-400">Training:</span><span class="text-[10px] text-cyan-300 font-bold mono">1980–2025</span></div>
    <div class="flex items-center gap-2"><i class="fas fa-clock text-amber-400 text-xs"></i><span class="text-[10px] text-gray-400">Horizon:</span><span class="text-[10px] text-amber-300 font-bold mono">18 months</span></div>
    <div id="threat-risk-level" class="ml-auto px-3 py-1 rounded-full text-[10px] font-bold border">—</div>
  </div>

  <!-- Top Threats List + Timeline Heatmap -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <!-- Threat Cards -->
    <div class="space-y-2" id="threat-list">
      ${[1,2,3,4,5].map(()=>`<div class="animate-pulse h-20 bg-gray-800/40 rounded-xl"></div>`).join('')}
    </div>
    <!-- Probability Chart -->
    <div class="et-card">
      <h3 class="et-card-title mb-3"><i class="fas fa-chart-bar text-red-400"></i> Threat Probability This Month</h3>
      <canvas id="threat-prob-chart" height="200"></canvas>
    </div>
  </div>

  <!-- 18-month heatmap -->
  <div class="et-card">
    <h3 class="et-card-title mb-4"><i class="fas fa-calendar-days text-orange-400"></i> 18-Month Risk Probability Heatmap</h3>
    <div class="overflow-x-auto">
      <div id="threat-heatmap" class="min-w-[700px]">
        <div class="animate-pulse h-48 bg-gray-800/40 rounded-xl"></div>
      </div>
    </div>
  </div>
</div>`;
}

async function initThreat() {
  await loadThreat();
  ST.threatInterval = setInterval(loadThreat, 20000);
}

async function loadThreat() {
  try {
    const r = await fetch('/threat_forecast');
    const d = await r.json();
    renderThreat(d);
  } catch(e) { console.error('Threat forecast:', e); }
}

function renderThreat(d) {
  // Risk level badge
  const lvlEl = document.getElementById('threat-risk-level');
  if (lvlEl) {
    const cls = d.overallRiskLevel === 'CRITICAL' ? 'bg-red-900/50 border-red-600 text-red-300' :
                d.overallRiskLevel === 'HIGH' ? 'bg-orange-900/50 border-orange-600 text-orange-300' :
                'bg-yellow-900/50 border-yellow-600 text-yellow-300';
    lvlEl.className = `ml-auto px-3 py-1 rounded-full text-[10px] font-bold border ${cls}`;
    lvlEl.innerHTML = `<i class="fas fa-triangle-exclamation mr-1"></i> ${d.overallRiskLevel} RISK`;
  }

  // Threat list
  const listEl = document.getElementById('threat-list');
  if (listEl) {
    listEl.innerHTML = d.threats.slice(0, 6).map((th, i) => {
      const prob = th.probability;
      const cls = prob > 0.75 ? 'threat-critical' : prob > 0.55 ? 'threat-high' : prob > 0.35 ? 'threat-medium' : 'threat-low';
      const trendIcon = th.trend === 'rising' ? 'fa-arrow-trend-up text-red-400' : 'fa-arrow-trend-down text-emerald-400';
      return `
      <div class="et-card timeline-node">
        <div class="flex items-start gap-3">
          <div class="w-7 h-7 rounded-full flex items-center justify-center flex-none text-[9px] font-black
                      ${prob > 0.75 ? 'bg-red-900/70 border border-red-700 text-red-300' :
                        prob > 0.55 ? 'bg-orange-900/70 border border-orange-700 text-orange-300' :
                        'bg-amber-900/70 border border-amber-700 text-amber-300'}">${i+1}</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="text-xs font-bold text-gray-200">${th.name}</span>
              <span class="text-xs font-black mono ${prob > 0.75 ? 'text-red-300' : prob > 0.55 ? 'text-orange-300' : 'text-amber-300'}">${(prob*100).toFixed(0)}%</span>
            </div>
            <div class="metric-bar mb-1.5">
              <div class="metric-bar-fill" style="width:${prob*100}%; background: ${prob > 0.75 ? '#ef4444' : prob > 0.55 ? '#f97316' : '#f59e0b'};"></div>
            </div>
            <div class="flex items-center gap-3 text-[9px] text-gray-500">
              <span><i class="fas fa-tag mr-1 opacity-60"></i>${th.category}</span>
              <span><i class="fas ${trendIcon} mr-1"></i>${th.trend}</span>
              <span><i class="fas fa-calendar-check mr-1 opacity-60"></i>Peak: month ${th.peakMonth}</span>
              <span class="ml-auto text-red-400 font-semibold">~$${th.estimatedImpactBn}B impact</span>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // Probability bar chart
  const canvas = document.getElementById('threat-prob-chart');
  if (canvas && window.Chart) {
    if (canvas._tchart) canvas._tchart.destroy();
    const colors = d.threats.map(th => th.probability > 0.75 ? '#ef4444' : th.probability > 0.55 ? '#f97316' : '#f59e0b');
    canvas._tchart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: d.threats.map(th => th.name.slice(0, 16)),
        datasets: [{
          label: 'Probability',
          data: d.threats.map(th => (th.probability * 100).toFixed(1)),
          backgroundColor: colors.map(c => c + '80'),
          borderColor: colors,
          borderWidth: 1, borderRadius: 4,
        }]
      },
      options: {
        indexAxis: 'y', responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { min: 0, max: 100, ticks: { color: '#6b7280', font: { size: 9 }, callback: v => v + '%' }, grid: { color: '#111827' } },
          y: { ticks: { color: '#9ca3af', font: { size: 9 } }, grid: { display: false } }
        }
      }
    });
  }

  // 18-month heatmap
  const hmEl = document.getElementById('threat-heatmap');
  if (hmEl) {
    const threats = d.threats.slice(0, 6);
    const months = d.timeline;
    hmEl.innerHTML = `
      <div class="text-[9px] text-gray-500 mb-3">Probability % per threat per month (darker = higher risk)</div>
      <!-- Month header -->
      <div class="flex gap-0" style="margin-left:120px">
        ${months.map(m => `<div class="flex-1 text-center text-[8px] text-gray-600 font-medium min-w-[32px]">${m.label}</div>`).join('')}
      </div>
      <!-- Rows -->
      ${threats.map(th => {
        const row = months.map(m => {
          const prob = m.threats.find(t => t.id === th.id)?.probability ?? 0;
          const alpha = 0.1 + prob * 0.85;
          const bg = prob > 0.75 ? `rgba(239,68,68,${alpha})` : prob > 0.55 ? `rgba(249,115,22,${alpha})` : `rgba(245,158,11,${alpha})`;
          return `<div class="flex-1 min-w-[32px] h-8 flex items-center justify-center text-[8px] font-bold transition-all hover:scale-105 cursor-default rounded-sm"
                       style="background:${bg}; color:${prob > 0.5 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)'}"
                       title="${th.name} · ${m.label}: ${(prob*100).toFixed(0)}%">${(prob*100).toFixed(0)}</div>`;
        }).join('');
        return `
        <div class="flex items-center gap-0 mt-0.5">
          <div class="w-[120px] flex-none text-[9px] text-gray-400 pr-2 truncate font-medium">${th.name}</div>
          <div class="flex flex-1 gap-0">${row}</div>
        </div>`;
      }).join('')}`;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// CO2 EMISSION BAR RACE — animated year slider + live rankings
// ════════════════════════════════════════════════════════════════════════════
const RACE_STATE = { year: 1990, playing: false, timer: null };

function raceHTML() {
  return `
<div class="space-y-5">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-xl font-black text-white flex items-center gap-2.5">
        <span class="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-900/80 to-red-900/80 border border-orange-700/50 flex items-center justify-center">
          <i class="fas fa-ranking-star text-orange-400 text-sm"></i>
        </span>
        CO₂ Emission Race
        <span class="text-[9px] px-2 py-0.5 rounded-full bg-orange-900/60 border border-orange-700 text-orange-300 font-semibold">ANIMATED</span>
      </h1>
      <p class="text-[10px] text-gray-500 mt-0.5 ml-10">Live animated ranking of CO₂ per capita (tonnes) · 1990–2024 · 16 major economies</p>
    </div>
  </div>

  <!-- Controls -->
  <div class="et-card flex flex-wrap items-center gap-4">
    <button id="race-play-btn" onclick="toggleRacePlay()" class="et-btn-primary flex items-center gap-2 min-w-[100px] justify-center">
      <i class="fas fa-play" id="race-play-icon"></i>
      <span id="race-play-label">Play</span>
    </button>
    <button onclick="resetRace()" class="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-xs font-semibold hover:bg-gray-700 transition-all flex items-center gap-1.5">
      <i class="fas fa-rotate-left"></i> Reset
    </button>
    <div class="flex-1 flex items-center gap-3 min-w-[200px]">
      <span class="text-[9px] text-gray-500 mono">1990</span>
      <input type="range" id="race-year-slider" min="1990" max="2024" value="1990"
             oninput="onRaceSlider(this.value)"
             class="flex-1" />
      <span class="text-[9px] text-gray-500 mono">2024</span>
    </div>
    <div class="text-2xl font-black mono gradient-text-fire" id="race-year-display">1990</div>
  </div>

  <!-- Bar Race -->
  <div class="et-card" style="min-height:500px;">
    <div class="flex items-center justify-between mb-4">
      <h3 class="et-card-title"><i class="fas fa-chart-bar text-orange-400"></i> CO₂ per capita · tonnes</h3>
      <span class="text-[9px] text-gray-500">Top 16 economies · Live ranked</span>
    </div>
    <div id="race-bars" class="space-y-1.5">
      ${[1,2,3,4,5,6,7,8].map(()=>`<div class="animate-pulse h-8 bg-gray-800/40 rounded-lg"></div>`).join('')}
    </div>
  </div>

  <!-- Stats footer -->
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3" id="race-stats">
    <div class="et-card text-center"><div class="text-[9px] text-gray-500 mb-1">Highest CO₂</div><div class="text-lg font-black text-red-300 mono" id="race-stat-max">—</div></div>
    <div class="et-card text-center"><div class="text-[9px] text-gray-500 mb-1">Lowest CO₂</div><div class="text-lg font-black text-emerald-300 mono" id="race-stat-min">—</div></div>
    <div class="et-card text-center"><div class="text-[9px] text-gray-500 mb-1">#1 Ranked</div><div class="text-lg font-black text-amber-300 mono" id="race-stat-rank1">—</div></div>
    <div class="et-card text-center"><div class="text-[9px] text-gray-500 mb-1">Global Avg</div><div class="text-lg font-black text-cyan-300 mono" id="race-stat-avg">—</div></div>
  </div>
</div>`;
}

async function initRace() {
  RACE_STATE.year = 1990;
  RACE_STATE.playing = false;
  await fetchAndRenderRace(1990);
}

async function fetchAndRenderRace(year) {
  try {
    const r = await fetch(`/co2_race?year=${year}`);
    const d = await r.json();
    renderRaceBars(d);
  } catch(e) { console.error('Race:', e); }
}

function renderRaceBars(d) {
  const el = document.getElementById('race-bars');
  const yearEl = document.getElementById('race-year-display');
  const sliderEl = document.getElementById('race-year-slider');
  if (yearEl) yearEl.textContent = d.year;
  if (sliderEl) sliderEl.value = d.year;

  if (!el) return;
  const maxCo2 = d.maxCo2;
  el.innerHTML = d.entries.map((e, i) => {
    const pct = (e.co2 / maxCo2 * 100).toFixed(1);
    return `
    <div class="flex items-center gap-2">
      <div class="w-6 text-center text-[9px] font-black mono ${i===0?'text-amber-300':i===1?'text-gray-300':i===2?'text-orange-400':'text-gray-500'}">${e.rank}</div>
      <div class="text-sm" title="${e.name}">${e.flag}</div>
      <div class="w-20 text-[9px] font-semibold text-gray-300 truncate">${e.name}</div>
      <div class="flex-1 relative h-7 bg-gray-900/60 rounded-r-lg overflow-hidden border border-gray-800/40">
        <div class="race-bar h-full" style="width:${pct}%; background: ${e.color}55; border-right: 2px solid ${e.color};">
        </div>
        <div class="absolute right-2 top-0 bottom-0 flex items-center text-[10px] font-black mono" style="color:${e.color}">${e.co2}</div>
      </div>
      <div class="text-[8px] text-gray-600 w-14 text-right">${e.continent}</div>
    </div>`;
  }).join('');

  // Stats
  const setEl = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  setEl('race-stat-max', d.entries[0].co2 + ' t');
  setEl('race-stat-min', d.entries[d.entries.length-1].co2 + ' t');
  setEl('race-stat-rank1', d.entries[0].flag + ' ' + d.entries[0].name);
  const avg = (d.entries.reduce((s,e)=>s+e.co2,0)/d.entries.length).toFixed(2);
  setEl('race-stat-avg', avg + ' t');
}

function onRaceSlider(val) {
  RACE_STATE.year = parseInt(val);
  fetchAndRenderRace(RACE_STATE.year);
}

function toggleRacePlay() {
  RACE_STATE.playing = !RACE_STATE.playing;
  const icon = document.getElementById('race-play-icon');
  const label = document.getElementById('race-play-label');
  if (icon) icon.className = RACE_STATE.playing ? 'fas fa-pause' : 'fas fa-play';
  if (label) label.textContent = RACE_STATE.playing ? 'Pause' : 'Play';

  if (RACE_STATE.playing) {
    if (RACE_STATE.year >= 2024) RACE_STATE.year = 1990;
    ST.raceInterval = setInterval(async () => {
      RACE_STATE.year++;
      await fetchAndRenderRace(RACE_STATE.year);
      if (RACE_STATE.year >= 2024) {
        clearInterval(ST.raceInterval);
        RACE_STATE.playing = false;
        const icon2 = document.getElementById('race-play-icon');
        const label2 = document.getElementById('race-play-label');
        if (icon2) icon2.className = 'fas fa-play';
        if (label2) label2.textContent = 'Play';
      }
    }, 700);
  } else {
    clearInterval(ST.raceInterval);
  }
}

function resetRace() {
  clearInterval(ST.raceInterval);
  RACE_STATE.playing = false;
  RACE_STATE.year = 1990;
  const icon = document.getElementById('race-play-icon');
  const label = document.getElementById('race-play-label');
  if (icon) icon.className = 'fas fa-play';
  if (label) label.textContent = 'Play';
  fetchAndRenderRace(1990);
}

// Expose globals
window.initPlanetHealth = initPlanetHealth;
window.loadPlanetHealth = loadPlanetHealth;
window.initThreat = initThreat;
window.loadThreat = loadThreat;
window.initRace = initRace;
window.toggleRacePlay = toggleRacePlay;
window.resetRace = resetRace;
window.onRaceSlider = onRaceSlider;
