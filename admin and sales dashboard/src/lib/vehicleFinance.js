export const INDUSTRY_OPTIONS = [
  { id: '', label: 'General' },
  { id: 'auto_dealer', label: 'Auto dealer' }
]

export const DEFAULT_VEHICLE_FINANCE_REQUIREMENTS = [
  'Valid Namibian ID or foreign passport with work permit',
  'Valid driver’s license',
  'Proof of residence (utility bill or lease agreement not older than 3 months)',
  'Latest payslip (or 3–6 months of payslips if earning commission/overtime)',
  '3–6 months of bank statements',
  'Marriage certificate and antenuptial contract (if applicable)',
  'Comprehensive vehicle insurance confirmation'
]

export function normalizeIndustry(raw) {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (key === 'auto_dealer' || key === 'autodealer' || key === 'auto') return 'auto_dealer'
  return ''
}

export function industryLabel(raw) {
  const id = normalizeIndustry(raw)
  return INDUSTRY_OPTIONS.find((option) => option.id === id)?.label || 'General'
}

export function vehicleFinanceEnabled(profile) {
  return (
    normalizeIndustry(profile?.industry) === 'auto_dealer' &&
    normalizeVehicleFinance(profile?.vehicleFinance).enabled
  )
}

export function normalizeVehicleFinance(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const rate = Number(src.annualRatePercent ?? src.annual_rate_percent)
  const term = Number(src.termMonths ?? src.term_months)
  const listed = Array.isArray(src.requirements) ? src.requirements : null
  let requirements = (listed || [])
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .slice(0, 24)
  if (!requirements.length) requirements = [...DEFAULT_VEHICLE_FINANCE_REQUIREMENTS]
  const allowRaw = src.allowBalloon !== undefined ? src.allowBalloon : src.allow_balloon
  return {
    enabled: src.enabled === true,
    annualRatePercent: Number.isFinite(rate) ? Math.min(100, Math.max(0, rate)) : 12,
    termMonths: Number.isFinite(term) ? Math.min(360, Math.max(1, Math.round(term))) : 60,
    allowBalloon: allowRaw !== false,
    requirements
  }
}

/** Monthly installment. Balloon is the residual lump sum due at the end. */
export function monthlyVehiclePayment({ principal, annualRatePercent, termMonths, balloon = 0 } = {}) {
  const P = Math.max(0, Number(principal) || 0)
  const n = Math.max(1, Math.round(Number(termMonths) || 0))
  const B = Math.max(0, Number(balloon) || 0)
  const annual = Number(annualRatePercent) || 0
  if (P <= 0) return 0
  const r = annual / 100 / 12
  const balloonPresent = r === 0 ? B : B / Math.pow(1 + r, n)
  const financed = Math.max(0, P - balloonPresent)
  if (r === 0) return financed / n
  const growth = Math.pow(1 + r, n)
  return financed * ((r * growth) / (growth - 1))
}

export function formatNad(amount) {
  const value = Number(amount) || 0
  const formatted = new Intl.NumberFormat('en-NA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.abs(value))
  return `${value < 0 ? '-' : ''}N$${formatted}`
}
