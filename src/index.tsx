import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'

const app = new Hono()

// Serve static files
app.use('/static/*', serveStatic({ root: './' }))

// Serve favicon
app.get('/favicon.ico', (c) => {
  return c.text('', 204)
})

// Main dashboard route
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EcoTwin — Smart City Digital Twin</title>
  <link rel="stylesheet" href="/static/style.css" />
  <!-- Libraries -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css"/>
  <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
</head>
<body class="bg-gray-950 text-gray-100 font-mono" id="app-root">
  <div id="root"></div>
  <script src="/static/app.js"></script>
</body>
</html>`)
})

// ─────────────────────────────────────────────
// SIMULATE FUTURE  — LSTM-style forecasting
// ─────────────────────────────────────────────
app.post('/simulate_future', async (c) => {
  const body = await c.req.json()
  const { renewable, recycling, waterAccess, co2, populationGrowth } = body

  // Compute baseline sustainability score (0–100)
  const baseScore = Math.min(100,
    renewable * 0.30 +
    recycling  * 0.20 +
    waterAccess * 0.25 +
    (100 - co2) * 0.15 +
    (100 - populationGrowth * 2) * 0.10
  )

  // Simulate 10-year LSTM-style trend with noise + momentum
  const years: number[] = []
  const scores: number[] = []
  const co2Trend: number[] = []
  const renewableTrend: number[] = []

  let score = baseScore
  let co2Val = co2
  let renewVal = renewable

  for (let i = 0; i <= 10; i++) {
    const year = 2025 + i
    years.push(year)

    // LSTM-like multi-step forecast simulation
    const renewEffect = (renewable - 50) * 0.04 * i
    const recycleEffect = (recycling - 50) * 0.02 * i
    const waterEffect = (waterAccess - 70) * 0.01 * i
    const popPenalty = populationGrowth * 0.05 * i
    const noise = (Math.random() - 0.5) * 1.5

    score = Math.min(100, Math.max(0,
      baseScore + renewEffect + recycleEffect + waterEffect - popPenalty + noise
    ))
    scores.push(parseFloat(score.toFixed(2)))

    // CO2 trend
    const co2Reduction = renewable * 0.002 * i + recycling * 0.001 * i
    co2Val = Math.max(0, co2 - co2Reduction + populationGrowth * 0.3 * i * 0.1 + (Math.random()-0.5)*1)
    co2Trend.push(parseFloat(co2Val.toFixed(2)))

    // Renewable growth
    renewVal = Math.min(100, renewable + i * (renewable > 60 ? 0.8 : 0.4) + (Math.random()-0.5))
    renewableTrend.push(parseFloat(renewVal.toFixed(2)))
  }

  // Explanation insight
  const co2ReducedPct = (((co2 - co2Trend[10]) / Math.max(co2, 1)) * 100).toFixed(1)
  const scoreChange = (scores[10] - scores[0]).toFixed(1)

  const explanation: string[] = [
    `🌱 Increasing renewable energy by 20% reduces CO₂ emissions by approximately ${Math.abs(parseFloat(co2ReducedPct))}%.`,
    `📈 Sustainability score is projected to ${parseFloat(scoreChange) >= 0 ? 'improve' : 'decline'} by ${Math.abs(parseFloat(scoreChange))} points over 10 years.`,
    `♻️ A ${recycling}% recycling rate contributes to ${(recycling * 0.15).toFixed(1)}% reduction in landfill emissions.`,
    `💧 Water access at ${waterAccess}% ensures resilience for ${(waterAccess * 0.8).toFixed(0)}% of urban population.`,
    `🏙️ Population growth of ${populationGrowth}% per year adds pressure on energy and water infrastructure.`,
  ]

  return c.json({ years, scores, co2Trend, renewableTrend, explanation, finalScore: scores[10] })
})

// ─────────────────────────────────────────────
// WORLD MAP DATA
// ─────────────────────────────────────────────
app.get('/world_data', (c) => {
  const countries = [
    { code: 'USA', name: 'United States',  co2: 14.2, renewable: 22, waterAccess: 99, recycling: 35, score: 61 },
    { code: 'CHN', name: 'China',           co2: 8.4,  renewable: 28, waterAccess: 95, recycling: 22, score: 54 },
    { code: 'IND', name: 'India',           co2: 1.9,  renewable: 40, waterAccess: 88, recycling: 18, score: 55 },
    { code: 'DEU', name: 'Germany',         co2: 7.7,  renewable: 46, waterAccess: 100,recycling: 67, score: 76 },
    { code: 'NOR', name: 'Norway',          co2: 7.5,  renewable: 98, waterAccess: 100,recycling: 52, score: 90 },
    { code: 'BRA', name: 'Brazil',          co2: 2.6,  renewable: 83, waterAccess: 87, recycling: 4,  score: 65 },
    { code: 'RUS', name: 'Russia',          co2: 12.3, renewable: 20, waterAccess: 97, recycling: 8,  score: 42 },
    { code: 'AUS', name: 'Australia',       co2: 14.8, renewable: 30, waterAccess: 100,recycling: 60, score: 62 },
    { code: 'JPN', name: 'Japan',           co2: 8.6,  renewable: 22, waterAccess: 100,recycling: 77, score: 68 },
    { code: 'FRA', name: 'France',          co2: 4.6,  renewable: 23, waterAccess: 100,recycling: 45, score: 74 },
    { code: 'CAN', name: 'Canada',          co2: 14.9, renewable: 67, waterAccess: 99, recycling: 28, score: 66 },
    { code: 'GBR', name: 'United Kingdom',  co2: 5.5,  renewable: 42, waterAccess: 100,recycling: 44, score: 72 },
    { code: 'SWE', name: 'Sweden',          co2: 3.8,  renewable: 66, waterAccess: 100,recycling: 50, score: 87 },
    { code: 'DNK', name: 'Denmark',         co2: 5.9,  renewable: 79, waterAccess: 100,recycling: 56, score: 88 },
    { code: 'ZAF', name: 'South Africa',    co2: 6.9,  renewable: 8,  waterAccess: 74, recycling: 10, score: 38 },
    { code: 'NGA', name: 'Nigeria',         co2: 0.6,  renewable: 19, waterAccess: 57, recycling: 4,  score: 33 },
    { code: 'MEX', name: 'Mexico',          co2: 3.6,  renewable: 26, waterAccess: 96, recycling: 5,  score: 52 },
    { code: 'IDN', name: 'Indonesia',       co2: 2.3,  renewable: 14, waterAccess: 90, recycling: 7,  score: 47 },
    { code: 'PAK', name: 'Pakistan',        co2: 0.9,  renewable: 31, waterAccess: 91, recycling: 6,  score: 45 },
    { code: 'BGD', name: 'Bangladesh',      co2: 0.5,  renewable: 3,  waterAccess: 97, recycling: 3,  score: 40 },
    { code: 'ARG', name: 'Argentina',       co2: 4.3,  renewable: 12, waterAccess: 99, recycling: 12, score: 52 },
    { code: 'EGY', name: 'Egypt',           co2: 2.4,  renewable: 10, waterAccess: 98, recycling: 9,  score: 44 },
    { code: 'KOR', name: 'South Korea',     co2: 11.9, renewable: 8,  waterAccess: 100,recycling: 59, score: 60 },
    { code: 'SAU', name: 'Saudi Arabia',    co2: 18.5, renewable: 1,  waterAccess: 97, recycling: 3,  score: 28 },
    { code: 'IRN', name: 'Iran',            co2: 8.6,  renewable: 6,  waterAccess: 95, recycling: 5,  score: 36 },
    { code: 'TUR', name: 'Turkey',          co2: 6.0,  renewable: 44, waterAccess: 99, recycling: 12, score: 58 },
    { code: 'ESP', name: 'Spain',           co2: 5.8,  renewable: 53, waterAccess: 100,recycling: 36, score: 74 },
    { code: 'ITA', name: 'Italy',           co2: 5.8,  renewable: 40, waterAccess: 100,recycling: 52, score: 72 },
    { code: 'NLD', name: 'Netherlands',     co2: 8.8,  renewable: 15, waterAccess: 100,recycling: 66, score: 70 },
    { code: 'CHE', name: 'Switzerland',     co2: 4.4,  renewable: 75, waterAccess: 100,recycling: 53, score: 85 },
    { code: 'FIN', name: 'Finland',         co2: 6.9,  renewable: 47, waterAccess: 100,recycling: 42, score: 80 },
    { code: 'NZL', name: 'New Zealand',     co2: 7.4,  renewable: 85, waterAccess: 100,recycling: 58, score: 83 },
    { code: 'CHL', name: 'Chile',           co2: 4.7,  renewable: 48, waterAccess: 99, recycling: 10, score: 63 },
    { code: 'COL', name: 'Colombia',        co2: 1.7,  renewable: 68, waterAccess: 91, recycling: 8,  score: 60 },
    { code: 'THA', name: 'Thailand',        co2: 3.9,  renewable: 14, waterAccess: 100,recycling: 34, score: 54 },
    { code: 'VNM', name: 'Vietnam',         co2: 3.1,  renewable: 43, waterAccess: 95, recycling: 11, score: 55 },
    { code: 'PHL', name: 'Philippines',     co2: 1.3,  renewable: 29, waterAccess: 92, recycling: 14, score: 52 },
    { code: 'POL', name: 'Poland',          co2: 9.4,  renewable: 15, waterAccess: 98, recycling: 32, score: 52 },
    { code: 'UKR', name: 'Ukraine',         co2: 5.2,  renewable: 14, waterAccess: 96, recycling: 7,  score: 46 },
    { code: 'KEN', name: 'Kenya',           co2: 0.4,  renewable: 75, waterAccess: 59, recycling: 5,  score: 50 },
    { code: 'ETH', name: 'Ethiopia',        co2: 0.1,  renewable: 90, waterAccess: 41, recycling: 2,  score: 42 },
    { code: 'GHA', name: 'Ghana',           co2: 0.6,  renewable: 42, waterAccess: 79, recycling: 4,  score: 47 },
    { code: 'MAR', name: 'Morocco',         co2: 1.8,  renewable: 37, waterAccess: 80, recycling: 7,  score: 53 },
    { code: 'SDN', name: 'Sudan',           co2: 0.4,  renewable: 40, waterAccess: 53, recycling: 2,  score: 35 },
    { code: 'IRQ', name: 'Iraq',            co2: 5.5,  renewable: 2,  waterAccess: 86, recycling: 3,  score: 32 },
    { code: 'SYR', name: 'Syria',           co2: 2.0,  renewable: 5,  waterAccess: 77, recycling: 2,  score: 30 },
    { code: 'VEN', name: 'Venezuela',       co2: 5.4,  renewable: 73, waterAccess: 94, recycling: 4,  score: 51 },
    { code: 'PER', name: 'Peru',            co2: 1.8,  renewable: 61, waterAccess: 88, recycling: 7,  score: 59 },
    { code: 'AUT', name: 'Austria',         co2: 7.8,  renewable: 76, waterAccess: 100,recycling: 62, score: 82 },
    { code: 'BEL', name: 'Belgium',         co2: 7.9,  renewable: 13, waterAccess: 100,recycling: 55, score: 68 },
    { code: 'ISL', name: 'Iceland',         co2: 10.2, renewable: 100,waterAccess: 100,recycling: 36, score: 89 },
    { code: 'PRT', name: 'Portugal',        co2: 5.5,  renewable: 62, waterAccess: 100,recycling: 30, score: 76 },
    { code: 'GRC', name: 'Greece',          co2: 6.5,  renewable: 31, waterAccess: 100,recycling: 18, score: 62 },
    { code: 'CZE', name: 'Czech Republic',  co2: 9.5,  renewable: 17, waterAccess: 100,recycling: 45, score: 60 },
    { code: 'HUN', name: 'Hungary',         co2: 5.0,  renewable: 14, waterAccess: 100,recycling: 35, score: 62 },
    { code: 'ROM', name: 'Romania',         co2: 4.5,  renewable: 43, waterAccess: 78, recycling: 14, score: 57 },
    { code: 'BGR', name: 'Bulgaria',        co2: 5.9,  renewable: 22, waterAccess: 99, recycling: 35, score: 58 },
    { code: 'SRB', name: 'Serbia',          co2: 6.6,  renewable: 31, waterAccess: 99, recycling: 12, score: 55 },
    { code: 'HRV', name: 'Croatia',         co2: 4.5,  renewable: 46, waterAccess: 100,recycling: 25, score: 68 },
    { code: 'SVK', name: 'Slovakia',        co2: 6.3,  renewable: 22, waterAccess: 100,recycling: 42, score: 63 },
    { code: 'MYS', name: 'Malaysia',        co2: 8.2,  renewable: 22, waterAccess: 96, recycling: 28, score: 54 },
    { code: 'SGP', name: 'Singapore',       co2: 7.9,  renewable: 4,  waterAccess: 100,recycling: 59, score: 62 },
  ]
  return c.json(countries)
})

// ─────────────────────────────────────────────
// AI QUERY  — Natural Language
// ─────────────────────────────────────────────
app.post('/ai_query', async (c) => {
  const body = await c.req.json()
  const { question } = body

  const q = (question || '').toLowerCase()

  // Sustainability dataset summary for AI reasoning
  const dataset = {
    topSustainable: ['Iceland (89)', 'Norway (90)', 'Denmark (88)', 'Sweden (87)', 'Switzerland (85)'],
    lowestSustainable: ['Saudi Arabia (28)', 'Syria (30)', 'Iraq (32)', 'Nigeria (33)', 'South Africa (38)'],
    avgScore: 61,
    avgRenewable: 40,
    avgCO2: 6.2,
    avgRecycling: 30,
  }

  let response = ''
  let suggestions: string[] = []

  if (q.includes('highest') || q.includes('best') || q.includes('top')) {
    response = `🏆 **Top Sustainable Countries:**\n${dataset.topSustainable.join('\n')}\n\nNorway leads with 90/100, powered by 98% renewable hydropower and strong environmental policies. Iceland achieves 100% renewable electricity through geothermal energy. These nations demonstrate that aggressive clean energy investment directly correlates with high sustainability scores.`
    suggestions = ['How did Norway achieve 90% score?', 'What policies did Denmark use?', 'Compare Norway and Iceland']
  } else if (q.includes('lowest') || q.includes('worst') || q.includes('critical')) {
    response = `⚠️ **Critical Sustainability Nations:**\n${dataset.lowestSustainable.join('\n')}\n\nSaudi Arabia scores 28/100 due to heavy fossil fuel dependency (1% renewable). Iraq and Syria face instability limiting green investment. Recommended interventions include: renewable energy subsidies, international climate funding, and policy reforms aligned with Paris Agreement targets.`
    suggestions = ['How can Saudi Arabia improve?', 'What UN SDGs apply here?', 'Policy recommendations for low-scoring countries']
  } else if (q.includes('co2') || q.includes('emission') || q.includes('carbon')) {
    response = `🌿 **CO₂ Emissions Analysis:**\n\nGlobal average in EcoTwin dataset: **${dataset.avgCO2} tons/capita**\n\n**Reduction Strategies:**\n• Increasing renewable energy by 20% reduces CO₂ by ~15-18%\n• Carbon pricing mechanisms reduce industrial emissions by 10-25%\n• Green transport (EVs, cycling) cuts urban CO₂ by 20%\n• Forest restoration sequesters ~2.6 billion tons CO₂/year globally\n• Smart grid optimization reduces power waste by 8-12%\n\n**Countries with best CO₂ performance:** Ethiopia (0.1), Kenya (0.4), Bangladesh (0.5)`
    suggestions = ['Which sector emits most CO2?', 'How does renewable energy reduce CO2?', 'Carbon capture technologies']
  } else if (q.includes('india') && q.includes('usa') || q.includes('compare')) {
    response = `📊 **India vs USA Comparison:**\n\n| Metric | India | USA |\n|--------|-------|-----|\n| Sustainability | 55/100 | 61/100 |\n| CO₂/capita | 1.9t | 14.2t |\n| Renewable % | 40% | 22% |\n| Recycling | 18% | 35% |\n| Water Access | 88% | 99% |\n\n**Key Insight:** Despite lower overall score, India emits 7x less CO₂ per capita than the USA. India's growing solar capacity (40% renewable) is impressive, while the USA struggles with fossil fuel dependency. The USA leads in recycling infrastructure and water access.`
    suggestions = ['India renewable energy goals', 'USA climate policy analysis', 'Which country will improve faster by 2030?']
  } else if (q.includes('renewable') || q.includes('solar') || q.includes('wind') || q.includes('clean energy')) {
    response = `☀️ **Renewable Energy Insights:**\n\nGlobal average renewable share: **${dataset.avgRenewable}%**\n\n**Leaders:** Iceland (100%), Norway (98%), Brazil (83%), New Zealand (85%)\n\n**Impact on Sustainability:**\n• Each 10% increase in renewables → +3.5 sustainability points\n• Solar costs dropped 90% since 2010, making mass adoption viable\n• Wind energy is now cheaper than coal in 90% of markets\n\n**Policy Recommendations:**\n• Feed-in tariffs for solar installation\n• Green bonds for renewable infrastructure\n• Renewable Portfolio Standards (RPS)\n• International technology transfer programs`
    suggestions = ['Best renewable energy policies', 'Cost of solar vs coal', 'Countries transitioning fastest to renewables']
  } else if (q.includes('water') || q.includes('sdg 6') || q.includes('clean water')) {
    response = `💧 **Water Access Analysis:**\n\nGlobal average water access: **91%**\n\n**Critical gaps:** Ethiopia (41%), Sudan (53%), Nigeria (57%), Kenya (59%)\n\n**SDG 6 Alignment:** EcoTwin tracks water access as a key sustainability metric. Countries below 80% water access require immediate infrastructure investment.\n\n**Solutions:**\n• Rainwater harvesting systems\n• Water recycling infrastructure\n• Desalination for coastal nations\n• Smart water monitoring IoT systems\n• International aid for sub-Saharan Africa`
    suggestions = ['SDG 6 clean water progress', 'Countries with water scarcity', 'Water conservation technologies']
  } else if (q.includes('policy') || q.includes('recommend') || q.includes('improve') || q.includes('how')) {
    response = `🏛️ **AI Policy Recommendations:**\n\n**Top 5 High-Impact Policies:**\n1. **Carbon Tax** — Reduces emissions 15-25%, revenue funds renewables\n2. **Renewable Portfolio Standards** — Mandates 50%+ clean energy by 2030\n3. **Circular Economy Laws** — Increases recycling rate by 20-30%\n4. **Green Urban Planning** — Smart cities reduce energy use by 30%\n5. **Biodiversity Credits** — Incentivizes forest preservation\n\n**EcoTwin Optimization Score:** Implementing all 5 policies can raise a nation's sustainability score by 15-25 points within 10 years based on our LSTM model projections.`
    suggestions = ['Carbon tax effectiveness', 'Circular economy examples', 'Smart city sustainability']
  } else if (q.includes('recycling') || q.includes('waste') || q.includes('circular')) {
    response = `♻️ **Recycling & Circular Economy:**\n\nGlobal average recycling rate: **${dataset.avgRecycling}%**\n\n**Leaders:** Japan (77%), Germany (67%), South Korea (59%), Netherlands (66%)\n\n**Impact:** Raising recycling rate by 20% can:\n• Reduce landfill methane by 12%\n• Cut raw material extraction by 18%\n• Lower CO₂ equivalent by 0.5 tons/capita\n\n**Circular Economy Initiatives:**\n• Extended Producer Responsibility (EPR)\n• Deposit return schemes\n• Industrial symbiosis networks\n• Digital product passports`
    suggestions = ['Germany circular economy model', 'Japan recycling system', 'Plastic pollution solutions']
  } else {
    response = `🌍 **EcoTwin AI — Global Sustainability Overview:**\n\nAnalyzing ${60}+ countries across 4 sustainability dimensions.\n\n**Global Averages:**\n• Sustainability Score: ${dataset.avgScore}/100\n• CO₂ Emissions: ${dataset.avgCO2} tons/capita\n• Renewable Energy: ${dataset.avgRenewable}%\n• Recycling Rate: ${dataset.avgRecycling}%\n\n**Key Findings:**\n• Nordic countries lead with scores 80-90\n• High renewable energy strongly correlates with low CO₂\n• Water access gaps persist in sub-Saharan Africa\n• Developing nations show fastest renewable growth rates\n\nAsk me about specific countries, metrics, or policy recommendations!`
    suggestions = ['Which country has highest sustainability?', 'How to reduce CO2 emissions?', 'Compare India and USA sustainability', 'Best renewable energy policies']
  }

  return c.json({ response, suggestions })
})

