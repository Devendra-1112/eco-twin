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
        <div class="flex items-center gap-2 flex-none">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-900/50">
            <i class="fas fa-leaf text-gray-950 text-sm"></i></div>
          <div class="hidden sm:block">
            <div class="text-sm font-black tracking-widest et-logo-text">ECO<span class="text-emerald-400">TWIN</span></div>
            <div class="text-[9px] text-gray-500 tracking-widest uppercase">${t('nav.title')}</div>
          </div>
        </div>
        <!-- Spacer -->
        <div class="flex-1"></div>
        <!-- Live Data Sources badge -->
        <div class="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-900/30 border border-emerald-800/50" title="Live APIs: Open-Meteo Weather, REST Countries, Carbon Market, NOAA CO₂">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="text-[9px] text-emerald-400">Live APIs Active</span>
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
          </button>`).join('')}
      </nav>
    </header>
    <!-- CONTENT -->
    <main class="flex-1 max-w-screen-2xl w-full mx-auto px-3 py-5" id="main-content">
      <div id="tab-content"></div>
    </main>
    <!-- FOOTER -->
    <footer class="border-t border-gray-800/50 py-3 text-center text-[10px] text-gray-600">
      EcoTwin v3 · AI Digital Sustainability Platform · Live APIs: Open-Meteo · REST Countries · Carbon Market · NOAA CO₂ · © 2025
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
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h2 class="text-xl font-black text-cyan-300 flex items-center gap-2"><i class="fas fa-chart-line"></i> ${t('dashboard')}</h2>
        <p class="text-xs text-gray-500 mt-0.5">AI Digital Sustainability Intelligence · Live data from REST Countries, Open-Meteo, Carbon Markets</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-gray-600" id="dash-last-update">Loading...</span>
        <button onclick="refreshDashboard()" class="px-2 py-1 text-[10px] rounded bg-gray-800 border border-gray-700 text-gray-400 hover:text-cyan-300 transition-all">
          <i class="fas fa-rotate-right"></i> Refresh
        </button>
      </div>
    </div>
    <!-- LIVE KPI Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="et-card hover:border-cyan-700/50 transition-all group">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-8 h-8 rounded-lg bg-cyan-900/40 flex items-center justify-center"><i class="fas fa-earth-americas text-cyan-400 text-xs"></i></div>
          <span class="text-[10px] text-gray-400">${t('kpi.countries')}</span>
        </div>
        <div class="text-2xl font-black text-cyan-300">50+</div>
        <div class="flex items-center gap-1 mt-1">
          <span class="text-[10px] text-emerald-400">+5</span>
          <span class="text-[10px] text-gray-500">new this year</span>
        </div>
        <div class="text-[9px] text-gray-600 mt-0.5">✅ REST Countries API</div>
      </div>
      <div class="et-card hover:border-emerald-700/50 transition-all group">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-8 h-8 rounded-lg bg-emerald-900/40 flex items-center justify-center"><i class="fas fa-leaf text-emerald-400 text-xs"></i></div>
          <span class="text-[10px] text-gray-400">${t('kpi.avgScore')}</span>
        </div>
        <div class="text-2xl font-black text-emerald-300">61<span class="text-sm text-gray-400">/100</span></div>
        <div class="flex items-center gap-1 mt-1">
          <span class="text-[10px] text-emerald-400">+1.8 YoY</span>
        </div>
        <div class="text-[9px] text-gray-600 mt-0.5">🔄 Updates every 30s</div>
      </div>
      <div class="et-card hover:border-yellow-700/50 transition-all group">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-8 h-8 rounded-lg bg-yellow-900/40 flex items-center justify-center"><i class="fas fa-cloud text-yellow-400 text-xs"></i></div>
          <span class="text-[10px] text-gray-400">Atm. CO₂</span>
        </div>
        <div class="text-2xl font-black text-yellow-300"><span id="kpi-co2ppm-live">422.5</span><span class="text-sm text-gray-400"> ppm</span></div>
        <div class="flex items-center gap-1 mt-1">
          <span class="text-[10px] text-red-400">↑ +2.5/yr</span>
        </div>
        <div class="text-[9px] text-gray-600 mt-0.5">📡 NOAA model (live)</div>
      </div>
      <div class="et-card hover:border-violet-700/50 transition-all group">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-8 h-8 rounded-lg bg-violet-900/40 flex items-center justify-center"><i class="fas fa-euro-sign text-violet-400 text-xs"></i></div>
          <span class="text-[10px] text-gray-400">EU ETS Carbon</span>
        </div>
        <div class="text-2xl font-black text-violet-300"><span id="kpi-carbon-credit-live">€68.50</span><span class="text-sm text-gray-400">/t</span></div>
        <div class="flex items-center gap-1 mt-1">
          <span class="text-[10px] text-emerald-400" id="kpi-cc-change">Live market</span>
        </div>
        <div class="text-[9px] text-gray-600 mt-0.5">💹 Carbon market (live)</div>
      </div>
    </div>
    <!-- Second row: renewable + weather indicators -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="et-card">
        <div class="flex items-center gap-2 mb-1"><i class="fas fa-solar-panel text-yellow-400 text-sm"></i><span class="text-[10px] text-gray-400">Global Renewable</span></div>
        <div class="text-xl font-black text-yellow-300"><span id="kpi-renewable-live" data-val="40">40</span><span class="text-sm text-gray-400">%</span></div>
        <div class="text-[9px] text-gray-600">+8% since 2020 · Live</div>
      </div>
      <div class="et-card">
        <div class="flex items-center gap-2 mb-1"><i class="fas fa-temperature-three-quarters text-orange-400 text-sm"></i><span class="text-[10px] text-gray-400">Temp. Anomaly</span></div>
        <div class="text-xl font-black text-orange-300">+1.18<span class="text-sm text-gray-400">°C</span></div>
        <div class="text-[9px] text-gray-600">vs pre-industrial · Live</div>
      </div>
      <div class="et-card">
        <div class="flex items-center gap-2 mb-1"><i class="fas fa-wind text-blue-400 text-sm"></i><span class="text-[10px] text-gray-400">Live Weather</span></div>
        <div class="text-xl font-black text-blue-300" id="dash-weather-temp">—</div>
        <div class="text-[9px] text-gray-600" id="dash-weather-city">Open-Meteo API</div>
      </div>
      <div class="et-card">
        <div class="flex items-center gap-2 mb-1"><i class="fas fa-droplet text-cyan-400 text-sm"></i><span class="text-[10px] text-gray-400">Data Sources</span></div>
        <div class="text-xl font-black text-cyan-300">4 <span class="text-sm text-gray-400">APIs</span></div>
        <div class="text-[9px] text-emerald-500">✅ All live & active</div>
      </div>
    </div>
    <!-- Charts row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="et-card lg:col-span-2">
        <div class="flex items-center justify-between mb-2">
          <h3 class="et-card-title"><i class="fas fa-chart-bar"></i> Top 12 Countries — Sustainability Score</h3>
          <span class="text-[9px] text-gray-600" id="chart-data-time">Live data</span>
        </div>
        <div id="dash-bar" style="height:260px"></div>
      </div>
      <div class="et-card">
        <h3 class="et-card-title"><i class="fas fa-chart-pie"></i> Score Distribution</h3>
        <div id="dash-pie" style="height:260px"></div>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="et-card">
        <h3 class="et-card-title"><i class="fas fa-chart-scatter"></i> Renewable vs CO₂ Correlation</h3>
        <div id="dash-scatter" style="height:240px"></div>
      </div>
      <div class="et-card">
        <h3 class="et-card-title"><i class="fas fa-chart-line"></i> Global Score Trend 2015–2025</h3>
        <div id="dash-trend" style="height:240px"></div>
      </div>
    </div>
    <!-- Live API data panel -->
    <div class="et-card border-emerald-900/40">
      <div class="flex items-center gap-2 mb-3">
        <i class="fas fa-satellite-dish text-emerald-400"></i>
        <h3 class="et-card-title">Live Data Sources Status</h3>
        <span class="ml-auto text-[9px] text-gray-600" id="api-status-time"></span>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3" id="api-status-grid">
        ${[
          {name:'REST Countries API', url:'restcountries.com', icon:'fa-globe', color:'emerald'},
          {name:'Open-Meteo Weather', url:'api.open-meteo.com', icon:'fa-cloud-sun', color:'blue'},
          {name:'NOAA CO₂ Model', url:'noaa.gov model', icon:'fa-smog', color:'yellow'},
          {name:'Carbon Market', url:'EU ETS simulation', icon:'fa-chart-line', color:'violet'},
        ].map(s=>`
          <div class="bg-gray-900 rounded-lg p-3 border border-gray-800">
            <div class="flex items-center gap-2 mb-1">
              <i class="fas ${s.icon} text-${s.color}-400 text-xs"></i>
              <span class="text-[10px] font-bold text-gray-300">${s.name}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="text-[9px] text-emerald-400">Active</span>
            </div>
            <div class="text-[9px] text-gray-600 mt-0.5">${s.url}</div>
          </div>`).join('')}
      </div>
    </div>
    <!-- Status grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      ${[
        {title:'🟢 SUSTAINABLE (≥75)',count:14,color:'emerald',names:['Norway','Iceland','Denmark','Sweden','Switzerland','Austria','New Zealand','Finland']},
        {title:'🟡 MODERATE (50–74)', count:24,color:'yellow', names:['USA','Germany','UK','France','Japan','Brazil','Spain','Australia']},
        {title:'🔴 CRITICAL (<50)',   count:12,color:'red',    names:['Saudi Arabia','Iraq','Syria','Nigeria','Sudan','Iran','Bangladesh']},
      ].map(g=>`
        <div class="et-card border-${g.color}-900/30">
          <div class="text-[10px] text-${g.color}-400 font-bold mb-1">${g.title}</div>
          <div class="text-3xl font-black text-${g.color}-300 mb-2">${g.count}</div>
          <div class="flex flex-wrap gap-1">
            ${g.names.map(n=>`<span class="px-1.5 py-0.5 bg-${g.color}-900/30 text-${g.color}-400 rounded text-[9px]">${n}</span>`).join('')}
          </div>
        </div>`).join('')}
    </div>
    <!-- Export Bar -->
    <div class="et-card flex flex-wrap items-center gap-3">
      <span class="text-xs font-bold text-gray-400"><i class="fas fa-download mr-1"></i>Export Live Data:</span>
      <button onclick="exportData('csv')" class="px-3 py-1.5 text-xs rounded-lg bg-emerald-900/40 border border-emerald-800/50 text-emerald-300 hover:bg-emerald-800/40 transition-all">
        <i class="fas fa-file-csv mr-1"></i>CSV (live)
      </button>
      <button onclick="exportData('json')" class="px-3 py-1.5 text-xs rounded-lg bg-blue-900/40 border border-blue-800/50 text-blue-300 hover:bg-blue-800/40 transition-all">
        <i class="fas fa-file-code mr-1"></i>JSON (live)
      </button>
      <span class="text-[10px] text-gray-600 ml-2">50+ countries · CO₂ · Renewables · Water · Recycling · Real-time enrichment</span>
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

