/** Connect Teams owner: meeting tool + CRM (claim / onboard). */

export const MEETING_TOOLS = [
  {
    id: 'google',
    label: 'Google Meet',
    logo: '/images/email/gmail.png'
  },
  {
    id: 'microsoft',
    label: 'Microsoft',
    logo: '/images/email/outlook.png'
  }
]

export const CRM_PROVIDERS = [
  { id: 'salesforce', label: 'Salesforce', logo: '/images/email/crm-salesforce.png' },
  { id: 'zoho', label: 'Zoho', logo: '/images/email/crm-zoho.png' },
  { id: 'hubspot', label: 'HubSpot', logo: '/images/email/crm-hubspot.png' },
  { id: 'odoo', label: 'Odoo', logo: '/images/email/crm-odoo.png' },
  { id: 'sage', label: 'Sage', logo: '/images/email/crm-sage.png' },
  { id: 'other', label: 'Others', logo: '/images/email/crm-other.png' }
]

export const CRM_IDS = CRM_PROVIDERS.map((c) => c.id)
export const MEETING_TOOL_IDS = MEETING_TOOLS.map((t) => t.id)

export function isConnectTeamPersonalType(personalType) {
  const t = String(personalType || '').trim().toLowerCase()
  return t === 'business' || t === 'executive_exclusive' || t === 'executive'
}

export function normalizeMeetingTool(raw) {
  const v = String(raw || '').trim().toLowerCase()
  return MEETING_TOOL_IDS.includes(v) ? v : ''
}

export function normalizeCrmProvider(raw) {
  const v = String(raw || '').trim().toLowerCase()
  return CRM_IDS.includes(v) ? v : ''
}

export function emptyTeamIntegrations() {
  return {
    meetingTool: '',
    usesCrm: false,
    crmProvider: '',
    crmOther: ''
  }
}

export function validateTeamIntegrations(form) {
  const meetingTool = normalizeMeetingTool(form?.meetingTool)
  if (!meetingTool) return { ok: false, error: 'Choose Google Meet or Microsoft.' }
  const usesCrm = !!form?.usesCrm
  const crmProvider = usesCrm ? normalizeCrmProvider(form?.crmProvider) : ''
  if (usesCrm && !crmProvider) return { ok: false, error: 'Choose the CRM you use.' }
  return {
    ok: true,
    value: {
      meetingTool,
      usesCrm,
      crmProvider,
      crmOther: usesCrm && crmProvider === 'other' ? String(form?.crmOther || '').trim().slice(0, 80) : ''
    }
  }
}
