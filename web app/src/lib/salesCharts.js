import { Chart } from 'chart.js'
import { destroyChart } from './activityCharts.js'
import { saleAmountPending, summarizeCashFlow } from './salesStore.js'

export { destroyChart }

const PALETTE = {
  cashIn: '#34d399',
  cashOut: '#f87171',
  balance: '#38bdf8',
  pending: '#fbbf24',
  revenue: ['#34d399', '#38bdf8', '#a78bfa'],
  muted: '#71717a',
  grid: 'rgba(255,255,255,0.06)',
  text: '#a1a1aa'
}

const REVENUE_CATEGORIES = [
  { key: 'sale', label: 'Sales' },
  { key: 'tech_services', label: 'Tech Services' },
  { key: 'investment', label: 'Investment' }
]

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
  const n = Number(v) || 0
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1000) return sign + 'N$' + (abs / 1000).toFixed(0) + 'k'
  return sign + 'N$' + abs
}

function moneyTooltip(value) {
  return 'N$ ' + Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function moneyRound(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

/** Month 1 = July (fiscal year), through current month, up to count months. */
function monthKeys(count) {
  const keys = []
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  let startYear = now.getFullYear()
  if (now.getMonth() < 6) startYear -= 1

  for (let i = 0; i < count; i++) {
    const m = new Date(startYear, 6 + i, 1)
    if (m > currentMonthStart) break
    const key = m.getFullYear() + "-" + String(m.getMonth() + 1).padStart(2, "0")
    const label = m.toLocaleDateString(undefined, { month: "short", year: "numeric" })
    keys.push({ key, label })
  }
  return keys
}

function endOfMonthMs(yearMonth) {
  const [y, mo] = yearMonth.split('-').map(Number)
  return new Date(y, mo, 0, 23, 59, 59, 999).getTime()
}

function startOfMonthMs(yearMonth) {
  const [y, mo] = yearMonth.split('-').map(Number)
  return new Date(y, mo - 1, 1, 0, 0, 0, 0).getTime()
}

function cashReceivedForSaleBefore(saleId, cash, beforeMs) {
  return moneyRound(
    (cash || [])
      .filter(
        (c) =>
          !c.deleted &&
          c.saleId === saleId &&
          c.category === 'sale' &&
          c.type === 'in' &&
          new Date(c.at).getTime() <= beforeMs
      )
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
  )
}

function pendingAsOfMs(beforeMs, sales, cash) {
  const activeSales = (sales || []).filter(
    (s) =>
      !s.deleted &&
      s.status !== 'cancelled' &&
      new Date(s.soldAt || 0).getTime() <= beforeMs
  )
  return moneyRound(
    activeSales.reduce((sum, s) => {
      const received = cashReceivedForSaleBefore(s.id, cash, beforeMs)
      return sum + Math.max(0, moneyRound(s.amount) - received)
    }, 0)
  )
}

function buildRevenueByCategory(cash) {
  const activeCash = (cash || []).filter((c) => !c.deleted && c.type === 'in')
  return REVENUE_CATEGORIES.map(({ key, label }) => ({
    category: key,
    name: label,
    in: moneyRound(
      activeCash
        .filter((c) => c.category === key)
        .reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
    )
  }))
}

/** Build chart-ready aggregates — totals match Cash tab (summarizeCashFlow). */
export function buildSalesPerformanceData({
  sales = [],
  cash = [],
  pendingAmount = 0,
  months = 12
} = {}) {
  const activeCash = (cash || []).filter((c) => !c.deleted)
  const summary = summarizeCashFlow(activeCash)
  const activeSales = (sales || []).filter((s) => !s.deleted && s.status !== 'cancelled')
  const pending = moneyRound(
    pendingAmount != null && pendingAmount >= 0
      ? pendingAmount
      : activeSales.reduce((sum, s) => sum + saleAmountPending(s), 0)
  )

  const monthList = monthKeys(months)
  const firstMonthStart = startOfMonthMs(monthList[0].key)

  let prePeriodBalance = 0
  for (const c of [...activeCash].sort((a, b) => String(a.at).localeCompare(String(b.at)))) {
    const atMs = new Date(c.at).getTime()
    if (Number.isNaN(atMs) || atMs >= firstMonthStart) continue
    const amount = Number(c.amount) || 0
    prePeriodBalance += c.type === 'out' ? -amount : amount
  }

  const cashInByMonth = new Map()
  const cashOutByMonth = new Map()
  for (const c of activeCash) {
    const atMs = new Date(c.at).getTime()
    if (Number.isNaN(atMs) || atMs < firstMonthStart) continue
    const key = String(c.at || '').slice(0, 7)
    if (!key || key.length < 7) continue
    const amount = Number(c.amount) || 0
    if (c.type === 'out') {
      cashOutByMonth.set(key, (cashOutByMonth.get(key) || 0) + amount)
    } else {
      cashInByMonth.set(key, (cashInByMonth.get(key) || 0) + amount)
    }
  }

  let runningBalance = moneyRound(prePeriodBalance)
  const byMonth = monthList.map(({ key, label }) => {
    const cashIn = moneyRound(cashInByMonth.get(key) || 0)
    const cashOut = moneyRound(cashOutByMonth.get(key) || 0)
    runningBalance = moneyRound(runningBalance + cashIn - cashOut)
    const endMs = endOfMonthMs(key)
    return {
      key,
      label,
      cashIn,
      cashOut,
      balance: runningBalance,
      pending: pendingAsOfMs(endMs, activeSales, activeCash)
    }
  })

  if (byMonth.length) {
    byMonth[byMonth.length - 1].pending = pending
  }

  const revenueByCategory = buildRevenueByCategory(activeCash)

  return {
    months,
    byMonth,
    revenueByCategory,
    totals: {
      inflow: moneyRound(summary.inflow),
      outflow: moneyRound(summary.outflow),
      balance: moneyRound(summary.balance),
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

export function makeMonthlyPerformanceBar(canvas, byMonth = []) {
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: byMonth.map((m) => m.label),
      datasets: [
        {
          label: 'Cash in',
          data: byMonth.map((m) => m.cashIn || 0),
          backgroundColor: PALETTE.cashIn,
          borderRadius: 4
        },
        {
          label: 'Cash out',
          data: byMonth.map((m) => m.cashOut || 0),
          backgroundColor: PALETTE.cashOut,
          borderRadius: 4
        },
        {
          label: 'Balance',
          data: byMonth.map((m) => m.balance || 0),
          backgroundColor: PALETTE.balance,
          borderRadius: 4
        },
        {
          label: 'Pending',
          data: byMonth.map((m) => m.pending || 0),
          backgroundColor: PALETTE.pending,
          borderRadius: 4
        }
      ]
    },
    options: baseOptions({
      plugins: {
        ...baseOptions().plugins,
        tooltip: {
          ...baseOptions().plugins.tooltip,
          callbacks: {
            label(ctx) {
              return ctx.dataset.label + ': ' + moneyTooltip(ctx.parsed.y)
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: PALETTE.text, maxRotation: 45, autoSkipPadding: 8 },
          grid: { display: false }
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

export function makeRevenueCategoryBar(canvas, rows = []) {
  const colors = rows.map((_, i) => PALETTE.revenue[i % PALETTE.revenue.length])
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: rows.map((r) => r.name),
      datasets: [
        {
          label: 'Cash in',
          data: rows.map((r) => r.in || 0),
          backgroundColor: colors,
          borderRadius: 8,
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
              return moneyTooltip(ctx.raw)
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
