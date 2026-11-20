import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateReading } from '../js/validation.js';
import { applyStatusChange } from '../js/status.js';

const book = { id: 1, title: 'T', publicationYear: 1990 };
const ctx = { today: '2026-11-20', book };
const fields = (errors) => errors.map((e) => e.field).sort();
const r = (over) => ({ bookId: 1, status: 'Read', yearRead: 2024, grade: 8, recommendedBy: null, priority: null, notes: null, ...over });

test('a finished reading with year and grade is valid', () => {
  assert.deepEqual(validateReading(r({}), ctx), []);
});

test('book is required and must exist', () => {
  assert.deepEqual(fields(validateReading(r({ bookId: null }), { ...ctx, book: null })), ['bookId']);
});

test('status is required and must come from the list', () => {
  assert.deepEqual(fields(validateReading(r({ status: null, yearRead: null, grade: null }), ctx)), ['status']);
  assert.deepEqual(fields(validateReading(r({ status: 'Lido', yearRead: null, grade: null }), ctx)), ['status']);
});

test('year read is required when status is Read', () => {
  assert.deepEqual(fields(validateReading(r({ yearRead: null }), ctx)), ['yearRead']);
});

test('year read is optional when Abandoned and must be empty otherwise', () => {
  assert.deepEqual(validateReading(r({ status: 'Abandoned', yearRead: null, grade: null }), ctx), []);
  assert.deepEqual(validateReading(r({ status: 'Abandoned', yearRead: 2025, grade: 3.5 }), ctx), []);
  for (const status of ['Want to read', 'Reading', 'Paused']) {
    assert.deepEqual(fields(validateReading(r({ status, yearRead: 2024, grade: null }), ctx)), ['yearRead'], status);
  }
});

test('year read is not in the future nor before the publication year', () => {
  assert.deepEqual(validateReading(r({ yearRead: 1990 }), ctx), []);
  assert.deepEqual(fields(validateReading(r({ yearRead: 2027 }), ctx)), ['yearRead']);
  assert.deepEqual(fields(validateReading(r({ yearRead: 1989 }), ctx)), ['yearRead']);
  assert.deepEqual(fields(validateReading(r({ yearRead: 2024.5 }), ctx)), ['yearRead']);
});

test('BC publication years accept any AD reading year', () => {
  assert.deepEqual(validateReading(r({ yearRead: 2021 }), { ...ctx, book: { ...book, publicationYear: -429 } }), []);
});

test('a book without publication year accepts any past reading year', () => {
  assert.deepEqual(validateReading(r({ yearRead: 2021 }), { ...ctx, book: { ...book, publicationYear: null } }), []);
});

test('grade is 0.0 to 10.0 in steps of 0.5', () => {
  for (const grade of [0, 0.5, 7, 9.5, 10]) assert.deepEqual(validateReading(r({ grade }), ctx), [], String(grade));
  for (const grade of [-0.5, 10.5, 7.3, 7.25]) assert.deepEqual(fields(validateReading(r({ grade }), ctx)), ['grade'], String(grade));
});

test('grade is only allowed when Read or Abandoned', () => {
  for (const status of ['Want to read', 'Reading', 'Paused']) {
    assert.deepEqual(fields(validateReading(r({ status, yearRead: null, grade: 7 }), ctx)), ['grade'], status);
  }
});

test('priority is only allowed when Want to read, and from the list', () => {
  assert.deepEqual(validateReading(r({ status: 'Want to read', yearRead: null, grade: null, priority: 'High' }), ctx), []);
  assert.deepEqual(fields(validateReading(r({ status: 'Want to read', yearRead: null, grade: null, priority: 'Urgent' }), ctx)), ['priority']);
  assert.deepEqual(fields(validateReading(r({ priority: 'High' }), ctx)), ['priority']);
});

// FR-04 status workflow
test('leaving Want to read clears priority and keeps recommendation and notes', () => {
  const before = r({ status: 'Want to read', yearRead: null, grade: null, priority: 'High', recommendedBy: 'Teco', notes: 'n' });
  const { reading, cleared } = applyStatusChange(before, 'Reading');
  assert.equal(reading.status, 'Reading');
  assert.equal(reading.priority, null);
  assert.equal(reading.recommendedBy, 'Teco');
  assert.equal(reading.notes, 'n');
  assert.deepEqual(cleared.needsConfirm, []);
});

test('moving to a status without year read or grade reports them as needing confirmation and clears them', () => {
  const { reading, cleared } = applyStatusChange(r({}), 'Paused');
  assert.deepEqual(cleared.needsConfirm.sort(), ['grade', 'yearRead']);
  assert.equal(reading.yearRead, null);
  assert.equal(reading.grade, null);
});

test('Read to Abandoned keeps year read and grade, nothing to confirm', () => {
  const { reading, cleared } = applyStatusChange(r({}), 'Abandoned');
  assert.deepEqual(cleared.needsConfirm, []);
  assert.equal(reading.yearRead, 2024);
  assert.equal(reading.grade, 8);
});

test('empty values never need confirmation', () => {
  const { cleared } = applyStatusChange(r({ status: 'Reading', yearRead: null, grade: null }), 'Paused');
  assert.deepEqual(cleared.needsConfirm, []);
});
