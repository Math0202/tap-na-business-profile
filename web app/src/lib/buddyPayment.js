/**
 * Buddy payment links for tap-na shop / sales docs.
 * https://payment.buddy.na?business=3227&amount=…&reference=…
 */

export const BUDDY_PAYMENT_BUSINESS_ID = '3227'
export const BUDDY_PAYMENT_ORIGIN = 'https://payment.buddy.na'

export function formatBuddyAmount(amount) {
  const n = Math.round((Number(amount) || 0) * 100) / 100
  if (!(n > 0)) return ''
  return n.toFixed(2)
}

/** Build Buddy hosted payment URL. Reference should be INV-… / Q-… / SQ-… */
export function buddyPaymentUrl({ reference, amount } = {}) {
  const ref = String(reference || '').trim()
  const amt = formatBuddyAmount(amount)
  if (!ref || !amt) return ''
  const params = new URLSearchParams({
    business: BUDDY_PAYMENT_BUSINESS_ID,
    amount: amt,
    reference: ref
  })
  return `${BUDDY_PAYMENT_ORIGIN}?${params.toString()}`
}