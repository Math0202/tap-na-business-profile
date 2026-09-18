/**
 * Canonical Connect card feature matrix (Solo / Business / Executive).
 * Keep marketing tables in sync via this module.
 */

/**
 * @typedef {'yes' | 'no' | 'exec'} FeatureMark
 */

/**
 * @type {Array<{ feature: string, solo: FeatureMark, business: FeatureMark, executive: FeatureMark }>}
 */
export const CONNECT_FEATURE_MATRIX = [
  {
    feature: 'NFC + QR → live digital profile',
    solo: 'yes',
    business: 'yes',
    executive: 'yes'
  },
  {
    feature: 'Products & Services Catalogue (Optional)',
    solo: 'yes',
    business: 'yes',
    executive: 'yes'
  },
  {
    feature: 'CRM Integration',
    solo: 'no',
    business: 'yes',
    executive: 'yes'
  },
  {
    feature: 'Google & Microsoft Meeting Calendar',
    solo: 'no',
    business: 'yes',
    executive: 'yes'
  },
  {
    feature: 'Custom Logo (B&W)',
    solo: 'no',
    business: 'yes',
    executive: 'yes'
  },
  {
    feature: 'Team manager — deactivate profiles, manage team/company (1 lead)',
    solo: 'no',
    business: 'no',
    executive: 'yes'
  },
  {
    feature: 'Personal assistant capability',
    solo: 'no',
    business: 'no',
    executive: 'yes'
  },
  {
    feature: 'Stand-in personal capability',
    solo: 'no',
    business: 'no',
    executive: 'yes'
  }
]

/** Features shared by Business + Executive (Connect Teams). */
export const TEAM_SHARED_FEATURE_LABELS = CONNECT_FEATURE_MATRIX.filter(
  (r) => r.business === 'yes'
).map((r) => r.feature)

/** Executive Exclusive-only feature labels. */
export const EXECUTIVE_ONLY_FEATURE_LABELS = CONNECT_FEATURE_MATRIX.filter(
  (r) => r.executive === 'yes' && r.business === 'no'
).map((r) => r.feature)

export function featureMarkLabel(mark) {
  if (mark === 'yes') return '\u2713'
  if (mark === 'exec') return 'Exec'
  return '\u2014'
}

/** Whether Connect Teams columns should show a check (Business or Executive). */
export function teamsPackageMark(row) {
  if (row.business === 'yes' || row.executive === 'yes') {
    return row.business === 'no' && row.executive === 'yes' ? 'exec' : 'yes'
  }
  return 'no'
}