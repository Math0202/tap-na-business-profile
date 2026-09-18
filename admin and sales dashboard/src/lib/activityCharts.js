import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const PALETTE = {
  nfc: '#34d399',
  qr: '#38bdf8',
  other: '#a1a1aa',
  opens: '#34d399',
  clicks: '#38bdf8',
  shares: '#a78bfa',
  logins: '#fbbf24',
  muted: '#71717a',
  grid: 'rgba(255,255,255,0.06)',
  text: '#a1a1aa'
}

const CHANNEL_COLORS = {
  nfc: PALETTE.nfc,
  qr: PALETTE.qr,
  other: PALETTE.other,
  'NFC tap': PALETTE.nfc,
  QR: PALETTE.qr,
  'Web / other': PALETTE.other
}

export function channelDisplayName(name) {
  const k = String(name || '').toLowerCase()
  if (k === 'nfc') return 'NFC tap'
  if (k === 'qr') return 'QR scan'
  return 'Web / other'
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

export function destroyChart(chart) {
  if (chart && typeof chart.destroy === 'function') chart.destroy()
}

export function makeDoughnut(canvas, rows, { labelMap } = {}) {
  const labels = (rows || []).map((r) =>
    labelMap ? labelMap(r.name) : r.name
  )
  const data = (rows || []).map((r) => r.count)
  const colors = (rows || []).map((r) => {
    const key = String(r.name || '').toLowerCase()
    return CHANNEL_COLORS[key] || CHANNEL_COLORS[r.name] || '#52525b'
  })
  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
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
        }
      }
    })
  })
}

export function makePie(canvas, rows, colors) {
  const labels = (rows || []).map((r) => r.name)
  const data = (rows || []).map((r) => r.count)
  const bg =
    colors ||
    ['#34d399', '#38bdf8', '#a78bfa', '#fbbf24', '#fb7185', '#94a3b8'].slice(
      0,
      labels.length
    )
  return new Chart(canvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [{ data, backgroundColor: bg, borderWidth: 0 }]
    },
    options: baseOptions({
      plugins: {
        ...baseOptions().plugins,
        legend: {
          position: 'bottom',
          labels: { color: PALETTE.text, boxWidth: 12, font: { size: 11 } }
        }
      }
    })
  })
}

export function makeActivityTrend(canvas, byDay = []) {
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: byDay.map((d) => d.date.slice(5)),
      datasets: [
        {
          label: 'Opens',
          data: byDay.map((d) => d.opens || 0),
          borderColor: PALETTE.opens,
          backgroundColor: 'rgba(52,211,153,0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: 'Clicks',
          data: byDay.map((d) => d.clicks || 0),
          borderColor: PALETTE.clicks,
          backgroundColor: 'transparent',
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: 'Shares',
          data: byDay.map((d) => d.shares || 0),
          borderColor: PALETTE.shares,
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
          ticks: { color: PALETTE.text, precision: 0 },
          grid: { color: PALETTE.grid }
        }
      }
    })
  })
}

export function makeBar(canvas, rows = [], { horizontal = true, color = '#38bdf8' } = {}) {
  const labels = rows.map((r) => r.name)
  const data = rows.map((r) => r.count)
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: color,
          borderRadius: 6,
          borderSkipped: false
        }
      ]
    },
    options: baseOptions({
      indexAxis: horizontal ? 'y' : 'x',
      plugins: {
        ...baseOptions().plugins,
        legend: { display: false }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: PALETTE.text, precision: 0 },
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

export function makeHourBars(canvas, byHour = []) {
  const rows = Array.from({ length: 24 }, (_, hour) => {
    const hit = byHour.find((h) => Number(h.hour) === hour)
    return { name: String(hour).padStart(2, '0'), count: hit?.count || 0 }
  })
  return makeBar(canvas, rows, { horizontal: false, color: '#a78bfa' })
}

export function makeLoginTrend(canvas, byDay = []) {
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: byDay.map((d) => d.date.slice(5)),
      datasets: [
        {
          label: 'Logins',
          data: byDay.map((d) => d.count || 0),
          borderColor: PALETTE.logins,
          backgroundColor: 'rgba(251,191,36,0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2
        }
      ]
    },
    options: baseOptions({
      plugins: {
        ...baseOptions().plugins,
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { color: PALETTE.text, maxRotation: 0 },
          grid: { color: PALETTE.grid }
        },
        y: {
          beginAtZero: true,
          ticks: { color: PALETTE.text, precision: 0 },
          grid: { color: PALETTE.grid }
        }
      }
    })
  })
}
