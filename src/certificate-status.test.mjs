import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateStatus, formatDate, getExpiryLabel, buildCertificatesCSV } from './certificate-status.js'

const today = '2026-10-02'
const cert = { id: 1, name: 'Training certificate', category: 'STCW', issuanceDate: '2015-01-01' }

test('printed expiries use calendar-day boundaries and the six-month attention window', () => {
  assert.equal(calculateStatus({ ...cert, expiryDate: '2026-10-01' }, today), 'expired')
  assert.equal(calculateStatus({ ...cert, expiryDate: today }, today), 'expiring')
  assert.equal(calculateStatus({ ...cert, expiryDate: '2027-04-02' }, today), 'expiring')
  assert.equal(calculateStatus({ ...cert, expiryDate: '2027-04-03' }, today), 'valid')
})

test('missing dates never imply validity or a synthesized STCW or annual expiry', () => {
  assert.equal(calculateStatus(cert, today), 'review')
  for (const name of ['STCW training', 'AECO', 'IAATO', 'Svalbard']) {
    const record = { ...cert, name, validityType: 'no_expiry_stated' }
    assert.equal(calculateStatus(record, today), 'no-expiry-stated')
    assert.equal(getExpiryLabel(record), 'Not stated')
  }
  assert.equal(calculateStatus({ ...cert, validityType: 'expiry_unknown' }, today), 'review')
  assert.equal(calculateStatus({ ...cert, validityType: 'lifetime' }, today), 'valid')
})

test('historical records stay out of active expiry counts, but missing sources need review', () => {
  const record = { ...cert, validityType: 'historical', expiryDate: '2020-01-01' }
  assert.equal(calculateStatus(record, today), 'historical')
  assert.equal(calculateStatus({ ...record, sourceMissing: true }, today), 'review')
  assert.equal(calculateStatus({ ...record, reviewRequired: true }, today), 'historical')
  assert.equal(calculateStatus({ ...cert, expiryDate: '2028-01-01', reviewRequired: true }, today), 'review')
})

test('FPOS and Trauma Care keep optional renewal treatment only when a date is recorded', () => {
  for (const name of ['FPOS', 'Trauma Care']) {
    assert.equal(calculateStatus({ ...cert, name, expiryDate: '2025-01-01' }, today), 'renewal-suggested')
    assert.equal(calculateStatus({ ...cert, name, expiryDate: '2027-05-01' }, today), 'valid')
    assert.equal(calculateStatus({ ...cert, name }, today), 'review')
  }
  assert.equal(calculateStatus({ ...cert, name: 'Trauma Management in Extreme Conditions',
    obligatory: false, expiryDate: '2025-01-01' }, today), 'renewal-suggested')
})

test('invalid and contradictory dates need review, and formatting is timezone-stable', () => {
  assert.equal(calculateStatus({ ...cert, expiryDate: '2026-02-30' }, today), 'review')
  assert.equal(calculateStatus({ ...cert, issuanceDate: '2026-11-01' }, today), 'review')
  assert.equal(calculateStatus({ ...cert, expiryDate: '2014-01-01' }, today), 'review')
  assert.equal(formatDate('2026-10-02'), 'Oct 2, 2026')
  assert.equal(formatDate('2026-02-30'), '—')
})

test('owner-confirmed no-action records retain printed dates without renewal or expiry alerts', () => {
  const record = { ...cert, name: 'FPOS', obligatory: false, expiryDate: '2025-01-01',
    attentionPolicy: 'none', ownerConfirmedAt: '2026-10-03',
    reviewNote: 'No replacement needed following CoROM REMT attendance, confirmed 3 October 2026.' }
  assert.equal(calculateStatus(record, '2026-10-03'), 'no-action-required')
  assert.equal(getExpiryLabel(record), 'Jan 1, 2025')
  const csv = buildCertificatesCSV([record], {}, '2026-10-03')
  assert.ok(csv.includes('"2025-01-01"'))
  assert.ok(csv.includes('"No Action Needed"'))
  assert.ok(csv.includes(record.reviewNote))
  assert.equal(calculateStatus({ ...record, name: 'Speedboat permit', obligatory: true }, today), 'no-action-required')
  assert.equal(calculateStatus({ ...record, name: 'Dräger', expiryDate: null }, today), 'no-action-required')
  assert.equal(calculateStatus({ ...record, sourceMissing: true }, today), 'review')
})

test('CSV keeps actual dates, source evidence, quoted notes and annotation state', () => {
  const record = { ...cert, name: 'FPOS', expiryDate: '2025-01-01',
    file: 'FPOS.pdf', sourceUrl: 'https://drive.google.com/file/d/example/view', verifiedAt: today }
  const csv = buildCertificatesCSV([record], {
    checked: { 1: true }, flagged: { 1: true }, notes: { 1: 'Discuss "renewal", next week\n=not a formula' },
  }, today)
  assert.ok(csv.includes('"2025-01-01"'))
  assert.ok(csv.includes('"Consider Renewal"'))
  assert.ok(csv.includes('"FPOS.pdf","https://drive.google.com/file/d/example/view","2026-10-02"'))
  assert.ok(csv.includes('"Yes","Yes","Discuss ""renewal"", next week\n=not a formula"'))
  assert.ok(!csv.includes('Invalid Date'))
  assert.ok(!csv.includes('unofficial'))
  const formulaNote = buildCertificatesCSV([record], { notes: { 1: '=1+1' } }, today)
  assert.ok(formulaNote.includes('"\'=1+1"'))
})
