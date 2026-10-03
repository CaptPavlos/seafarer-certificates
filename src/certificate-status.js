const DAY_MS = 24 * 60 * 60 * 1000
const OPTIONAL_RENEWAL_NAMES = ['FPOS', 'Trauma Care']

export const STATUS_LABELS = {
  valid: 'Valid',
  expiring: 'Expiring Soon',
  expired: 'Expired',
  'renewal-suggested': 'Consider Renewal',
  review: 'Needs Review',
  'no-expiry-stated': 'No Expiry Stated',
  'no-action-required': 'No Action Needed',
  historical: 'Historical Record',
}

export const ATTENTION_STATUSES = ['expired', 'expiring', 'review', 'renewal-suggested']

// Read a printed calendar date without allowing timezone shifts or invalid dates.
export const parseDateOnly = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date
}

export const formatDate = (value) => {
  const date = parseDateOnly(value)
  return date ? date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  }) : '—'
}

export const isOptionalRenewalCert = (cert) =>
  cert.obligatory === false || OPTIONAL_RENEWAL_NAMES.some(name => cert.name?.includes(name))

export const calculateStatus = (cert, asOf = new Date()) => {
  if (cert.sourceMissing) return 'review'
  if (cert.validityType === 'historical') return 'historical'
  if (cert.reviewRequired) return 'review'

  const today = typeof asOf === 'string' ? parseDateOnly(asOf) :
    new Date(Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()))
  if (!today || Number.isNaN(today.getTime())) return 'review'

  const issued = parseDateOnly(cert.issuanceDate)
  const expiry = parseDateOnly(cert.expiryDate)
  if ((cert.issuanceDate && !issued) || (cert.expiryDate && !expiry)) return 'review'
  if (issued && (issued > today || (expiry && issued > expiry))) return 'review'

  // Owner-confirmed tracking decisions do not alter the document's printed dates.
  if (cert.attentionPolicy === 'none') return 'no-action-required'

  if (expiry) {
    const soon = expiry.getTime() <= today.getTime() + 182 * DAY_MS
    if (isOptionalRenewalCert(cert) && soon) return 'renewal-suggested'
    if (expiry < today) return 'expired'
    return soon ? 'expiring' : 'valid'
  }

  if (cert.validityType === 'lifetime') return 'valid'
  if (cert.validityType === 'no_expiry_stated') return 'no-expiry-stated'
  return 'review'
}

export const getExpiryLabel = (cert) => {
  if (cert.expiryDate) return formatDate(cert.expiryDate)
  if (cert.validityType === 'lifetime') return 'Lifetime'
  if (cert.validityType === 'historical') return 'Not applicable'
  if (cert.validityType === 'no_expiry_stated') return 'Not stated'
  return 'Unknown'
}

export const getStatusNote = (cert, status = calculateStatus(cert)) => {
  if (cert.reviewNote) return cert.reviewNote
  if (cert.sourceMissing) return 'The source file was not found in the audited folder.'
  if (status === 'review') return 'Confirm the dates and validity from the source document.'
  if (status === 'renewal-suggested') return 'Optional renewal reminder based on the recorded expiry date.'
  if (status === 'no-expiry-stated') return 'No expiry date is stated. Any role-specific renewal requirement should be confirmed.'
  if (status === 'historical') return 'Kept for reference; this record does not confirm current eligibility.'
  if (status === 'no-action-required') return 'No renewal or replacement action is tracked for this record.'
  return ''
}

const csvCell = (value) => {
  const text = String(value ?? '')
  const safeText = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text
  return `"${safeText.replaceAll('"', '""')}"`
}

export const buildCertificatesCSV = (certificates, annotations = {}, asOf = new Date()) => {
  const { checked = {}, flagged = {}, notes = {} } = annotations
  const headers = ['Category', 'Certificate Name', 'Certificate Number', 'Issuer', 'Issued / completed',
    'Expiry Date', 'Validity Basis', 'Status', 'Source File', 'Source URL', 'Verified At',
    'Source Missing', 'Review Note', 'Checked', 'Flagged', 'Personal Note']
  const rows = [...certificates].sort((a, b) => a.category.localeCompare(b.category)).map(cert => {
    const status = calculateStatus(cert, asOf)
    return [cert.category, cert.name, cert.certNumber, cert.issuer, cert.issuanceDate,
      cert.expiryDate, cert.validityType, STATUS_LABELS[status], cert.file,
      cert.sourceUrl, cert.verifiedAt, cert.sourceMissing ? 'Yes' : 'No',
      getStatusNote(cert, status), checked[cert.id] ? 'Yes' : 'No',
      flagged[cert.id] ? 'Yes' : 'No', notes[cert.id]]
  })
  return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')
}
