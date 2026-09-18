import { downloadVcard } from './shareHelpers'
import { crmAddUrl } from './teamIntegrations'

function vcardEscape(v) {
  return String(v || '')
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n')
}

export function connectionVcardLines(connection) {
  const c = connection || {}
  const name = String(c.name || '').trim()
  const noteParts = []
  if (c.company) noteParts.push(`Company: ${c.company}`)
  const note = noteParts.join('\n')
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    name ? `FN:${vcardEscape(name)}` : '',
    name ? `N:${vcardEscape(name)};;;;` : '',
    c.email ? `EMAIL;TYPE=INTERNET:${vcardEscape(c.email)}` : '',
    c.phone ? `TEL;TYPE=CELL:${vcardEscape(c.phone)}` : '',
    c.company ? `ORG:${vcardEscape(c.company)}` : '',
    note ? `NOTE:${vcardEscape(note)}` : '',
    'END:VCARD'
  ].filter(Boolean)
}

export function saveConnectionContact(connection) {
  const name = String(connection?.name || 'contact').trim() || 'contact'
  const filename = `${name.replace(/\s+/g, '_')}.vcf`
  downloadVcard(filename, connectionVcardLines(connection))
}

export function addConnectionToCrm(connection, provider) {
  const url = crmAddUrl(provider)
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  saveConnectionContact(connection)
}