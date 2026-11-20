import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBook, validateThemeName } from '../js/validation.js';

const ctx = {
  today: '2026-11-20',
  authors: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
  themes: [{ id: 1, name: 'Satire' }],
  readings: [],
};
const fields = (errors) => errors.map((e) => e.field).sort();

test('a book may be saved with only its title', () => {
  assert.deepEqual(validateBook({ title: 'Knulp', authorIds: [], themeIds: [] }, ctx), []);
});

test('title is required', () => {
  assert.deepEqual(fields(validateBook({ title: ' ', authorIds: [], themeIds: [] }, ctx)), ['title']);
});

test('authors must be existing records, without repeats', () => {
  assert.deepEqual(validateBook({ title: 'T', authorIds: [1, 2] }, ctx), []);
  assert.deepEqual(fields(validateBook({ title: 'T', authorIds: [3] }, ctx)), ['authorIds']);
  assert.deepEqual(fields(validateBook({ title: 'T', authorIds: [1, 1] }, ctx)), ['authorIds']);
});

test('publication year: integer, not in the future, negative is BC, 0 is invalid', () => {
  assert.deepEqual(validateBook({ title: 'Édipo Rei', publicationYear: -429 }, ctx), []);
  assert.deepEqual(validateBook({ title: 'T', publicationYear: 2026 }, ctx), []);
  assert.deepEqual(fields(validateBook({ title: 'T', publicationYear: 2027 }, ctx)), ['publicationYear']);
  assert.deepEqual(fields(validateBook({ title: 'T', publicationYear: 0 }, ctx)), ['publicationYear']);
  assert.deepEqual(fields(validateBook({ title: 'T', publicationYear: 1954.5 }, ctx)), ['publicationYear']);
});

test('form, mode and content must come from their lists', () => {
  assert.deepEqual(validateBook({ title: 'T', form: 'Short Story Collection', mode: 'Sequential Art', content: 'Non-fiction' }, ctx), []);
  assert.deepEqual(
    fields(validateBook({ title: 'T', form: 'Romance', mode: 'Prosa', content: 'Ficção' }, ctx)),
    ['content', 'form', 'mode'],
  );
});

test('themes must be existing records, without repeats', () => {
  assert.deepEqual(validateBook({ title: 'T', themeIds: [1] }, ctx), []);
  assert.deepEqual(fields(validateBook({ title: 'T', themeIds: [9] }, ctx)), ['themeIds']);
  assert.deepEqual(fields(validateBook({ title: 'T', themeIds: [1, 1] }, ctx)), ['themeIds']);
});

test('publication year cannot be later than a reading of the book', () => {
  const withReading = { ...ctx, readings: [{ id: 1, bookId: 7, yearRead: 2021 }] };
  assert.deepEqual(validateBook({ id: 7, title: 'T', publicationYear: 2021 }, withReading), []);
  assert.deepEqual(fields(validateBook({ id: 7, title: 'T', publicationYear: 2022 }, withReading)), ['publicationYear']);
});

test('theme names are required and unique ignoring case', () => {
  assert.deepEqual(validateThemeName('Gothic', ctx), []);
  assert.deepEqual(fields(validateThemeName('', ctx)), ['name']);
  assert.deepEqual(fields(validateThemeName(' sATIRE ', ctx)), ['name']);
});
