/**
 * CRM funnel for agent performance: prospects, visited, quoted, invoiced, closed.
 * Later stages count toward earlier ones so conversion stays a real funnel.
 */

import { invoicePaidAmount, invoiceRemaining, moneyRound } from './salesStore'

const OPEN_QUOTE = new Set(['draft', 'sent', 'accepted'])
const QUALIFYING_QUOTE = new Set(['draft', 'sent', 'accepted', 'converted'])
const OPEN_INVOICE = new Set(['draft', 'sent', 'partially_settled'])

const STAGE_DEFS = [
  { id: 'prospects', label: 'Prospects' },
  { id: 'visited', label: 'Visited' },
  { id: 'quoted', label: 'Quoted' },
  { id: 'invoiced', label: 'Invoiced' },
  { id: 'closed', label: 'Closed' }
]

function pct(part, whole) {
  if (!whole) return null
  return Math.round((part / whole) * 1000) / 10
}

function inWindow(iso, since) {
  if (!since) return true
  const t = Date.parse(iso || '')
  return Number.isFinite(t) && t >= since
}

function clientKey(doc, emailToId) {
  const id = String(doc?.clientId || '').trim()
  if (id) return id
  const email = String(doc?.customerEmail || '').trim().toLowerCase()
  return email ? emailToId.get(email) || '' : ''
}

function groupDocs(docs, emailToId) {
  const map = new Map()
  for (const doc of docs) {
    if (doc?.deleted) continue
    const id = clientKey(doc, emailToId)
    if (!id) continue
    if (!map.has(id)) map.set(id, [])
    map.get(id).push(doc)
  }
  return map
}

function displayName(client) {
  return String(client?.company || client?.name || 'Unnamed').trim() || 'Unnamed'
}

function flagsFor(client, quotes, invoices, meetings) {
  const qualifying = quotes.filter((q) => QUALIFYING_QUOTE.has(q.status))
  const liveInvoices = invoices.filter((inv) => inv.status !== 'void')
  const closed =
    client.pipelineStatus === 'closed_sold' || liveInvoices.some((inv) => inv.status === 'paid')
  const invoiced = closed || liveInvoices.length > 0
  const quoted = invoiced || qualifying.length > 0
  const visited = quoted || client.visited === true || meetings.length > 0
  return { visited, quoted, invoiced, closed }
}

function pipelineFor(quotes, invoices) {
  const liveInvoices = invoices.filter((inv) => inv.status !== 'void')
  const openInvoices = liveInvoices.filter(
    (inv) => OPEN_INVOICE.has(inv.status) && invoiceRemaining(inv) > 0.004
  )
  if (openInvoices.length) {
    return moneyRound(openInvoices.reduce((sum, inv) => sum + invoiceRemaining(inv), 0))
  }
  const openQuotes = quotes.filter((q) => OPEN_QUOTE.has(q.status))
  if (!openQuotes.length) return 0
  return moneyRound(Math.max(...openQuotes.map((q) => Number(q.amount) || 0)))
}

function paidRevenue(invoices) {
  return moneyRound(
    invoices
      .filter((inv) => inv.status !== 'void')
      .reduce((sum, inv) => sum + invoicePaidAmount(inv), 0)
  )
}

function actionRow(row, kind, title, amount) {
  return {
    id: kind + ':' + row.client.id,
    kind,
    title,
    clientId: row.client.id,
    clientName: displayName(row.client),
    amount: moneyRound(amount)
  }
}

function buildActions(cohort, rates) {
  const buckets = [
    {
      rows: cohort
        .map((row) => {
          const open = row.invoices.filter(
            (inv) => inv.status !== 'void' && OPEN_INVOICE.has(inv.status) && invoiceRemaining(inv) > 0.004
          )
          if (!open.length) return null
          const amount = open.reduce((sum, inv) => sum + invoiceRemaining(inv), 0)
          return actionRow(row, 'collect', 'Collect payment', amount)
        })
        .filter(Boolean)
    },
    {
      rows: cohort
        .map((row) => {
          if (row.invoices.some((inv) => inv.status !== 'void')) return null
          const accepted = row.quotes.filter((q) => q.status === 'accepted')
          if (!accepted.length) return null
          const amount = Math.max(...accepted.map((q) => Number(q.amount) || 0))
          return actionRow(row, 'invoice', 'Raise an invoice', amount)
        })
        .filter(Boolean)
    },
    {
      rows: cohort
        .map((row) => {
          if (row.flags.closed || row.invoices.some((inv) => inv.status !== 'void')) return null
          const sent = row.quotes.filter((q) => q.status === 'sent')
          if (!sent.length) return null
          const amount = Math.max(...sent.map((q) => Number(q.amount) || 0))
          return actionRow(row, 'followup', 'Follow up the quote', amount)
        })
        .filter(Boolean)
    },
    {
      rows: cohort
        .filter((row) => row.flags.visited && !row.flags.quoted)
        .map((row) => actionRow(row, 'quote', 'Send a quote', 0))
    },
    {
      rows:
        rates.visit != null && rates.visit < 50
          ? cohort.filter((row) => !row.flags.visited).map((row) => actionRow(row, 'visit', 'Visit the prospect', 0))
          : []
    }
  ]

  const actions = []
  for (const bucket of buckets) {
    bucket.rows.sort((a, b) => b.amount - a.amount || a.clientName.localeCompare(b.clientName))
    for (const row of bucket.rows) {
      if (actions.length >= 5) return actions
      actions.push(row)
    }
  }
  return actions
}