// ─────────────────────────────────────────────
// RL POLICY OPTIMIZER
// ─────────────────────────────────────────────
app.post('/rl_optimize', async (c) => {
  const body = await c.req.json()
  const { episodes = 20 } = body

  // Simulate Deep Q-Learning training trajectory
  const trainingData: Array<{episode: number, reward: number, score: number}> = []
  let score = 40 + Math.random() * 10
  
  for (let ep = 1; ep <= episodes; ep++) {
    // Simulated Q-learning convergence
    const explorationDecay = Math.exp(-ep / (episodes * 0.3))
    const reward = 20 * (1 - explorationDecay) + Math.random() * 8 - 4
    score = Math.min(100, score + reward * 0.5 + (Math.random() - 0.5) * 2)
    
    trainingData.push({
      episode: ep,
      reward: parseFloat(reward.toFixed(2)),
      score: parseFloat(score.toFixed(2))
    })
  }

  // Optimal policy found
  const optimalPolicy = {
    renewable: 78 + Math.random() * 15,
    recycling: 65 + Math.random() * 20,
    waterAccess: 95 + Math.random() * 5,
    co2Reduction: 62 + Math.random() * 15,
    finalScore: trainingData[trainingData.length - 1].score,
  }

  // Round values
  Object.keys(optimalPolicy).forEach(k => {
    const key = k as keyof typeof optimalPolicy
    optimalPolicy[key] = parseFloat(Math.min(100, optimalPolicy[key]).toFixed(1))
  })

  return c.json({ trainingData, optimalPolicy })
})

