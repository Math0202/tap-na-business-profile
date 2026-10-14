/**
 * Canonical Business / Executive card feature matrix.
 * Keep marketing tables in sync via this module.
 */

/**
 * @typedef {'yes' | 'no'} FeatureMark
 */

/**
 * @type {Array<{ feature: string, business: FeatureMark, executive: FeatureMark }>}
 */
export const CONNECT_FEATURE_MATRIX = [
  {
    feature: 'Chip: External NFC Sticker Tag',
    business: 'yes',
    executive: 'no'
  },
  {
    feature: 'Chip: Internal NFC',
    business: 'no',
    executive: 'yes'
  },
  {
    feature: 'NFC + QR → live digital profile',
    business: 'yes',
    executive: 'yes'
  },
  {
    feature: 'Products & Services Catalogue (Optional)',
    business: 'yes',
    executive: 'yes'
  },
  {
    feature: 'CRM Integration',
    business: 'yes',
    executive: 'yes'
  },
  {
    feature: 'Google & Microsoft Meeting Calendar',
    business: 'yes',
    executive: 'yes'
  },
  {
    feature: 'Custom Logo (B&W)',
    business: 'yes',
    executive: 'yes'
  },
  {
    feature: 'Team manager — deactivate profiles, manage team/company (1 lead)',
    business: 'no',
    executive: 'yes'
  },
  {
    feature: 'Personal assistant capability',
    business: 'no',
    executive: 'yes'
  },
  {
    feature: 'Stand-in personal capability',
    business: 'no',
    executive: 'yes'
  }
]

/** Features included on Business (and Executive). */
export const TEAM_SHARED_FEATURE_LABELS = CONNECT_FEATURE_MATRIX.filter(
  (r) => r.business === 'yes'
).map((r) => r.feature)

/** Executive-only feature labels. */
export const EXECUTIVE_ONLY_FEATURE_LABELS = CONNECT_FEATURE_MATRIX.filter(
  (r) => r.executive === 'yes' && r.business === 'no'
).map((r) => r.feature)

export function featureMarkLabel(mark) {
  if (mark === 'yes') return '\u2713'
  return '\u2014'
}
