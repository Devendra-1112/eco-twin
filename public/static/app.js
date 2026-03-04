/* ========================================================
   EcoTwin Smart City Digital Twin — Main Application
   ======================================================== */

'use strict';

// ─── App State ───────────────────────────────────────────
const state = {
  activeTab: 'dashboard',
  worldData: [],
  anomalyData: [],
  sdgData: null,
  simulationResult: null,
  rlResult: null,
  chatHistory: [],
  charts: {},
  globeAnimFrame: null,
  globeRotating: true,
};

// ─── Country ISO → Lat/Lon map for globe ─────────────────
const COUNTRY_COORDS = {
  USA:{lat:37.09,lon:-95.71},CHN:{lat:35.86,lon:104.19},IND:{lat:20.59,lon:78.96},
  DEU:{lat:51.16,lon:10.45},NOR:{lat:60.47,lon:8.46},BRA:{lat:-14.23,lon:-51.92},
  RUS:{lat:61.52,lon:105.31},AUS:{lat:-25.27,lon:133.77},JPN:{lat:36.20,lon:138.25},
  FRA:{lat:46.22,lon:2.21},CAN:{lat:56.13,lon:-106.34},GBR:{lat:55.37,lon:-3.43},
  SWE:{lat:60.12,lon:18.64},DNK:{lat:56.26,lon:9.50},ZAF:{lat:-30.55,lon:22.93},
  NGA:{lat:9.08,lon:8.67},MEX:{lat:23.63,lon:-102.55},IDN:{lat:-0.78,lon:113.92},
  PAK:{lat:30.37,lon:69.34},BGD:{lat:23.68,lon:90.35},ARG:{lat:-38.41,lon:-63.61},
  EGY:{lat:26.82,lon:30.80},KOR:{lat:35.90,lon:127.76},SAU:{lat:23.88,lon:45.07},
  TUR:{lat:38.96,lon:35.24},ESP:{lat:40.46,lon:-3.74},ITA:{lat:41.87,lon:12.56},
  NLD:{lat:52.13,lon:5.29},CHE:{lat:46.81,lon:8.22},FIN:{lat:61.92,lon:25.74},
  NZL:{lat:-40.90,lon:174.88},CHL:{lat:-35.67,lon:-71.54},AUT:{lat:47.51,lon:14.55},
  ISL:{lat:64.96,lon:-19.02},PRT:{lat:39.39,lon:-8.22},SGP:{lat:1.35,lon:103.81},
  SWE:{lat:60.12,lon:18.64},
};

// ─── Utility ──────────────────────────────────────────────
function scoreColor(s) {
  if (s >= 75) return '#10b981';
  if (s >= 50) return '#f59e0b';
  return '#ef4444';
}
function scoreLabel(s) {
  if (s >= 75) return 'Sustainable';
  if (s >= 50) return 'Moderate';
  return 'Critical';
}
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ─── Render Shell ─────────────────────────────────────────
function renderShell() {
  document.getElementById('root').innerHTML = `
    <div class="min-h-screen bg-gray-950 text-gray-100">
      <!-- Header -->
      <header class="border-b border-cyan-900/40 bg-gray-950/90 backdrop-blur sticky top-0 z-50">
        <div class="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 to-emerald-500 flex items-center justify-center">
              <i class="fas fa-globe text-gray-950 text-sm"></i>
            </div>
            <div>
              <h1 class="text-lg font-bold tracking-widest text-cyan-300">ECO<span class="text-emerald-400">TWIN</span></h1>
              <p class="text-[10px] text-gray-500 tracking-widest uppercase">Smart City Digital Twin</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="animate-pulse w-2 h-2 rounded-full bg-emerald-400"></span>
            <span class="text-xs text-emerald-400">Live · 60+ Nations</span>
          </div>
        </div>
        <!-- Nav Tabs -->
        <nav class="max-w-screen-2xl mx-auto px-4 flex gap-1 overflow-x-auto pb-1 scrollbar-hide" id="nav-tabs">
          ${[
            ['dashboard',  'fa-chart-line',    'Dashboard'],
            ['map',        'fa-earth-americas', 'World Map'],
            ['simulator',  'fa-sliders',        'Simulator'],
            ['rl',         'fa-brain',          'RL Optimizer'],
            ['anomaly',    'fa-triangle-exclamation','Anomaly'],
            ['globe3d',    'fa-globe',          '3D Globe'],
            ['sdg',        'fa-bullseye',       'SDG Tracker'],
            ['ai',         'fa-comments',       'Ask AI'],
          ].map(([id, icon, label]) => `
            <button onclick="switchTab('${id}')" id="tab-${id}"
              class="tab-btn flex-none px-3 py-1.5 rounded-t text-xs font-semibold transition-all flex items-center gap-1.5
                     ${state.activeTab === id ? 'bg-cyan-900/60 text-cyan-300 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-gray-200'}">
              <i class="fas ${icon} text-[10px]"></i>${label}
            </button>
          `).join('')}
        </nav>
      </header>

      <!-- Main Content -->
      <main class="max-w-screen-2xl mx-auto px-4 py-6" id="main-content">
        <div id="tab-content"></div>
      </main>

      <!-- Footer -->
      <footer class="border-t border-gray-800 text-center py-4 text-xs text-gray-600 mt-8">
        EcoTwin Digital Twin Platform · Powered by AI · © 2025
      </footer>
    </div>
  `;
  renderTab(state.activeTab);
}

function switchTab(id) {
  state.activeTab = id;
  // Update tab styles
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const bid = btn.id.replace('tab-', '');
    btn.className = btn.className.replace(/bg-cyan-900\/60 text-cyan-300 border-b-2 border-cyan-400/g, '');
    if (bid === id) {
      btn.classList.add('bg-cyan-900/60', 'text-cyan-300', 'border-b-2', 'border-cyan-400');
      btn.classList.remove('text-gray-400');
    } else {
      btn.classList.add('text-gray-400');
      btn.classList.remove('bg-cyan-900/60','text-cyan-300','border-b-2','border-cyan-400');
    }
  });
  if (state.globeAnimFrame) { cancelAnimationFrame(state.globeAnimFrame); state.globeAnimFrame = null; }
  renderTab(id);
}

function renderTab(id) {
  const el = document.getElementById('tab-content');
  if (id === 'dashboard')  { el.innerHTML = dashboardHTML(); initDashboard(); }
  else if (id === 'map')   { el.innerHTML = mapHTML();       initMap(); }
  else if (id === 'simulator') { el.innerHTML = simulatorHTML(); initSimulator(); }
  else if (id === 'rl')    { el.innerHTML = rlHTML();        }
  else if (id === 'anomaly') { el.innerHTML = anomalyHTML(); loadAnomaly(); }
  else if (id === 'globe3d') { el.innerHTML = globe3dHTML(); initGlobe3D(); }
  else if (id === 'sdg')   { el.innerHTML = sdgHTML();       loadSDG(); }
  else if (id === 'ai')    { el.innerHTML = aiHTML();        initAI(); }
}

