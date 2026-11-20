import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortLogRows, DEFAULT_SORT } from '../js/sort.js';

const rows = [
  { id: 1, title: 'Germinal', authors: 'Émile Zola', status: 'Read', yearRead: 2021, grade: 7.5 },
  { id: 2, title: 'Knulp', authors: 'Hermann Hesse', status: 'Want to read', yearRead: null, grade: null },
  { id: 3, title: 'agosto', authors: 'Rubem Fonseca', status: 'Read', yearRead: 2026, grade: 8.5 },
  { id: 4, title: 'O homem sem qualidades', authors: '', status: 'Paused', yearRead: null, grade: null },
  { id: 5, title: 'Utopia', authors: 'Thomas More', status: 'Read', yearRead: 2021, grade: 6.5 },
  { id: 6, title: 'Dracula', authors: 'Bram Stoker', status: 'Read', yearRead: 2024, grade: 8 },
];
const ids = (list) => list.map((r) => r.id);

test('default order is year read, most recent first, then id ascending; missing years last', () => {
  assert.deepEqual(DEFAULT_SORT, { key: 'yearRead', dir: 'desc' });
  assert.deepEqual(ids(sortLogRows(rows, DEFAULT_SORT)), [3, 6, 1, 5, 2, 4]);
});

test('year read ascending still puts missing values last, ties by id', () => {
  assert.deepEqual(ids(sortLogRows(rows, { key: 'yearRead', dir: 'asc' })), [1, 5, 6, 3, 2, 4]);
});

test('grade sorts numerically with missing grades last in both directions', () => {
  assert.deepEqual(ids(sortLogRows(rows, { key: 'grade', dir: 'asc' })), [5, 1, 6, 3, 2, 4]);
  assert.deepEqual(ids(sortLogRows(rows, { key: 'grade', dir: 'desc' })), [3, 6, 1, 5, 2, 4]);
});

test('title sorts alphabetically ignoring case and accents', () => {
  assert.deepEqual(ids(sortLogRows(rows, { key: 'title', dir: 'asc' })), [3, 6, 1, 2, 4, 5]);
  assert.deepEqual(ids(sortLogRows(rows, { key: 'title', dir: 'desc' })), [5, 4, 2, 1, 6, 3]);
});

test('authors sort alphabetically and a book without authors goes last', () => {
  assert.deepEqual(ids(sortLogRows(rows, { key: 'authors', dir: 'asc' })), [6, 1, 2, 3, 5, 4]);
  assert.deepEqual(ids(sortLogRows(rows, { key: 'authors', dir: 'desc' })), [5, 3, 2, 1, 6, 4]);
});

test('status sorts alphabetically, ties by id', () => {
  assert.deepEqual(ids(sortLogRows(rows, { key: 'status', dir: 'asc' })), [4, 1, 3, 5, 6, 2]);
});

test('sorting does not modify the input list', () => {
  const copy = rows.slice();
  sortLogRows(rows, { key: 'grade', dir: 'asc' });
  assert.deepEqual(rows, copy);
});