/**
 * @param {{
 *   clients?: object[],
 *   quotes?: object[],
 *   invoices?: object[],
 *   meetings?: object[],
 *   agentId?: string,
 *   periodDays?: number
 * }} input
 */
export function buildAgentFunnel({
  clients = [],
  quotes = [],
  invoices = [],
  meetings = [],
  agentId = '',
  periodDays = 90
} = {}) {
  const since = periodDays > 0 ? Date.now() - periodDays * 24 * 60 * 60 * 1000 : 0
  const aid = String(agentId || '').trim()

  const owned = clients.filter((c) => {
    if (!c || c.deleted) return false
    if (c.pipelineStatus === 'not_interested') return false
    if (!aid) return true
    return String(c.ownerAgentId || '') === aid
  })

  const emailToId = new Map()
  for (const c of owned) {
    const email = String(c.email || '').trim().toLowerCase()
    if (email && !emailToId.has(email)) emailToId.set(email, c.id)
  }

  const quotesBy = groupDocs(quotes, emailToId)
  const invoicesBy = groupDocs(invoices, emailToId)
  const meetingsBy = groupDocs(meetings, emailToId)

  const cohort = []
  for (const client of owned) {
    const cq = quotesBy.get(client.id) || []
    const ci = invoicesBy.get(client.id) || []
    const cm = meetingsBy.get(client.id) || []
    const active =
      !since ||
      inWindow(client.createdAt, since) ||
      cm.some((m) => inWindow(m.meetingAt, since)) ||
      cq.some((q) => inWindow(q.createdAt, since) || inWindow(q.emailedAt, since)) ||
      ci.some((inv) => inWindow(inv.issuedAt, since) || inWindow(inv.sentAt, since) || inWindow(inv.createdAt, since))
    if (!active) continue
    cohort.push({
      client,
      quotes: cq,
      invoices: ci,
      meetings: cm,
      flags: flagsFor(client, cq, ci, cm)
    })
  }

  const counts = {
    prospects: cohort.length,
    visited: cohort.filter((row) => row.flags.visited).length,
    quoted: cohort.filter((row) => row.flags.quoted).length,
    invoiced: cohort.filter((row) => row.flags.invoiced).length,
    closed: cohort.filter((row) => row.flags.closed).length
  }

  const stages = STAGE_DEFS.map((def, index) => {
    const prev = index === 0 ? null : STAGE_DEFS[index - 1].id
    return {
      id: def.id,
      label: def.label,
      count: counts[def.id],
      share: pct(counts[def.id], counts.prospects),
      conversion: prev ? pct(counts[def.id], counts[prev]) : null
    }
  })

  let weakest = null
  for (let i = 1; i < stages.length; i++) {
    const from = stages[i - 1]
    const to = stages[i]
    if (!from.count) continue
    const conversion = to.count / from.count
    if (!weakest || conversion < weakest.conversion) {
      weakest = {
        fromId: from.id,
        toId: to.id,
        label: `${from.label} → ${to.label}`,
        conversion,
        drop: from.count - to.count
      }
    }
  }

  const rates = {
    visit: pct(counts.visited, counts.prospects),
    quote: pct(counts.quoted, counts.visited),
    invoice: pct(counts.invoiced, counts.quoted),
    close: pct(counts.closed, counts.prospects)
  }

  return {
    agentId: aid,
    periodDays: periodDays > 0 ? periodDays : 0,
    counts,
    stages: stages.map((stage) => ({
      ...stage,
      weak: weakest ? stage.id === weakest.toId : false
    })),
    weakest,
    rates,
    pipelineValue: moneyRound(cohort.reduce((sum, row) => sum + pipelineFor(row.quotes, row.invoices), 0)),
    revenue: moneyRound(cohort.reduce((sum, row) => sum + paidRevenue(row.invoices), 0)),
    actions: buildActions(cohort, rates)
  }
}

export function rankAgents({ agents = [], ...rest } = {}) {
  return agents
    .filter((a) => a && !a.deleted)
    .map((agent) => {
      const funnel = buildAgentFunnel({ ...rest, agents, agentId: agent.id })
      return {
        agentId: agent.id,
        name: agent.name || 'Agent',
        active: agent.active !== false,
        closeRate: funnel.rates.close,
        revenue: funnel.revenue,
        pipelineValue: funnel.pipelineValue,
        prospects: funnel.counts.prospects,
        weakest: funnel.weakest?.label || '',
        closed: funnel.counts.closed
      }
    })
    .filter((row) => row.prospects > 0 || row.revenue > 0)
    .sort((a, b) => {
      const ar = a.closeRate == null ? -1 : a.closeRate
      const br = b.closeRate == null ? -1 : b.closeRate
      if (br !== ar) return br - ar
      return b.revenue - a.revenue
    })
}
