import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAuthor } from '../js/validation.js';

const ctx = {
  today: '2026-11-20',
  authors: [{ id: 1, name: 'Fyodor Dostoevsky' }],
  countries: [{ id: 22, name: 'Russia' }],
};
const fields = (errors) => errors.map((e) => e.field).sort();

test('author with only a name is valid', () => {
  assert.deepEqual(validateAuthor({ name: 'Clarice Lispector' }, ctx), []);
});

test('author name is required (blank counts as missing)', () => {
  assert.deepEqual(fields(validateAuthor({ name: '   ' }, ctx)), ['name']);
});

test('author name must be unique ignoring case', () => {
  assert.deepEqual(fields(validateAuthor({ name: 'fyodor DOSTOEVSKY' }, ctx)), ['name']);
});

test('editing an author may keep its own name', () => {
  assert.deepEqual(validateAuthor({ id: 1, name: 'Fyodor Dostoevsky' }, ctx), []);
});

test('nationality must be a country from the fixed list', () => {
  assert.deepEqual(validateAuthor({ name: 'X', countryId: 22 }, ctx), []);
  assert.deepEqual(fields(validateAuthor({ name: 'X', countryId: 999 }, ctx)), ['countryId']);
});

test('birth date cannot be in the future', () => {
  assert.deepEqual(validateAuthor({ name: 'X', birthDate: '2026-11-20' }, ctx), []);
  assert.deepEqual(fields(validateAuthor({ name: 'X', birthDate: '2026-11-21' }, ctx)), ['birthDate']);
});

test('death date must be after the birth date', () => {
  assert.deepEqual(validateAuthor({ name: 'X', birthDate: '1821-11-11', deathDate: '1881-02-09' }, ctx), []);
  assert.deepEqual(fields(validateAuthor({ name: 'X', birthDate: '1881-02-09', deathDate: '1881-02-09' }, ctx)), ['deathDate']);
  assert.deepEqual(fields(validateAuthor({ name: 'X', birthDate: '1900-01-01', deathDate: '1850-01-01' }, ctx)), ['deathDate']);
});

test('dates must be real calendar dates', () => {
  assert.deepEqual(fields(validateAuthor({ name: 'X', birthDate: '1900-02-30' }, ctx)), ['birthDate']);
});
