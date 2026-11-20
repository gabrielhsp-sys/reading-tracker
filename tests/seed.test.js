import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateAuthor, validateBook, validateReading, validateThemeName } from '../js/validation.js';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const today = '2026-11-20';

test('seed has the expected record counts', () => {
  assert.equal(seed.countries.length, 27);
  assert.equal(seed.authors.length, 101);
  assert.equal(seed.books.length, 143);
  assert.equal(seed.readings.length, 143);
  // Seed_Data_Guide.pdf says 132 themes; the delivered file has 135.
  assert.equal(seed.themes.length, 135);
});

test('every seed author passes validation', () => {
  for (const a of seed.authors) {
    assert.deepEqual(validateAuthor(a, { today, authors: seed.authors, countries: seed.countries }), [], a.name);
  }
});

test('every seed theme name is unique ignoring case', () => {
  seed.themes.forEach((t, i) => {
    const others = seed.themes.filter((_, j) => j !== i);
    assert.deepEqual(validateThemeName(t.name, { themes: others }), [], t.name);
  });
});

test('every seed book passes validation, including against its readings', () => {
  for (const b of seed.books) {
    const errors = validateBook(b, { today, authors: seed.authors, themes: seed.themes, readings: seed.readings });
    assert.deepEqual(errors, [], b.title);
  }
});

test('every seed reading passes validation', () => {
  for (const r of seed.readings) {
    const book = seed.books.find((b) => b.id === r.bookId);
    assert.deepEqual(validateReading(r, { today, book }), [], `reading ${r.id}`);
  }
});
