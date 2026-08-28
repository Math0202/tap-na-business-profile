import { Chart } from 'chart.js'
import { destroyChart } from './activityCharts.js'
import { saleAmountPending, summarizeCashFlow } from './salesStore.js'

export { destroyChart }

const PALETTE = {
  cashIn: '#34d399',
  cashOut: '#f87171',
  balance: '#38bdf8',
  pending: '#fbbf24',
  muted: '#71717a',
  grid: 'rgba(255,255,255,0.06)',
  text: '#a1a1aa'
}

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
  if (abs >= 1000) return `${sign}N$${(abs / 1000).toFixed(0)}k`
  return `${sign}N$${abs}`
}

function moneyTooltip(value) {
  return `N$ ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
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

function endOfDayMs(dateKey) {
  return new Date(`${dateKey}T23:59:59`).getTime()
}

function moneyRound(n) {
  return Math.round((Number(n) || 0) * 100) / 100
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

function pendingAsOf(dateKey, sales, cash) {
  const beforeMs = endOfDayMs(dateKey)
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
    pendingAmount != null && pendingAmount >= 0
      ? pendingAmount
      : activeSales.reduce((sum, s) => sum + saleAmountPending(s), 0)
  )

  const cutoffMs = Date.now() - days * 86400000
  const cashInByDay = new Map()
  const cashOutByDay = new Map()

  let prePeriodBalance = 0
  for (const c of [...activeCash].sort((a, b) => String(a.at).localeCompare(String(b.at)))) {
    const amount = Number(c.amount) || 0
    const atMs = new Date(c.at).getTime()
    const delta = c.type === 'out' ? -amount : amount
    if (!Number.isNaN(atMs) && atMs < cutoffMs) {
      prePeriodBalance += delta
      continue
    }
    if (Number.isNaN(atMs) || atMs < cutoffMs) continue
    const key = String(c.at || '').slice(0, 10)
    if (!key) continue
    if (c.type === 'out') {
      cashOutByDay.set(key, (cashOutByDay.get(key) || 0) + amount)
    } else {
      cashInByDay.set(key, (cashInByDay.get(key) || 0) + amount)
    }
  }

  let runningBalance = moneyRound(prePeriodBalance)
  const byDay = dayKeys(days).map((date) => {
    const cashIn = Math.round((cashInByDay.get(date) || 0) * 100) / 100
    const cashOut = Math.round((cashOutByDay.get(date) || 0) * 100) / 100
    runningBalance = moneyRound(runningBalance + cashIn - cashOut)
    return {
      date,
      cashIn,
      cashOut,
      balance: runningBalance,
      pending: pendingAsOf(date, activeSales, activeCash)
    }
  })

  if (byDay.length) {
    byDay[byDay.length - 1].pending = pending
  }

  return {
    days,
    byDay,
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

export function makePerformanceTrend(canvas, byDay = []) {
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: byDay.map((d) => d.date.slice(5)),
      datasets: [
        {
          label: 'Cash in',
          data: byDay.map((d) => d.cashIn || 0),
          borderColor: PALETTE.cashIn,
          backgroundColor: 'rgba(52,211,153,0.12)',
          fill: false,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: 'Cash out',
          data: byDay.map((d) => d.cashOut || 0),
          borderColor: PALETTE.cashOut,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: 'Balance',
          data: byDay.map((d) => d.balance || 0),
          borderColor: PALETTE.balance,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2.5
        },
        {
          label: 'Pending',
          data: byDay.map((d) => d.pending || 0),
          borderColor: PALETTE.pending,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2,
          borderDash: [6, 4]
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
      },
      plugins: {
        ...baseOptions().plugins,
        tooltip: {
          ...baseOptions().plugins.tooltip,
          callbacks: {
            label(ctx) {
              return `${ctx.dataset.label}: ${moneyTooltip(ctx.parsed.y)}`
            }
          }
        }
      }
    })
  })
}

export function makePerformanceSummaryBar(canvas, totals) {
  const labels = ['Cash in', 'Cash out', 'Balance', 'Pending']
  const values = [totals.inflow, totals.outflow, totals.balance, totals.pending]
  const colors = [PALETTE.cashIn, PALETTE.cashOut, PALETTE.balance, PALETTE.pending]

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderRadius: 8,
          borderSkipped: false
        }
      ]
    },
    options: baseOptions({
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
          ticks: { color: PALETTE.text },
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