// ═══════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════
function dashboardHTML() {
  return `
  <div class="space-y-6">
    <!-- KPI Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      ${[
        {icon:'fa-earth-americas',label:'Countries Tracked',value:'60+',sub:'Global coverage',color:'cyan'},
        {icon:'fa-leaf',label:'Avg Sustainability',value:'61/100',sub:'+3.2 vs 2024',color:'emerald'},
        {icon:'fa-cloud',label:'Avg CO₂/capita',value:'6.2t',sub:'−1.1t vs 2020',color:'yellow'},
        {icon:'fa-solar-panel',label:'Global Renewable',value:'40%',sub:'+8% since 2020',color:'violet'},
      ].map(k=>`
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-${k.color}-700 transition-all">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-8 h-8 rounded-lg bg-${k.color}-900/50 flex items-center justify-center">
              <i class="fas ${k.icon} text-${k.color}-400 text-sm"></i>
            </div>
            <span class="text-xs text-gray-400">${k.label}</span>
          </div>
          <div class="text-2xl font-bold text-${k.color}-300">${k.value}</div>
          <div class="text-xs text-gray-500 mt-1">${k.sub}</div>
        </div>
      `).join('')}
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 class="text-sm font-bold text-cyan-300 mb-4 flex items-center gap-2">
          <i class="fas fa-chart-bar"></i> Top 10 Countries by Sustainability Score
        </h3>
        <div id="dash-bar-chart" style="height:280px"></div>
      </div>
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 class="text-sm font-bold text-cyan-300 mb-4 flex items-center gap-2">
          <i class="fas fa-chart-scatter"></i> Renewable Energy vs CO₂ Correlation
        </h3>
        <div id="dash-scatter-chart" style="height:280px"></div>
      </div>
    </div>

    <!-- Trend chart -->
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 class="text-sm font-bold text-cyan-300 mb-4 flex items-center gap-2">
        <i class="fas fa-chart-line"></i> Global Sustainability Score Trend (2015–2025)
      </h3>
      <div id="dash-trend-chart" style="height:220px"></div>
    </div>

    <!-- Status Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-gray-900 border border-emerald-900/40 rounded-xl p-4">
        <div class="text-xs text-emerald-400 font-bold mb-2">🟢 SUSTAINABLE (≥75)</div>
        <div class="text-3xl font-bold text-emerald-300">14</div>
        <div class="text-xs text-gray-500 mt-1">Countries on green path</div>
        <div class="mt-3 flex flex-wrap gap-1">
          ${['Norway','Iceland','Denmark','Sweden','Switzerland','Austria','New Zealand'].map(c=>`<span class="px-2 py-0.5 bg-emerald-900/40 text-emerald-400 rounded text-[10px]">${c}</span>`).join('')}
        </div>
      </div>
      <div class="bg-gray-900 border border-yellow-900/40 rounded-xl p-4">
        <div class="text-xs text-yellow-400 font-bold mb-2">🟡 MODERATE (50–74)</div>
        <div class="text-3xl font-bold text-yellow-300">32</div>
        <div class="text-xs text-gray-500 mt-1">Transitioning nations</div>
        <div class="mt-3 flex flex-wrap gap-1">
          ${['USA','Germany','UK','France','Japan','Brazil'].map(c=>`<span class="px-2 py-0.5 bg-yellow-900/40 text-yellow-400 rounded text-[10px]">${c}</span>`).join('')}
        </div>
      </div>
      <div class="bg-gray-900 border border-red-900/40 rounded-xl p-4">
        <div class="text-xs text-red-400 font-bold mb-2">🔴 CRITICAL (&lt;50)</div>
        <div class="text-3xl font-bold text-red-300">14</div>
        <div class="text-xs text-gray-500 mt-1">Urgent intervention needed</div>
        <div class="mt-3 flex flex-wrap gap-1">
          ${['Saudi Arabia','Iraq','Syria','Nigeria','Sudan','Iran'].map(c=>`<span class="px-2 py-0.5 bg-red-900/40 text-red-400 rounded text-[10px]">${c}</span>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

async function initDashboard() {
  if (state.worldData.length === 0) {
    const res = await fetch('/world_data');
    state.worldData = await res.json();
  }
  const data = state.worldData;

  // Bar chart - top 10
  const top10 = [...data].sort((a,b)=>b.score-a.score).slice(0,10);
  Plotly.newPlot('dash-bar-chart', [{
    type: 'bar', orientation: 'h',
    x: top10.map(d=>d.score),
    y: top10.map(d=>d.name),
    marker: { color: top10.map(d=>scoreColor(d.score)), opacity: 0.85 },
    text: top10.map(d=>d.score),
    textposition: 'outside',
  }], {
    paper_bgcolor:'transparent', plot_bgcolor:'transparent',
    margin:{l:100,r:40,t:10,b:30},
    xaxis:{color:'#6b7280',range:[0,100],gridcolor:'#1f2937'},
    yaxis:{color:'#9ca3af'},
    font:{color:'#d1d5db',size:11},
  }, {responsive:true,displayModeBar:false});

  // Scatter
  Plotly.newPlot('dash-scatter-chart', [{
    type: 'scatter', mode: 'markers+text',
    x: data.map(d=>d.renewable),
    y: data.map(d=>d.co2),
    text: data.map(d=>d.code),
    textposition:'top center',
    marker:{
      size: data.map(d=>8+d.score/10),
      color: data.map(d=>d.score),
      colorscale: [['0','#ef4444'],['0.5','#f59e0b'],['1','#10b981']],
      showscale: true,
      colorbar:{title:'Score',titlefont:{color:'#9ca3af'},tickfont:{color:'#9ca3af'},len:0.7},
    },
    hovertemplate:'<b>%{text}</b><br>Renewable: %{x}%<br>CO₂: %{y}t<extra></extra>',
  }], {
    paper_bgcolor:'transparent', plot_bgcolor:'rgba(17,24,39,0.5)',
    margin:{l:50,r:20,t:10,b:40},
    xaxis:{title:'Renewable %',color:'#6b7280',gridcolor:'#1f2937'},
    yaxis:{title:'CO₂ t/cap',color:'#6b7280',gridcolor:'#1f2937'},
    font:{color:'#d1d5db',size:10},
  }, {responsive:true,displayModeBar:false});

  // Trend
  const years = [2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025];
  const scores = [52,53,54,55,56,56,57,58,59,60,61];
  Plotly.newPlot('dash-trend-chart', [{
    type:'scatter', mode:'lines+markers',
    x:years, y:scores,
    line:{color:'#22d3ee',width:3},
    marker:{color:'#22d3ee',size:6},
    fill:'tozeroy',
    fillcolor:'rgba(34,211,238,0.08)',
    name:'Global Avg Score',
  }], {
    paper_bgcolor:'transparent', plot_bgcolor:'rgba(17,24,39,0.5)',
    margin:{l:50,r:20,t:10,b:40},
    xaxis:{color:'#6b7280',gridcolor:'#1f2937'},
    yaxis:{color:'#6b7280',gridcolor:'#1f2937',range:[40,80]},
    font:{color:'#d1d5db',size:11},
  }, {responsive:true,displayModeBar:false});
}

// ═══════════════════════════════════════════════════════════
//  WORLD MAP
// ═══════════════════════════════════════════════════════════
function mapHTML() {
  return `
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-4">
      <h2 class="text-lg font-bold text-cyan-300 flex items-center gap-2">
        <i class="fas fa-earth-americas"></i> Interactive Sustainability World Map
      </h2>
      <div class="ml-auto flex gap-2">
        <button onclick="filterMap('all')" id="map-all" class="map-filter-btn px-3 py-1 text-xs rounded bg-cyan-700 text-white">All</button>
        <button onclick="filterMap('green')" id="map-green" class="map-filter-btn px-3 py-1 text-xs rounded bg-gray-700 text-gray-300">🟢 Sustainable</button>
        <button onclick="filterMap('yellow')" id="map-yellow" class="map-filter-btn px-3 py-1 text-xs rounded bg-gray-700 text-gray-300">🟡 Moderate</button>
        <button onclick="filterMap('red')" id="map-red" class="map-filter-btn px-3 py-1 text-xs rounded bg-gray-700 text-gray-300">🔴 Critical</button>
      </div>
    </div>
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-3">
      <div id="world-map" style="height:500px"></div>
    </div>
    <!-- Legend -->
    <div class="flex gap-4 text-xs">
      <span class="flex items-center gap-1"><span class="w-4 h-4 bg-emerald-500 rounded"></span>Sustainable (75+)</span>
      <span class="flex items-center gap-1"><span class="w-4 h-4 bg-yellow-500 rounded"></span>Moderate (50–74)</span>
      <span class="flex items-center gap-1"><span class="w-4 h-4 bg-red-500 rounded"></span>Critical (&lt;50)</span>
    </div>
    <!-- Country detail -->
    <div id="country-detail" class="hidden bg-gray-900 border border-cyan-800 rounded-xl p-5"></div>
    <!-- Year animation -->
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h3 class="text-sm font-bold text-cyan-300 mb-3">Time Traveler: 2015 → 2030</h3>
      <div class="flex items-center gap-4">
        <input type="range" min="2015" max="2030" value="2025" id="year-slider"
               class="flex-1 accent-cyan-400" oninput="animateYear(this.value)">
        <span class="text-cyan-300 font-bold text-lg w-16 text-center" id="year-label">2025</span>
      </div>
      <p class="text-xs text-gray-500 mt-2">Drag to simulate historical & future sustainability projections</p>
    </div>
  </div>`;
}

let mapFilter = 'all';
async function initMap() {
  if (state.worldData.length === 0) {
    const res = await fetch('/world_data');
    state.worldData = await res.json();
  }
  drawMap(state.worldData);
}

function filterMap(f) {
  mapFilter = f;
  document.querySelectorAll('.map-filter-btn').forEach(b => {
    b.className = b.className.replace('bg-cyan-700 text-white','bg-gray-700 text-gray-300');
  });
  document.getElementById('map-'+f).className = document.getElementById('map-'+f).className.replace('bg-gray-700 text-gray-300','bg-cyan-700 text-white');
  let filtered = state.worldData;
  if (f==='green')  filtered = state.worldData.filter(d=>d.score>=75);
  if (f==='yellow') filtered = state.worldData.filter(d=>d.score>=50&&d.score<75);
  if (f==='red')    filtered = state.worldData.filter(d=>d.score<50);
  drawMap(filtered);
}

function drawMap(data) {
  Plotly.newPlot('world-map', [{
    type: 'choropleth',
    locationmode: 'ISO-3',
    locations: data.map(d=>d.code),
    z: data.map(d=>d.score),
    text: data.map(d=>`<b>${d.name}</b><br>Score: ${d.score}/100<br>CO₂: ${d.co2}t<br>Renewable: ${d.renewable}%<br>Water: ${d.waterAccess}%<br>Recycling: ${d.recycling}%`),
    hovertemplate: '%{text}<extra></extra>',
    colorscale: [
      [0,'#7f1d1d'],[0.2,'#ef4444'],
      [0.5,'#78350f'],[0.55,'#f59e0b'],
      [0.75,'#064e3b'],[1,'#10b981']
    ],
    zmin:0, zmax:100,
    colorbar:{title:'Score',titlefont:{color:'#9ca3af'},tickfont:{color:'#9ca3af'},bgcolor:'rgba(0,0,0,0.3)'},
  }], {
    paper_bgcolor:'#030712',
    geo:{
      bgcolor:'#030712',
      landcolor:'#111827',
      oceancolor:'#0c1a2e',
      lakecolor:'#0c1a2e',
      showocean:true, showlakes:true, showland:true,
      showcoastlines:true, coastlinecolor:'#1f2937',
      showframe:false, projection:{type:'natural earth'},
    },
    margin:{l:0,r:0,t:0,b:0},
  }, {responsive:true,displayModeBar:false});

  document.getElementById('world-map').on('plotly_click', function(d) {
    if (!d.points.length) return;
    const idx = d.points[0].pointIndex;
    const country = data[idx];
    if (!country) return;
    showCountryDetail(country);
  });
}

function showCountryDetail(c) {
  const el = document.getElementById('country-detail');
  el.classList.remove('hidden');
  const colorClass = c.score>=75?'emerald':c.score>=50?'yellow':'red';
  const aiPred = [c.score, c.score+1.2, c.score+2.1, c.score+2.8, c.score+3.2].map(v=>Math.min(100,v).toFixed(1));
  el.innerHTML = `
    <div class="flex items-start justify-between mb-4">
      <div>
        <h3 class="text-lg font-bold text-${colorClass}-300">${c.name}</h3>
        <span class="px-2 py-0.5 rounded text-xs bg-${colorClass}-900/50 text-${colorClass}-400 font-bold">${scoreLabel(c.score)}</span>
      </div>
      <div class="text-4xl font-black text-${colorClass}-300">${c.score}<span class="text-lg">/100</span></div>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
      ${[
        {label:'CO₂/capita',value:c.co2+'t',icon:'fa-cloud'},
        {label:'Renewable',value:c.renewable+'%',icon:'fa-solar-panel'},
        {label:'Water Access',value:c.waterAccess+'%',icon:'fa-droplet'},
        {label:'Recycling',value:c.recycling+'%',icon:'fa-recycle'},
      ].map(m=>`
        <div class="bg-gray-800 rounded-lg p-3 text-center">
          <i class="fas ${m.icon} text-cyan-400 mb-1"></i>
          <div class="text-lg font-bold text-white">${m.value}</div>
          <div class="text-[10px] text-gray-400">${m.label}</div>
        </div>
      `).join('')}
    </div>
    <div>
      <h4 class="text-xs text-cyan-400 font-bold mb-2">🤖 AI Prediction (Next 5 Years)</h4>
      <div class="flex gap-2">
        ${[2025,2026,2027,2028,2029,2030].map((yr,i)=>`
          <div class="flex-1 text-center">
            <div class="text-xs font-bold" style="color:${scoreColor(parseFloat(aiPred[i]||c.score))}">${aiPred[i]||c.score}</div>
            <div class="text-[10px] text-gray-500">${yr}</div>
          </div>
        `).join('')}
      </div>
    </div>`;
}

function animateYear(y) {
  document.getElementById('year-label').textContent = y;
  const factor = (y - 2015) / 15;
  const animated = state.worldData.map(d => ({
    ...d,
    score: clamp(d.score * (0.8 + 0.2 * factor) + (Math.random()-0.5)*2, 20, 100),
  }));
  drawMap(animated);
}

// ═══════════════════════════════════════════════════════════
//  PREDICTIVE SIMULATOR
// ═══════════════════════════════════════════════════════════
function simulatorHTML() {
  return `
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Controls -->
    <div class="lg:col-span-1 space-y-4">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 class="text-sm font-bold text-cyan-300 mb-4 flex items-center gap-2">
          <i class="fas fa-sliders"></i> Scenario Parameters
        </h2>
        ${[
          {id:'sim-renewable',label:'Renewable Energy',unit:'%',min:0,max:100,val:45,color:'emerald'},
          {id:'sim-recycling',label:'Recycling Rate',unit:'%',min:0,max:100,val:35,color:'cyan'},
          {id:'sim-water',label:'Water Access',unit:'%',min:0,max:100,val:88,color:'blue'},
          {id:'sim-co2',label:'CO₂ Emissions',unit:'t/cap',min:0,max:30,val:8,color:'red'},
          {id:'sim-pop',label:'Population Growth',unit:'%',min:0,max:5,val:1.2,step:'0.1',color:'orange'},
        ].map(s=>`
          <div class="mb-4">
            <div class="flex justify-between mb-1">
              <label class="text-xs text-gray-300">${s.label}</label>
              <span class="text-xs font-bold text-${s.color}-300" id="${s.id}-val">${s.val}${s.unit}</span>
            </div>
            <input type="range" id="${s.id}" min="${s.min}" max="${s.max}" step="${s.step||1}" value="${s.val}"
                   class="w-full accent-${s.color}-400"
                   oninput="document.getElementById('${s.id}-val').textContent=this.value+'${s.unit}'">
          </div>
        `).join('')}
        <button onclick="runSimulation()" id="sim-btn"
                class="w-full mt-2 py-3 rounded-lg bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-bold text-sm hover:from-cyan-500 hover:to-emerald-500 transition-all flex items-center justify-center gap-2">
          <i class="fas fa-play"></i> Run LSTM Simulation
        </button>
      </div>
    </div>

    <!-- Results -->
    <div class="lg:col-span-2 space-y-4">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 class="text-sm font-bold text-cyan-300 mb-4 flex items-center gap-2">
          <i class="fas fa-chart-line"></i> 10-Year Sustainability Forecast
        </h3>
        <div id="sim-chart" style="height:280px">
          <div class="flex items-center justify-center h-full text-gray-500 text-sm">
            <i class="fas fa-play-circle text-3xl mr-3 text-cyan-800"></i>
            Press "Run LSTM Simulation" to generate forecast
          </div>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 class="text-sm font-bold text-yellow-300 mb-3 flex items-center gap-2">
            <i class="fas fa-cloud"></i> CO₂ Emission Trend
          </h3>
          <div id="co2-chart" style="height:180px">
            <div class="flex items-center justify-center h-full text-gray-600 text-xs">Awaiting simulation...</div>
          </div>
        </div>
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 class="text-sm font-bold text-emerald-300 mb-3 flex items-center gap-2">
            <i class="fas fa-solar-panel"></i> Renewable Growth
          </h3>
          <div id="renew-chart" style="height:180px">
            <div class="flex items-center justify-center h-full text-gray-600 text-xs">Awaiting simulation...</div>
          </div>
        </div>
      </div>
      <!-- Explanation panel -->
      <div id="sim-explanation" class="hidden bg-gray-900 border border-cyan-900 rounded-xl p-5">
        <h3 class="text-sm font-bold text-cyan-300 mb-3 flex items-center gap-2">
          <i class="fas fa-lightbulb"></i> AI Insights & Explanations
        </h3>
        <div id="sim-explanation-content" class="space-y-2"></div>
        <div class="mt-4 bg-gray-800 rounded-lg p-3 text-center">
          <div class="text-xs text-gray-400 mb-1">Predicted Score in 2035</div>
          <div class="text-4xl font-black" id="sim-final-score" style="color:#22d3ee">—</div>
          <div class="text-xs text-gray-500" id="sim-score-label">out of 100</div>
        </div>
      </div>
    </div>
  </div>`;
}

function initSimulator() {}

async function runSimulation() {
  const btn = document.getElementById('sim-btn');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running LSTM...';
  btn.disabled = true;

  const payload = {
    renewable:     parseFloat(document.getElementById('sim-renewable').value),
    recycling:     parseFloat(document.getElementById('sim-recycling').value),
    waterAccess:   parseFloat(document.getElementById('sim-water').value),
    co2:           parseFloat(document.getElementById('sim-co2').value),
    populationGrowth: parseFloat(document.getElementById('sim-pop').value),
  };

  const res = await fetch('/simulate_future', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  state.simulationResult = data;

  // Main forecast chart with animation
  Plotly.newPlot('sim-chart', [
    {
      type:'scatter', mode:'lines+markers', name:'Sustainability Score',
      x:data.years, y:data.scores,
      line:{color:'#22d3ee',width:3},
      marker:{color:'#22d3ee',size:7},
      fill:'tozeroy', fillcolor:'rgba(34,211,238,0.07)',
    },
  ], {
    paper_bgcolor:'transparent', plot_bgcolor:'rgba(17,24,39,0.5)',
    margin:{l:50,r:20,t:10,b:40},
    xaxis:{color:'#6b7280',gridcolor:'#1f2937',title:'Year'},
    yaxis:{color:'#6b7280',gridcolor:'#1f2937',title:'Score',range:[0,100]},
    font:{color:'#d1d5db',size:11},
    showlegend:false,
  }, {responsive:true,displayModeBar:false});

  // CO2 chart
  Plotly.newPlot('co2-chart', [{
    type:'scatter', mode:'lines+markers', name:'CO₂',
    x:data.years, y:data.co2Trend,
    line:{color:'#ef4444',width:2},
    marker:{color:'#ef4444',size:5},
    fill:'tozeroy', fillcolor:'rgba(239,68,68,0.08)',
  }], {
    paper_bgcolor:'transparent', plot_bgcolor:'rgba(17,24,39,0.5)',
    margin:{l:40,r:10,t:10,b:30},
    xaxis:{color:'#6b7280',gridcolor:'#1f2937'},
    yaxis:{color:'#6b7280',gridcolor:'#1f2937'},
    font:{color:'#d1d5db',size:10},
    showlegend:false,
  }, {responsive:true,displayModeBar:false});

  // Renewable chart
  Plotly.newPlot('renew-chart', [{
    type:'scatter', mode:'lines+markers', name:'Renewable',
    x:data.years, y:data.renewableTrend,
    line:{color:'#10b981',width:2},
    marker:{color:'#10b981',size:5},
    fill:'tozeroy', fillcolor:'rgba(16,185,129,0.08)',
  }], {
    paper_bgcolor:'transparent', plot_bgcolor:'rgba(17,24,39,0.5)',
    margin:{l:40,r:10,t:10,b:30},
    xaxis:{color:'#6b7280',gridcolor:'#1f2937'},
    yaxis:{color:'#6b7280',gridcolor:'#1f2937'},
    font:{color:'#d1d5db',size:10},
    showlegend:false,
  }, {responsive:true,displayModeBar:false});

  // Explanation panel
  const expEl = document.getElementById('sim-explanation');
  expEl.classList.remove('hidden');
  document.getElementById('sim-explanation-content').innerHTML =
    data.explanation.map(e=>`<p class="text-xs text-gray-300 flex items-start gap-2"><span>${e}</span></p>`).join('');
  const scoreEl = document.getElementById('sim-final-score');
  scoreEl.textContent = data.finalScore;
  scoreEl.style.color = scoreColor(data.finalScore);
  document.getElementById('sim-score-label').textContent = scoreLabel(data.finalScore) + ' · out of 100';

  btn.innerHTML = '<i class="fas fa-check"></i> Simulation Complete';
  setTimeout(()=>{
    btn.innerHTML='<i class="fas fa-play"></i> Run LSTM Simulation';
    btn.disabled=false;
  }, 2000);
}

// ═══════════════════════════════════════════════════════════
//  RL POLICY OPTIMIZER
// ═══════════════════════════════════════════════════════════
function rlHTML() {
  return `
  <div class="space-y-6">
    <div class="flex items-center gap-4">
      <h2 class="text-lg font-bold text-cyan-300 flex items-center gap-2">
        <i class="fas fa-brain"></i> Reinforcement Learning Policy Optimizer
      </h2>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Config -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h3 class="text-sm font-bold text-violet-300">Agent Configuration</h3>
        <div>
          <label class="text-xs text-gray-400">Algorithm</label>
          <div class="grid grid-cols-2 gap-2 mt-1">
            <button onclick="selectRL('dqn')" id="rl-dqn"
                    class="px-3 py-2 rounded text-xs font-bold bg-violet-700 text-white">Deep Q-Learning</button>
            <button onclick="selectRL('ppo')" id="rl-ppo"
                    class="px-3 py-2 rounded text-xs font-bold bg-gray-700 text-gray-300">PPO</button>
          </div>
        </div>
        <div>
          <div class="flex justify-between mb-1"><label class="text-xs text-gray-400">Training Episodes</label>
          <span class="text-xs text-violet-300" id="rl-ep-val">25</span></div>
          <input type="range" id="rl-episodes" min="10" max="50" value="25" class="w-full accent-violet-400"
                 oninput="document.getElementById('rl-ep-val').textContent=this.value">
        </div>
        <div>
          <div class="flex justify-between mb-1"><label class="text-xs text-gray-400">Learning Rate</label>
          <span class="text-xs text-violet-300">0.001</span></div>
          <input type="range" min="1" max="10" value="1" class="w-full accent-violet-400">
        </div>
        <div>
          <div class="flex justify-between mb-1"><label class="text-xs text-gray-400">Discount Factor γ</label>
          <span class="text-xs text-violet-300">0.99</span></div>
          <input type="range" min="90" max="99" value="99" class="w-full accent-violet-400">
        </div>
        <button onclick="runRL()" id="rl-btn"
                class="w-full py-3 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm hover:opacity-90 flex items-center justify-center gap-2">
          <i class="fas fa-robot"></i> Train RL Agent
        </button>
      </div>

      <!-- Results -->
      <div class="lg:col-span-2 space-y-4">
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 class="text-sm font-bold text-violet-300 mb-4">📈 Learning Progress</h3>
          <div id="rl-chart" style="height:260px">
            <div class="flex items-center justify-center h-full text-gray-500 text-sm">
              <i class="fas fa-robot text-3xl text-violet-800 mr-3"></i>Click "Train RL Agent" to begin
            </div>
          </div>
        </div>
        <div id="rl-optimal" class="hidden bg-gray-900 border border-violet-800 rounded-xl p-5">
          <h3 class="text-sm font-bold text-violet-300 mb-4">🎯 Optimal Policy Found</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3" id="rl-policy-grid"></div>
          <div class="mt-4 bg-gray-800 rounded-lg p-4 text-center">
            <div class="text-xs text-gray-400 mb-1">Maximum Achievable Sustainability Score</div>
            <div class="text-5xl font-black text-violet-300" id="rl-final-score">—</div>
            <div class="text-xs text-gray-500 mt-1">After RL optimization</div>
          </div>
          <div class="mt-4 bg-violet-900/20 border border-violet-800/50 rounded-lg p-3">
            <p class="text-xs text-violet-300">
              <i class="fas fa-lightbulb mr-1"></i>
              The RL agent explored <span id="rl-episode-count">—</span> policy combinations and converged 
              on the optimal mix. Policy improvements were driven by maximizing a reward function 
              based on weighted sustainability metrics.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

let selectedRLAlgo = 'dqn';
function selectRL(algo) {
  selectedRLAlgo = algo;
  ['dqn','ppo'].forEach(a => {
    const btn = document.getElementById('rl-'+a);
    btn.className = a===algo
      ? 'px-3 py-2 rounded text-xs font-bold bg-violet-700 text-white'
      : 'px-3 py-2 rounded text-xs font-bold bg-gray-700 text-gray-300';
  });
}

async function runRL() {
  const btn = document.getElementById('rl-btn');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Training...';
  btn.disabled = true;

  const episodes = parseInt(document.getElementById('rl-episodes').value);
  const res = await fetch('/rl_optimize', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ episodes }),
  });
  const data = await res.json();
  state.rlResult = data;

  // Training chart
  Plotly.newPlot('rl-chart', [
    {
      type:'scatter', mode:'lines', name:'Reward',
      x:data.trainingData.map(d=>d.episode),
      y:data.trainingData.map(d=>d.reward),
      line:{color:'#8b5cf6',width:2,dash:'dot'},
      yaxis:'y2',
    },
    {
      type:'scatter', mode:'lines+markers', name:'Sustainability Score',
      x:data.trainingData.map(d=>d.episode),
      y:data.trainingData.map(d=>d.score),
      line:{color:'#a78bfa',width:3},
      marker:{color:'#a78bfa',size:5},
      fill:'tozeroy', fillcolor:'rgba(139,92,246,0.08)',
    },
  ], {
    paper_bgcolor:'transparent', plot_bgcolor:'rgba(17,24,39,0.5)',
    margin:{l:50,r:50,t:10,b:40},
    xaxis:{title:'Episode',color:'#6b7280',gridcolor:'#1f2937'},
    yaxis:{title:'Score',color:'#6b7280',gridcolor:'#1f2937',range:[30,100]},
    yaxis2:{title:'Reward',color:'#6b7280',overlaying:'y',side:'right'},
    font:{color:'#d1d5db',size:11},
    legend:{font:{color:'#9ca3af'},bgcolor:'transparent'},
  }, {responsive:true,displayModeBar:false});

  // Optimal policy
  const op = data.optimalPolicy;
  document.getElementById('rl-optimal').classList.remove('hidden');
  document.getElementById('rl-policy-grid').innerHTML = [
    {label:'Renewable Energy', value:op.renewable+'%', icon:'fa-solar-panel', color:'emerald'},
    {label:'Recycling Rate',   value:op.recycling+'%', icon:'fa-recycle',     color:'cyan'},
    {label:'Water Access',     value:op.waterAccess+'%',icon:'fa-droplet',    color:'blue'},
    {label:'CO₂ Reduction',   value:op.co2Reduction+'%',icon:'fa-cloud',     color:'red'},
  ].map(p=>`
    <div class="bg-gray-800 rounded-lg p-3 text-center">
      <i class="fas ${p.icon} text-${p.color}-400 mb-2 text-lg"></i>
      <div class="text-xl font-bold text-${p.color}-300">${p.value}</div>
      <div class="text-[10px] text-gray-400 mt-1">${p.label}</div>
    </div>
  `).join('');
  document.getElementById('rl-final-score').textContent = op.finalScore.toFixed(1);
  document.getElementById('rl-episode-count').textContent = episodes;

  btn.innerHTML = '<i class="fas fa-check"></i> Training Complete';
  setTimeout(()=>{ btn.innerHTML='<i class="fas fa-robot"></i> Train RL Agent'; btn.disabled=false; },2000);
}

// ═══════════════════════════════════════════════════════════
//  ANOMALY DETECTION
// ═══════════════════════════════════════════════════════════
function anomalyHTML() {
  return `
  <div class="space-y-6">
    <h2 class="text-lg font-bold text-cyan-300 flex items-center gap-2">
      <i class="fas fa-triangle-exclamation text-yellow-400"></i> AI Anomaly Detection System
    </h2>
    <div id="anomaly-alerts" class="space-y-2"></div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 class="text-sm font-bold text-yellow-300 mb-4">CO₂ Anomaly Timeline</h3>
        <div id="anomaly-chart" style="height:280px"></div>
      </div>
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 class="text-sm font-bold text-yellow-300 mb-4">Sensor Overview</h3>
        <div id="anomaly-stats" class="space-y-3"></div>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 class="text-sm font-bold text-blue-300 mb-4">Water Usage Anomalies</h3>
        <div id="water-chart" style="height:200px"></div>
      </div>
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 class="text-sm font-bold text-emerald-300 mb-4">Energy Consumption Anomalies</h3>
        <div id="energy-chart" style="height:200px"></div>
      </div>
    </div>
  </div>`;
}

async function loadAnomaly() {
  const res = await fetch('/anomaly_data');
  state.anomalyData = await res.json();
  renderAnomalyCharts();
}

function renderAnomalyCharts() {
  const data = state.anomalyData;
  const anomalies = data.filter(d=>d.isAnomaly);

  // Alert banners
  document.getElementById('anomaly-alerts').innerHTML = anomalies.map(a=>`
    <div class="flex items-start gap-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 animate-pulse-once">
      <i class="fas fa-triangle-exclamation text-yellow-400 mt-0.5"></i>
      <div>
        <div class="text-sm font-bold text-yellow-300">⚠ Environmental Anomaly Detected — ${a.time}</div>
        <div class="text-xs text-gray-400 mt-0.5">Possible cause: <span class="text-yellow-200">${a.cause}</span> · CO₂ spike: ${a.co2}t · Water: ${a.water}M³ · Energy: ${a.energy}kWh</div>
      </div>
    </div>
  `).join('');

  // CO2 chart
  const normalPts = data.filter(d=>!d.isAnomaly);
  const anomPts   = data.filter(d=>d.isAnomaly);
  Plotly.newPlot('anomaly-chart', [
    {
      type:'scatter', mode:'lines', name:'CO₂ Level',
      x:data.map(d=>d.time), y:data.map(d=>d.co2),
      line:{color:'#6b7280',width:1.5},
    },
    {
      type:'scatter', mode:'markers', name:'Anomaly',
      x:anomPts.map(d=>d.time), y:anomPts.map(d=>d.co2),
      marker:{color:'#ef4444',size:14,symbol:'circle',
              line:{color:'#fca5a5',width:2}},
      text:anomPts.map(d=>`⚠ ${d.cause}`),
      hovertemplate:'%{text}<br>CO₂: %{y}<extra></extra>',
    },
  ], {
    paper_bgcolor:'transparent', plot_bgcolor:'rgba(17,24,39,0.5)',
    margin:{l:50,r:20,t:10,b:60},
    xaxis:{color:'#6b7280',gridcolor:'#1f2937',tickangle:-45},
    yaxis:{title:'CO₂ (t/cap)',color:'#6b7280',gridcolor:'#1f2937'},
    font:{color:'#d1d5db',size:10},
    legend:{font:{color:'#9ca3af'},bgcolor:'transparent'},
    shapes:[{
      type:'line', yref:'paper', x0:0, x1:1, y0:0.85, y1:0.85,
      line:{color:'#ef4444',width:1,dash:'dash'},
    }],
  }, {responsive:true,displayModeBar:false});

  // Stats panel
  const maxCO2 = Math.max(...data.map(d=>d.co2));
  const avgCO2 = (data.reduce((s,d)=>s+d.co2,0)/data.length).toFixed(2);
  document.getElementById('anomaly-stats').innerHTML = `
    <div class="bg-gray-800 rounded-lg p-3">
      <div class="text-xs text-gray-400">Anomalies Detected</div>
      <div class="text-2xl font-bold text-yellow-400">${anomalies.length}</div>
    </div>
    <div class="bg-gray-800 rounded-lg p-3">
      <div class="text-xs text-gray-400">Peak CO₂ (Anomaly)</div>
      <div class="text-2xl font-bold text-red-400">${maxCO2.toFixed(2)}t</div>
    </div>
    <div class="bg-gray-800 rounded-lg p-3">
      <div class="text-xs text-gray-400">Avg Normal CO₂</div>
      <div class="text-2xl font-bold text-green-400">${avgCO2}t</div>
    </div>
    <div class="bg-gray-800 rounded-lg p-3">
      <div class="text-xs text-gray-400">Algorithm</div>
      <div class="text-sm font-bold text-cyan-400">Isolation Forest</div>
      <div class="text-[10px] text-gray-500">+ Autoencoder</div>
    </div>
  `;

  // Water chart
  Plotly.newPlot('water-chart', [
    { type:'bar', x:data.map(d=>d.time), y:data.map(d=>d.water),
      marker:{color:data.map(d=>d.isAnomaly?'#ef4444':'#3b82f6'),opacity:0.8}, name:'Water M³' },
  ], {
    paper_bgcolor:'transparent', plot_bgcolor:'rgba(17,24,39,0.5)',
    margin:{l:40,r:10,t:10,b:60},
    xaxis:{color:'#6b7280',gridcolor:'#1f2937',tickangle:-45,tickfont:{size:8}},
    yaxis:{color:'#6b7280',gridcolor:'#1f2937'},
    font:{color:'#d1d5db',size:9}, showlegend:false,
  }, {responsive:true,displayModeBar:false});

  // Energy chart
  Plotly.newPlot('energy-chart', [
    { type:'scatter', mode:'lines+markers', x:data.map(d=>d.time), y:data.map(d=>d.energy),
      line:{color:'#10b981',width:2},
      marker:{color:data.map(d=>d.isAnomaly?'#ef4444':'#10b981'),size:data.map(d=>d.isAnomaly?10:4)},
    },
  ], {
    paper_bgcolor:'transparent', plot_bgcolor:'rgba(17,24,39,0.5)',
    margin:{l:50,r:10,t:10,b:60},
    xaxis:{color:'#6b7280',gridcolor:'#1f2937',tickangle:-45,tickfont:{size:8}},
    yaxis:{title:'kWh',color:'#6b7280',gridcolor:'#1f2937'},
    font:{color:'#d1d5db',size:9}, showlegend:false,
  }, {responsive:true,displayModeBar:false});
}

// ═══════════════════════════════════════════════════════════
//  3D GLOBE
// ═══════════════════════════════════════════════════════════
function globe3dHTML() {
  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-cyan-300 flex items-center gap-2">
        <i class="fas fa-globe"></i> 3D Interactive Earth — Emission Hotspots
      </h2>
      <div class="flex gap-2">
        <button onclick="toggleGlobeRotation()" id="globe-rotate-btn"
                class="px-3 py-1.5 text-xs rounded bg-cyan-800 text-cyan-200 hover:bg-cyan-700">
          <i class="fas fa-pause"></i> Pause Rotation
        </button>
        <select id="globe-metric" onchange="updateGlobeMetric()" class="px-3 py-1.5 text-xs rounded bg-gray-800 text-gray-200">
          <option value="score">Sustainability Score</option>
          <option value="co2">CO₂ Emissions</option>
          <option value="renewable">Renewable Energy</option>
        </select>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden" style="height:520px">
        <canvas id="globe-canvas" style="width:100%;height:100%"></canvas>
      </div>
      <div class="space-y-3">
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 class="text-xs font-bold text-cyan-300 mb-3">Hover over markers</h3>
          <div id="globe-info" class="text-xs text-gray-400">
            Click a glowing marker on the globe to see environmental data.
          </div>
        </div>
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 class="text-xs font-bold text-yellow-300 mb-3">🔥 Top Emission Hotspots</h3>
          <div id="hotspot-list" class="space-y-2"></div>
        </div>
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 class="text-xs font-bold text-emerald-300 mb-3">Legend</h3>
          <div class="space-y-1.5 text-xs">
            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-emerald-400 inline-block animate-pulse"></span>Sustainable Nation</div>
            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-yellow-400 inline-block animate-pulse"></span>Moderate Nation</div>
            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-red-500 inline-block animate-pulse"></span>Critical / High Emission</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

let globeScene, globeCamera, globeRenderer, globeGlobe, globeMarkers = [];

async function initGlobe3D() {
  if (state.worldData.length === 0) {
    const res = await fetch('/world_data');
    state.worldData = await res.json();
  }
  buildHotspotList();
  buildGlobe();
}

function buildHotspotList() {
  const top5 = [...state.worldData].sort((a,b)=>b.co2-a.co2).slice(0,5);
  document.getElementById('hotspot-list').innerHTML = top5.map(c=>`
    <div class="flex items-center gap-2">
      <span class="w-2 h-2 rounded-full bg-red-500"></span>
      <span class="flex-1 text-xs text-gray-300">${c.name}</span>
      <span class="text-xs text-red-400 font-bold">${c.co2}t</span>
    </div>
  `).join('');
}

function buildGlobe() {
  const canvas = document.getElementById('globe-canvas');
  if (!canvas) return;
  const W = canvas.parentElement.clientWidth;
  const H = canvas.parentElement.clientHeight;

  globeScene    = new THREE.Scene();
  globeCamera   = new THREE.PerspectiveCamera(45, W/H, 0.1, 1000);
  globeRenderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  globeRenderer.setSize(W, H);
  globeRenderer.setPixelRatio(window.devicePixelRatio);
  globeCamera.position.z = 2.5;

  // Stars
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i=0;i<4000;i++) {
    const r = 50+Math.random()*200;
    const theta = Math.random()*Math.PI*2;
    const phi   = Math.acos(Math.random()*2-1);
    starPos.push(r*Math.sin(phi)*Math.cos(theta), r*Math.sin(phi)*Math.sin(theta), r*Math.cos(phi));
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos,3));
  globeScene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color:0xffffff,size:0.3,transparent:true,opacity:0.6})));

  // Ambient + directional light
  globeScene.add(new THREE.AmbientLight(0x334455, 1.2));
  const sun = new THREE.DirectionalLight(0x88ccff, 2.5);
  sun.position.set(5,3,5);
  globeScene.add(sun);

  // Globe sphere
  const geo = new THREE.SphereGeometry(1, 64, 64);
  const mat = new THREE.MeshPhongMaterial({
    color: 0x0d2137,
    emissive: 0x001428,
    specular: 0x4488ff,
    shininess: 30,
    wireframe: false,
  });
  globeGlobe = new THREE.Mesh(geo, mat);
  globeScene.add(globeGlobe);

  // Atmosphere glow
  const atmGeo = new THREE.SphereGeometry(1.03, 64, 64);
  const atmMat = new THREE.MeshPhongMaterial({
    color: 0x0044aa,
    transparent: true,
    opacity: 0.08,
    side: THREE.FrontSide,
  });
  globeScene.add(new THREE.Mesh(atmGeo, atmMat));

  // Grid lines
  const gridMat = new THREE.MeshBasicMaterial({color:0x1e3a5f,transparent:true,opacity:0.3,wireframe:true});
  globeScene.add(new THREE.Mesh(new THREE.SphereGeometry(1.001,24,24), gridMat));

  // Markers
  globeMarkers = [];
  const metric = document.getElementById('globe-metric')?.value || 'score';
  placeMarkers(metric);

  // Render loop
  state.globeRotating = true;
  function animate() {
    state.globeAnimFrame = requestAnimationFrame(animate);
    if (state.globeRotating) {
      globeGlobe.rotation.y += 0.003;
      globeMarkers.forEach(m=>{ m.rotation.y+=0.003; });
    }
    globeRenderer.render(globeScene, globeCamera);
  }
  animate();
}

function placeMarkers(metric) {
  // Remove existing markers
  globeMarkers.forEach(m=>globeScene.remove(m));
  globeMarkers = [];

  state.worldData.forEach(c => {
    const coords = COUNTRY_COORDS[c.code];
    if (!coords) return;
    const lat = coords.lat * Math.PI / 180;
    const lon = coords.lon * Math.PI / 180;
    const r = 1.02;
    const x = r * Math.cos(lat) * Math.cos(lon);
    const y = r * Math.sin(lat);
    const z = r * Math.cos(lat) * Math.sin(lon);

    let color, size;
    if (metric === 'co2') {
      const norm = clamp(c.co2/20, 0, 1);
      color = new THREE.Color(norm, 1-norm, 0);
      size = 0.012 + norm * 0.035;
    } else if (metric === 'renewable') {
      const norm = c.renewable/100;
      color = new THREE.Color(0, norm, 1-norm*0.5);
      size = 0.012 + norm * 0.025;
    } else {
      color = new THREE.Color(...hexToRgb(scoreColor(c.score)));
      size = 0.012 + (c.score/100) * 0.022;
    }

    const markerGeo = new THREE.SphereGeometry(size, 12, 12);
    const markerMat = new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.9});
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.set(x, y, z);
    marker.userData = c;
    globeScene.add(marker);
    globeMarkers.push(marker);

    // Pulse ring
    const ringGeo = new THREE.RingGeometry(size*1.5, size*2.5, 16);
    const ringMat = new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.3, side:THREE.DoubleSide});
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(x, y, z);
    ring.lookAt(0,0,0);
    globeScene.add(ring);
    globeMarkers.push(ring);
  });
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  return [r,g,b];
}

function updateGlobeMetric() {
  const metric = document.getElementById('globe-metric').value;
  placeMarkers(metric);
}

function toggleGlobeRotation() {
  state.globeRotating = !state.globeRotating;
  const btn = document.getElementById('globe-rotate-btn');
  btn.innerHTML = state.globeRotating
    ? '<i class="fas fa-pause"></i> Pause Rotation'
    : '<i class="fas fa-play"></i> Resume Rotation';
}

// ═══════════════════════════════════════════════════════════
//  SDG TRACKER
// ═══════════════════════════════════════════════════════════
function sdgHTML() {
  return `
  <div class="space-y-6">
    <h2 class="text-lg font-bold text-cyan-300 flex items-center gap-2">
      <i class="fas fa-bullseye"></i> UN Sustainable Development Goals Progress
    </h2>
    <div id="sdg-content">
      <div class="flex items-center justify-center py-12">
        <div class="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
      </div>
    </div>
  </div>`;
}

async function loadSDG() {
  const res = await fetch('/sdg_data');
  state.sdgData = await res.json();
  renderSDG();
}

function renderSDG() {
  const { sdgs, aiScore, yearlyTarget } = state.sdgData;
  document.getElementById('sdg-content').innerHTML = `
    <!-- AI Score Banner -->
    <div class="bg-gradient-to-r from-cyan-900/40 to-emerald-900/40 border border-cyan-800/50 rounded-xl p-5 mb-6">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xs text-cyan-400 font-bold mb-1">OVERALL AI SUSTAINABILITY SCORE</div>
          <div class="text-5xl font-black text-cyan-300">${aiScore}<span class="text-xl text-gray-400">/100</span></div>
          <div class="text-xs text-gray-400 mt-1">Based on weighted SDG alignment · Target year: ${yearlyTarget}</div>
        </div>
        <div class="text-right">
          <div class="text-xs text-gray-400">Progress to Target</div>
          <div class="text-3xl font-bold text-emerald-400">${(aiScore/1).toFixed(0)}%</div>
          <div class="w-32 bg-gray-700 rounded-full h-3 mt-2">
            <div class="bg-gradient-to-r from-cyan-500 to-emerald-500 h-3 rounded-full" style="width:${aiScore}%"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- SDG Cards Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      ${sdgs.map(s=>`
        <div class="bg-gray-900 border border-gray-800 hover:border-gray-600 transition-all rounded-xl p-4">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                 style="background:${s.color}22;border:1px solid ${s.color}44">${s.icon}</div>
            <div>
              <div class="text-[10px] text-gray-500 font-bold">SDG ${s.id}</div>
              <div class="text-xs font-bold text-gray-200">${s.name}</div>
            </div>
          </div>
          <!-- Progress Bar -->
          <div class="mb-2">
            <div class="flex justify-between text-[10px] mb-1">
              <span class="text-gray-400">${s.metric}: ${s.value}</span>
              <span class="font-bold" style="color:${s.color}">${s.progress}%</span>
            </div>
            <div class="w-full bg-gray-700 rounded-full h-2">
              <div class="h-2 rounded-full transition-all duration-1000"
                   style="width:${s.progress}%;background:${s.color}"></div>
            </div>
          </div>
          <!-- Trend Sparkline -->
          <div id="sdg-spark-${s.id}" style="height:60px;margin:-4px -4px 4px -4px"></div>
          <!-- Recommendation -->
          <div class="mt-2 text-[10px] text-gray-400 bg-gray-800 rounded p-2">
            💡 ${s.recommendation}
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Radar Chart -->
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 class="text-sm font-bold text-cyan-300 mb-4">SDG Achievement Radar</h3>
      <div id="sdg-radar" style="height:350px"></div>
    </div>
  `;

  // Render sparklines
  sdgs.forEach(s => {
    Plotly.newPlot(`sdg-spark-${s.id}`, [{
      type:'scatter', mode:'lines',
      x:[2020,2021,2022,2023,2024,2025],
      y:s.trend,
      line:{color:s.color,width:2},
      fill:'tozeroy', fillcolor:s.color+'22',
    }], {
      paper_bgcolor:'transparent', plot_bgcolor:'transparent',
      margin:{l:0,r:0,t:0,b:0},
      xaxis:{visible:false}, yaxis:{visible:false},
      showlegend:false,
    }, {responsive:true,displayModeBar:false,staticPlot:true});
  });

  // Radar
  Plotly.newPlot('sdg-radar', [{
    type:'scatterpolar', fill:'toself',
    r:sdgs.map(s=>s.progress),
    theta:sdgs.map(s=>`SDG ${s.id}`),
    fillcolor:'rgba(34,211,238,0.1)',
    line:{color:'#22d3ee',width:2},
    name:'Current Progress',
  },{
    type:'scatterpolar', fill:'toself',
    r:sdgs.map(()=>100),
    theta:sdgs.map(s=>`SDG ${s.id}`),
    fillcolor:'rgba(255,255,255,0.02)',
    line:{color:'#374151',width:1,dash:'dash'},
    name:'Target 100%',
  }], {
    polar:{
      bgcolor:'transparent',
      radialaxis:{visible:true,range:[0,100],gridcolor:'#1f2937',color:'#6b7280'},
      angularaxis:{color:'#9ca3af'},
    },
    paper_bgcolor:'transparent',
    font:{color:'#d1d5db',size:11},
    legend:{font:{color:'#9ca3af'},bgcolor:'transparent'},
    margin:{l:60,r:60,t:30,b:30},
  }, {responsive:true,displayModeBar:false});
}

// ═══════════════════════════════════════════════════════════
//  AI CHATBOT
// ═══════════════════════════════════════════════════════════
function aiHTML() {
  return `
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
    <!-- Chat Panel -->
    <div class="lg:col-span-2 flex flex-col bg-gray-900 border border-gray-800 rounded-xl" style="height:600px">
      <!-- Header -->
      <div class="flex items-center gap-3 p-4 border-b border-gray-800">
        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-500 flex items-center justify-center">
          <i class="fas fa-robot text-gray-950 text-sm"></i>
        </div>
        <div>
          <div class="text-sm font-bold text-cyan-300">Ask EcoTwin AI</div>
          <div class="flex items-center gap-1.5 text-[10px] text-emerald-400">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>Online · Powered by LLM + Sustainability Data
          </div>
        </div>
      </div>
      <!-- Messages -->
      <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
        <div class="flex gap-2">
          <div class="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex-none flex items-center justify-center">
            <i class="fas fa-robot text-[10px] text-gray-950"></i>
          </div>
          <div class="bg-gray-800 rounded-xl px-3 py-2 max-w-lg">
            <p class="text-xs text-gray-200">Hello! I'm <strong class="text-cyan-300">EcoTwin AI</strong> — your intelligent sustainability assistant. I have access to data on 60+ countries across CO₂ emissions, renewable energy, water access, and recycling rates.</p>
            <p class="text-xs text-gray-400 mt-1">Ask me anything about global sustainability! 🌍</p>
          </div>
        </div>
      </div>
      <!-- Input -->
      <div class="p-4 border-t border-gray-800">
        <div class="flex gap-2">
          <input id="chat-input" type="text" placeholder="Ask about sustainability..."
                 class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-600"
                 onkeydown="if(event.key==='Enter')sendChat()">
          <button onclick="sendChat()" class="px-4 py-2 rounded-lg bg-cyan-700 text-white text-sm hover:bg-cyan-600 transition-all">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Suggestions Panel -->
    <div class="space-y-4">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 class="text-xs font-bold text-cyan-300 mb-3">💡 Suggested Questions</h3>
        <div id="suggested-questions" class="space-y-2">
          ${[
            'Which country has the highest sustainability score?',
            'How can CO2 emissions be reduced?',
            'Compare India and USA sustainability',
            'Best renewable energy policies',
            'Countries with critical water access',
            'What is climate action SDG 13?',
            'Top recycling nations',
            'How does renewable energy affect CO2?',
          ].map(q=>`
            <button onclick="askSuggested('${q}')"
                    class="w-full text-left text-xs text-gray-300 hover:text-cyan-300 bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-2 transition-all">
              ${q}
            </button>
          `).join('')}
        </div>
      </div>
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 class="text-xs font-bold text-emerald-300 mb-3">📊 Quick Stats</h3>
        <div class="space-y-2 text-xs text-gray-400">
          <div class="flex justify-between"><span>Countries in database:</span><span class="text-cyan-300">60+</span></div>
          <div class="flex justify-between"><span>Best performer:</span><span class="text-emerald-300">Norway (90)</span></div>
          <div class="flex justify-between"><span>Needs attention:</span><span class="text-red-300">Saudi Arabia (28)</span></div>
          <div class="flex justify-between"><span>Global avg score:</span><span class="text-yellow-300">61/100</span></div>
        </div>
      </div>
    </div>
  </div>`;
}

function initAI() {}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const question = input.value.trim();
  if (!question) return;
  input.value = '';

  // User message
  appendChatMessage('user', question);

  // Typing indicator
  const typingId = 'typing-'+Date.now();
  document.getElementById('chat-messages').insertAdjacentHTML('beforeend',`
    <div id="${typingId}" class="flex gap-2">
      <div class="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex-none flex items-center justify-center">
        <i class="fas fa-robot text-[10px] text-gray-950"></i>
      </div>
      <div class="bg-gray-800 rounded-xl px-3 py-2">
        <div class="flex gap-1">
          <span class="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style="animation-delay:0ms"></span>
          <span class="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style="animation-delay:150ms"></span>
          <span class="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style="animation-delay:300ms"></span>
        </div>
      </div>
    </div>
  `);
  scrollChat();

  const res = await fetch('/ai_query', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({question}),
  });
  const data = await res.json();

  document.getElementById(typingId)?.remove();
  appendChatMessage('bot', data.response, data.suggestions);

  // Update suggested questions
  if (data.suggestions?.length) {
    document.getElementById('suggested-questions').innerHTML =
      data.suggestions.map(q=>`
        <button onclick="askSuggested('${q.replace(/'/g,"\\'")}')"
                class="w-full text-left text-xs text-gray-300 hover:text-cyan-300 bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-2 transition-all">
          ${q}
        </button>
      `).join('') + document.getElementById('suggested-questions').innerHTML;
  }
}

function appendChatMessage(role, text, suggestions) {
  const msgs = document.getElementById('chat-messages');
  const formatted = text
    .replace(/\*\*(.*?)\*\*/g,'<strong class="text-cyan-200">$1</strong>')
    .replace(/\n/g,'<br>')
    .replace(/\|(.+)\|/g,'')
    .replace(/#{1,3} (.+)/g,'<strong>$1</strong>');

  if (role === 'user') {
    msgs.insertAdjacentHTML('beforeend',`
      <div class="flex gap-2 justify-end">
        <div class="bg-cyan-800/60 rounded-xl px-3 py-2 max-w-sm">
          <p class="text-xs text-cyan-100">${text}</p>
        </div>
        <div class="w-6 h-6 rounded-full bg-gray-700 flex-none flex items-center justify-center">
          <i class="fas fa-user text-[10px] text-gray-300"></i>
        </div>
      </div>
    `);
  } else {
    msgs.insertAdjacentHTML('beforeend',`
      <div class="flex gap-2">
        <div class="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex-none flex items-center justify-center">
          <i class="fas fa-robot text-[10px] text-gray-950"></i>
        </div>
        <div class="bg-gray-800 rounded-xl px-3 py-2 max-w-lg">
          <p class="text-xs text-gray-200 leading-relaxed">${formatted}</p>
        </div>
      </div>
    `);
  }
  scrollChat();
}

function scrollChat() {
  const el = document.getElementById('chat-messages');
  if (el) el.scrollTop = el.scrollHeight;
}

function askSuggested(q) {
  document.getElementById('chat-input').value = q;
  sendChat();
}

// ═══════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════
window.switchTab        = switchTab;
window.runSimulation    = runSimulation;
window.runRL            = runRL;
window.filterMap        = filterMap;
window.animateYear      = animateYear;
window.sendChat         = sendChat;
window.askSuggested     = askSuggested;
window.selectRL         = selectRL;
window.toggleGlobeRotation = toggleGlobeRotation;
window.updateGlobeMetric   = updateGlobeMetric;

document.addEventListener('DOMContentLoaded', () => {
  renderShell();
  // Preload world data in background
  fetch('/world_data').then(r=>r.json()).then(d=>{ state.worldData=d; });
});