// ─────────────────────────────────────────────
// ANOMALY DETECTION
// ─────────────────────────────────────────────
app.get('/anomaly_data', (c) => {
  const points: Array<{
    time: string; co2: number; water: number; energy: number; isAnomaly: boolean; cause?: string
  }> = []

  const now = new Date(2025, 0, 1)
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(now)
    date.setDate(now.getDate() + i)
    
    const isAnomaly = [5, 12, 22].includes(i)
    const multiplier = isAnomaly ? (2.2 + Math.random() * 1.5) : 1

    const causes = ['Industrial pollution spike', 'Factory discharge event', 'Wildfire emissions surge']
    
    points.push({
      time: date.toISOString().split('T')[0],
      co2: parseFloat((5.2 * multiplier + (Math.random() - 0.5) * 0.8).toFixed(2)),
      water: parseFloat((2.1 * multiplier + (Math.random() - 0.5) * 0.3).toFixed(2)),
      energy: parseFloat((180 * multiplier + (Math.random() - 0.5) * 20).toFixed(1)),
      isAnomaly,
      cause: isAnomaly ? causes[[5, 12, 22].indexOf(i)] : undefined,
    })
  }

  return c.json(points)
})

// ─────────────────────────────────────────────
// SDG PROGRESS DATA
// ─────────────────────────────────────────────
app.get('/sdg_data', (c) => {
  return c.json({
    sdgs: [
      {
        id: 6, name: 'Clean Water & Sanitation', icon: '💧',
        progress: 71, target: 100, color: '#1E88E5',
        metric: 'Water access', value: '91%',
        recommendation: 'Invest in water infrastructure in sub-Saharan Africa. Rainwater harvesting can close the 9% gap.',
        trend: [45, 52, 58, 63, 68, 71],
      },
      {
        id: 7, name: 'Affordable & Clean Energy', icon: '⚡',
        progress: 40, target: 100, color: '#FDD835',
        metric: 'Renewable share', value: '40%',
        recommendation: 'Scale solar and wind deployment. Price parity achieved in most regions — remove fossil fuel subsidies.',
        trend: [15, 20, 25, 30, 35, 40],
      },
      {
        id: 11, name: 'Sustainable Cities', icon: '🏙️',
        progress: 58, target: 100, color: '#F57C00',
        metric: 'Urban sustainability', value: '58/100',
        recommendation: 'Implement smart city IoT networks, green building codes, and zero-emission transit systems.',
        trend: [30, 37, 42, 48, 54, 58],
      },
      {
        id: 13, name: 'Climate Action', icon: '🌡️',
        progress: 32, target: 100, color: '#E53935',
        metric: 'CO₂ reduction', value: '32% toward target',
        recommendation: 'Accelerate carbon pricing, phase out coal by 2030, and fund adaptation in vulnerable nations.',
        trend: [5, 10, 16, 22, 27, 32],
      },
      {
        id: 15, name: 'Life on Land', icon: '🌲',
        progress: 54, target: 100, color: '#43A047',
        metric: 'Forest coverage', value: '54%',
        recommendation: 'Halt deforestation with REDD+ programs. Restore 350M hectares of degraded land by 2030.',
        trend: [62, 60, 57, 55, 54, 54],
      },
      {
        id: 14, name: 'Life Below Water', icon: '🌊',
        progress: 47, target: 100, color: '#039BE5',
        metric: 'Ocean health index', value: '47/100',
        recommendation: 'Expand marine protected areas to 30% of oceans. Enforce plastic pollution regulations globally.',
        trend: [60, 58, 54, 51, 48, 47],
      },
    ],
    aiScore: 61,
    yearlyTarget: 2030,
  })
})

export default app
