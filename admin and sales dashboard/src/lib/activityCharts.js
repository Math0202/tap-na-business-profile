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
  owners: '#fbbf24',
  staff: '#38bdf8',
  muted: '#71717a',
  grid: 'rgba(255,255,255,0.06)',
  text: '#a1a1aa'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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

function parseDay(dateStr) {
  const s = String(dateStr || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

function isoDay(d) {
  return d.toISOString().slice(0, 10)
}

/** Monday-start week key (UTC). */
function weekKeyUtc(d) {
  const x = new Date(d.getTime())
  const day = x.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setUTCDate(x.getUTCDate() + diff)
  return isoDay(x)
}

export function formatBucketLabel(key, granularity = 'day') {
  const g = String(granularity || 'day')
  if (g === 'year') return String(key)
  if (g === 'month') {
    const [y, m] = String(key).split('-')
    const mi = Math.max(0, Math.min(11, Number(m) - 1))
    return `${MONTHS[mi]} ${y}`
  }
  const d = parseDay(key)
  if (!d) return String(key)
  const mon = MONTHS[d.getUTCMonth()]
  const day = d.getUTCDate()
  if (g === 'week') return `${mon} ${day}`
  return `${mon} ${day}`
}

function bucketKeyForDay(dateStr, granularity = 'day') {
  const g = String(granularity || 'day')
  const d = parseDay(dateStr)
  if (!d) return ''
  if (g === 'year') return String(d.getUTCFullYear())
  if (g === 'month') return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  if (g === 'week') return weekKeyUtc(d)
  return isoDay(d)
}

/**
 * Aggregate daily activity rows into year/month/week/day buckets.
 * @param {Array<{date:string,opens?:number,clicks?:number,shares?:number,total?:number}>} byDay
 */
export function bucketActivitySeries(byDay = [], granularity = 'day') {
  const map = {}
  for (const row of byDay || []) {
    const key = bucketKeyForDay(row.date, granularity)
    if (!key) continue
    if (!map[key]) map[key] = { date: key, opens: 0, clicks: 0, shares: 0, total: 0 }
    map[key].opens += row.opens || 0
    map[key].clicks += row.clicks || 0
    map[key].shares += row.shares || 0
    map[key].total += row.total || 0
  }
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Aggregate login split rows: { date, owners, staff, count? }
 */
export function bucketLoginSeries(rows = [], granularity = 'day') {
  const map = {}
  for (const row of rows || []) {
    const key = bucketKeyForDay(row.date, granularity)
    if (!key) continue
    if (!map[key]) map[key] = { date: key, owners: 0, staff: 0, count: 0 }
    map[key].owners += row.owners || 0
    map[key].staff += row.staff || 0
    map[key].count += row.count != null ? row.count : (row.owners || 0) + (row.staff || 0)
  }
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
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

export function makeActivityTrend(canvas, byDay = [], { granularity = 'day' } = {}) {
  const rows = bucketActivitySeries(byDay, granularity)
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: rows.map((d) => formatBucketLabel(d.date, granularity)),
      datasets: [
        {
          label: 'Opens',
          data: rows.map((d) => d.opens || 0),
          borderColor: PALETTE.opens,
          backgroundColor: 'rgba(52,211,153,0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: 'Clicks',
          data: rows.map((d) => d.clicks || 0),
          borderColor: PALETTE.clicks,
          backgroundColor: 'transparent',
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: 'Shares',
          data: rows.map((d) => d.shares || 0),
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

export function makeBar(
  canvas,
  rows = [],
  { horizontal = true, color = '#38bdf8', onClick } = {}
) {
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
      onClick: typeof onClick === 'function'
        ? (evt, elements, chart) => {
            const el = elements?.[0]
            if (!el) return
            onClick(el.index, rows[el.index], evt, chart)
          }
        : undefined,
      onHover: typeof onClick === 'function'
        ? (evt, elements) => {
            const target = evt?.native?.target
            if (target) target.style.cursor = elements?.length ? 'pointer' : 'default'
          }
        : undefined,
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

/** Dual-line owner vs staff login trend. Accepts loginsByBucket or legacy loginsByDay. */
export function makeLoginTrend(canvas, rows = [], { granularity = 'day' } = {}) {
  const normalized = (rows || []).map((r) => ({
    date: r.date,
    owners: r.owners != null ? r.owners : r.count || 0,
    staff: r.staff != null ? r.staff : 0,
    count: r.count != null ? r.count : (r.owners || 0) + (r.staff || 0)
  }))
  const bucketed = bucketLoginSeries(normalized, granularity)
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: bucketed.map((d) => formatBucketLabel(d.date, granularity)),
      datasets: [
        {
          label: 'Owners',
          data: bucketed.map((d) => d.owners || 0),
          borderColor: PALETTE.owners,
          backgroundColor: 'rgba(251,191,36,0.12)',
          fill: false,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: 'Staff',
          data: bucketed.map((d) => d.staff || 0),
          borderColor: PALETTE.staff,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2
        }
      ]
    },
    options: baseOptions({
      plugins: {
        ...baseOptions().plugins,
        legend: {
          display: true,
          position: 'bottom',
          labels: { color: PALETTE.text, boxWidth: 12, font: { size: 11 } }
        }
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
