import { Chart } from 'chart.js'
import { destroyChart } from './activityCharts.js'
import { saleAmountPending, summarizeCashFlow, cashCategoryLabel } from './salesStore.js'

export { destroyChart }

const PALETTE = {
  cashIn: '#34d399',
  cashOut: '#f87171',
  pending: '#fbbf24',
  categories: ['#34d399', '#38bdf8', '#a78bfa', '#fbbf24', '#fb7185', '#94a3b8'],
  muted: '#71717a',
  grid: 'rgba(255,255,255,0.06)',
  text: '#a1a1aa'
}

const INCOME_CATEGORIES = ['sale', 'investment', 'tech_services', 'other', 'refund']

function baseOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: PALETTE.text, boxWidth: 12, font: { size: 11 } }
      },
      tooltip: {
        backgroundColor: '#18181b',
        titleColor: '#fafafa',
        bodyColor: '#d4d4d8',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1
      }
    },
    ...extra
  }
}

function moneyTick(v) {
  return v >= 1000 ? `N$${(v / 1000).toFixed(0)}k` : `N$${v}`
}

function dayKeys(days) {
  const keys = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    keys.push(d.toISOString().slice(0, 10))
  }
  return keys
}

function inWindow(iso, cutoffMs) {
  const t = new Date(iso).getTime()
  return !Number.isNaN(t) && t >= cutoffMs
}

function moneyRound(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

/** Build chart-ready aggregates — totals match Cash tab (summarizeCashFlow). */
export function buildSalesPerformanceData({
  sales = [],
  cash = [],
  pendingAmount = 0,
  days = 90
} = {}) {
  const activeCash = (cash || []).filter((c) => !c.deleted)
  const summary = summarizeCashFlow(activeCash)
  const activeSales = (sales || []).filter((s) => !s.deleted && s.status !== 'cancelled')
  const pending = moneyRound(
    pendingAmount != null && pendingAmount > 0
      ? pendingAmount
      : activeSales.reduce((sum, s) => sum + saleAmountPending(s), 0)
  )

  const cutoffMs = Date.now() - days * 86400000
  const cashInByDay = new Map()
  const cashOutByDay = new Map()
  for (const c of activeCash) {
    if (!inWindow(c.at, cutoffMs)) continue
    const key = String(c.at || '').slice(0, 10)
    if (!key) continue
    const amount = Number(c.amount) || 0
    if (c.type === 'out') {
      cashOutByDay.set(key, (cashOutByDay.get(key) || 0) + amount)
    } else {
      cashInByDay.set(key, (cashInByDay.get(key) || 0) + amount)
    }
  }

  const byDay = dayKeys(days).map((date) => ({
    date,
    cashIn: Math.round((cashInByDay.get(date) || 0) * 100) / 100,
    cashOut: Math.round((cashOutByDay.get(date) || 0) * 100) / 100
  }))

  const byCategory = Object.entries(summary.byCategory || {})
    .map(([category, amounts]) => ({
      category,
      name: cashCategoryLabel(category),
      in: Math.round((amounts.in || 0) * 100) / 100,
      out: Math.round((amounts.out || 0) * 100) / 100,
      net: Math.round(((amounts.in || 0) - (amounts.out || 0)) * 100) / 100
    }))
    .filter((r) => r.in > 0.004 || r.out > 0.004)
    .sort((a, b) => b.in - a.in)

  const byIncomeCategory = byCategory
    .filter((r) => INCOME_CATEGORIES.includes(r.category) && r.in > 0.004)
    .sort((a, b) => b.in - a.in)

  return {
    days,
    byDay,
    byCategory,
    byIncomeCategory,
    totals: {
      inflow: Math.round(summary.inflow * 100) / 100,
      outflow: Math.round(summary.outflow * 100) / 100,
      balance: Math.round(summary.balance * 100) / 100,
      pending,
      salesCount: activeSales.length
    },
    hasData:
      summary.inflow > 0 ||
      summary.outflow > 0 ||
      pending > 0 ||
      activeSales.length > 0
  }
}

export function makeCashFlowTrend(canvas, byDay = []) {
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: byDay.map((d) => d.date.slice(5)),
      datasets: [
        {
          label: 'Cash in',
          data: byDay.map((d) => d.cashIn || 0),
          borderColor: PALETTE.cashIn,
          backgroundColor: 'rgba(52,211,153,0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: 'Cash out',
          data: byDay.map((d) => d.cashOut || 0),
          borderColor: PALETTE.cashOut,
          backgroundColor: 'rgba(248,113,113,0.08)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2
        }
      ]
    },
    options: baseOptions({
      scales: {
        x: {
          ticks: { color: PALETTE.text, maxRotation: 0, autoSkipPadding: 12 },
          grid: { color: PALETTE.grid }
        },
        y: {
          beginAtZero: true,
          ticks: { color: PALETTE.text, callback: moneyTick },
          grid: { color: PALETTE.grid }
        }
      }
    })
  })
}

export function makeCategoryInflowBar(canvas, rows = []) {
  const colors = rows.map((_, i) => PALETTE.categories[i % PALETTE.categories.length])
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: rows.map((r) => r.name),
      datasets: [
        {
          label: 'Cash in',
          data: rows.map((r) => r.in),
          backgroundColor: colors,
          borderRadius: 6,
          borderSkipped: false
        }
      ]
    },
    options: baseOptions({
      indexAxis: 'y',
      plugins: {
        ...baseOptions().plugins,
        legend: { display: false },
        tooltip: {
          ...baseOptions().plugins.tooltip,
          callbacks: {
            label(ctx) {
              return `N$ ${Number(ctx.raw || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: PALETTE.text, callback: moneyTick },
          grid: { color: PALETTE.grid }
        },
        y: {
          ticks: { color: PALETTE.text },
          grid: { display: false }
        }
      }
    })
  })
}

export function makeCashOverviewDoughnut(canvas, totals) {
  const rows = [
    { name: 'Cash in', value: totals.inflow, color: PALETTE.cashIn },
    { name: 'Cash out', value: totals.outflow, color: PALETTE.cashOut },
    { name: 'Pending (sales)', value: totals.pending, color: PALETTE.pending }
  ].filter((r) => r.value > 0.004)

  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: rows.map((r) => r.name),
      datasets: [
        {
          data: rows.map((r) => r.value),
          backgroundColor: rows.map((r) => r.color),
          borderWidth: 0,
          hoverOffset: 4
        }
      ]
    },
    options: baseOptions({
      cutout: '62%',
      plugins: {
        ...baseOptions().plugins,
        legend: {
          position: 'bottom',
          labels: { color: PALETTE.text, boxWidth: 12, font: { size: 11 } }
        },
        tooltip: {
          ...baseOptions().plugins.tooltip,
          callbacks: {
            label(ctx) {
              return `${ctx.label}: N$ ${Number(ctx.raw || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
            }
          }
        }
      }
    })
  })
}
