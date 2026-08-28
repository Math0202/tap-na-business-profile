import { Chart } from 'chart.js'
import { destroyChart } from './activityCharts.js'
import { saleAmountPending } from './salesStore.js'

export { destroyChart }

const PALETTE = {
  cashIn: '#34d399',
  commission: '#fbbf24',
  pending: '#fbbf24',
  paid: '#34d399',
  partial: '#38bdf8',
  unpaid: '#71717a',
  agent: '#38bdf8',
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
        borderWidth: 1,
        callbacks: {
          label(ctx) {
            const v = ctx.parsed?.y ?? ctx.parsed?.x ?? ctx.raw
            if (typeof v === 'number' && ctx.dataset?.label?.includes('N$')) {
              return `${ctx.dataset.label}: N$ ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
            }
            return undefined
          }
        }
      }
    },
    ...extra
  }
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

/** Build chart-ready aggregates from scoped sales + cash. */
export function buildSalesPerformanceData({
  sales = [],
  cash = [],
  agents = [],
  days = 90
} = {}) {
  const cutoffMs = Date.now() - days * 86400000
  const activeSales = (sales || []).filter((s) => !s.deleted && s.status !== 'cancelled')

  const saleCashIn = (cash || []).filter(
    (c) => !c.deleted && c.type === 'in' && c.category === 'sale' && inWindow(c.at, cutoffMs)
  )
  const commissionOut = (cash || []).filter(
    (c) => !c.deleted && c.type === 'out' && c.category === 'commission' && inWindow(c.at, cutoffMs)
  )

  const cashByDay = new Map()
  for (const c of saleCashIn) {
    const key = String(c.at || '').slice(0, 10)
    if (!key) continue
    cashByDay.set(key, (cashByDay.get(key) || 0) + (Number(c.amount) || 0))
  }

  const commissionByDay = new Map()
  for (const c of commissionOut) {
    const key = String(c.at || '').slice(0, 10)
    if (!key) continue
    commissionByDay.set(key, (commissionByDay.get(key) || 0) + (Number(c.amount) || 0))
  }

  const byDay = dayKeys(days).map((date) => ({
    date,
    cashIn: Math.round((cashByDay.get(date) || 0) * 100) / 100,
    commission: Math.round((commissionByDay.get(date) || 0) * 100) / 100
  }))

  let paidAmount = 0
  let partialAmount = 0
  let pendingAmount = 0
  for (const s of activeSales) {
    const total = Number(s.amount) || 0
    const due = saleAmountPending(s)
    if (due <= 0.004) paidAmount += total
    else if (due >= total - 0.004) pendingAmount += total
    else partialAmount += due
  }

  const byStatus = [
    { name: 'Paid', count: Math.round(paidAmount) },
    { name: 'Partial', count: Math.round(partialAmount) },
    { name: 'Outstanding', count: Math.round(pendingAmount) }
  ].filter((r) => r.count > 0)

  const agentMap = new Map((agents || []).map((a) => [a.id, a.name || 'Agent']))
  const revenueByAgent = new Map()
  for (const c of saleCashIn) {
    const aid = c.agentId || '_none'
    revenueByAgent.set(aid, (revenueByAgent.get(aid) || 0) + (Number(c.amount) || 0))
  }
  const byAgent = [...revenueByAgent.entries()]
    .map(([id, amount]) => ({
      name: id === '_none' ? 'Unassigned' : agentMap.get(id) || id,
      count: Math.round(amount * 100) / 100
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const totals = {
    cashIn: Math.round(saleCashIn.reduce((s, c) => s + (Number(c.amount) || 0), 0) * 100) / 100,
    commission: Math.round(commissionOut.reduce((s, c) => s + (Number(c.amount) || 0), 0) * 100) / 100,
    salesCount: activeSales.length
  }

  return {
    days,
    byDay,
    byStatus,
    byAgent,
    totals,
    hasData: totals.cashIn > 0 || activeSales.length > 0
  }
}

export function makeSalesCashTrend(canvas, byDay = []) {
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: byDay.map((d) => d.date.slice(5)),
      datasets: [
        {
          label: 'Cash in (N$)',
          data: byDay.map((d) => d.cashIn || 0),
          borderColor: PALETTE.cashIn,
          backgroundColor: 'rgba(52,211,153,0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: 'Commission out (N$)',
          data: byDay.map((d) => d.commission || 0),
          borderColor: PALETTE.commission,
          backgroundColor: 'transparent',
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
          ticks: {
            color: PALETTE.text,
            callback: (v) => (v >= 1000 ? `N$${(v / 1000).toFixed(0)}k` : `N$${v}`)
          },
          grid: { color: PALETTE.grid }
        }
      }
    })
  })
}

export function makeSalesStatusDoughnut(canvas, rows = []) {
  const colors = {
    Paid: PALETTE.paid,
    Partial: PALETTE.partial,
    Outstanding: PALETTE.pending
  }
  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: rows.map((r) => r.name),
      datasets: [
        {
          data: rows.map((r) => r.count),
          backgroundColor: rows.map((r) => colors[r.name] || PALETTE.unpaid),
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
              const v = ctx.raw || 0
              return `${ctx.label}: N$ ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
            }
          }
        }
      }
    })
  })
}

export function makeAgentRevenueBar(canvas, rows = []) {
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: rows.map((r) => r.name),
      datasets: [
        {
          label: 'Cash in (N$)',
          data: rows.map((r) => r.count),
          backgroundColor: PALETTE.agent,
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
          ticks: {
            color: PALETTE.text,
            callback: (v) => (v >= 1000 ? `N$${(v / 1000).toFixed(0)}k` : `N$${v}`)
          },
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
